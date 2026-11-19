//! HTTPS interception.
//!
//! A blind tunnel can only show `CONNECT example.com:443`; to capture real
//! request and response bodies the proxy has to terminate TLS. That needs a
//! certificate the client trusts for *every* host, which is what the local CA is
//! for: on each handshake we sign a short-lived leaf for the requested SNI with
//! the CA key and serve it.
//!
//! The CA files live in `~/.reqmate/proxy` and are also what the user installs in
//! their browser/OS trust store — if they are missing we do not invent them here;
//! the caller falls back to a blind tunnel.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use rcgen::{
    Certificate, CertificateParams, DnType, ExtendedKeyUsagePurpose, IsCa, KeyPair,
    KeyUsagePurpose, PKCS_ECDSA_P256_SHA256,
};
use rustls::crypto::CryptoProvider;
#[cfg(test)]
use rustls::pki_types::CertificateDer;
use rustls::pki_types::{PrivateKeyDer, PrivatePkcs8KeyDer};
use rustls::server::{ClientHello, ResolvesServerCert};
use rustls::sign::{CertifiedKey, SigningKey};
use rustls::ServerConfig;

use crate::proxy::ca;

/// Minted certificates are cached per host: a page load asks for the same SNI
/// dozens of times, and signing an ECDSA certificate each time is wasted work.
/// The cap keeps a long browsing session from growing the map without bound.
const MAX_CACHED_CERTS: usize = 128;

/// Leaves are deliberately short-lived — they are throwaway CI-style certs, and
/// browsers reject anything over 398 days.
const LEAF_VALIDITY_DAYS: i64 = 365;

/// Everything needed to sign a leaf certificate.
///
/// One leaf key is reused for every host: only the certificate differs, so a
/// per-host key pair would add handshake cost for no benefit.
struct Signer {
    issuer: Certificate,
    issuer_key: KeyPair,
    leaf_key: KeyPair,
    key: Arc<dyn SigningKey>,
}

struct Inner {
    provider: Arc<CryptoProvider>,
    signer: Mutex<Signer>,
    cache: Mutex<HashMap<String, Arc<CertifiedKey>>>,
}

/// Cheap-to-clone handle around the signing material.
#[derive(Clone)]
pub(crate) struct CertAuthority {
    inner: Arc<Inner>,
}

impl CertAuthority {
    /// Load the CA from disk. Fails when it has not been generated yet.
    pub fn load() -> Result<Self, String> {
        if !ca::ca_exists() {
            return Err("CA certificate has not been generated".to_string());
        }
        Self::from_ca_key_pem(&ca::read_ca_key_pem()?)
    }

    /// Build from a CA private key PEM (the certificate is re-derived from the
    /// shared CA parameters in [`ca::ca_params`]).
    pub fn from_ca_key_pem(ca_key_pem: &str) -> Result<Self, String> {
        // Pin the provider explicitly: with several providers compiled in,
        // relying on the process-wide default is a panic waiting to happen.
        let provider = Arc::new(rustls::crypto::ring::default_provider());

        let issuer_key =
            KeyPair::from_pem(ca_key_pem).map_err(|e| format!("Failed to parse CA key: {e}"))?;
        let issuer = ca::ca_params()
            .self_signed(&issuer_key)
            .map_err(|e| format!("Failed to rebuild CA certificate: {e}"))?;

        let leaf_key = KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256)
            .map_err(|e| format!("Failed to generate leaf key: {e}"))?;
        let key = provider
            .key_provider
            .load_private_key(PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(
                leaf_key.serialize_der(),
            )))
            .map_err(|e| format!("Failed to load leaf key: {e}"))?;

        Ok(Self {
            inner: Arc::new(Inner {
                provider,
                signer: Mutex::new(Signer {
                    issuer,
                    issuer_key,
                    leaf_key,
                    key,
                }),
                cache: Mutex::new(HashMap::new()),
            }),
        })
    }

    /// TLS configuration for one intercepted connection.
    ///
    /// `fallback_host` covers clients that omit SNI (plain-IP targets): the
    /// CONNECT authority is the only hint available in that case.
    pub fn server_config(&self, fallback_host: &str) -> Result<Arc<ServerConfig>, String> {
        let resolver = Resolver {
            inner: Arc::clone(&self.inner),
            fallback_host: fallback_host.to_string(),
        };

        let mut config = ServerConfig::builder_with_provider(Arc::clone(&self.inner.provider))
            .with_safe_default_protocol_versions()
            .map_err(|e| format!("TLS config error: {e}"))?
            .with_no_client_auth()
            .with_cert_resolver(Arc::new(resolver));

        // The decrypted stream is served by hyper's HTTP/1.1 implementation, so
        // only that protocol may be negotiated.
        config.alpn_protocols = vec![b"http/1.1".to_vec()];
        Ok(Arc::new(config))
    }
}

impl Inner {
    fn certified_for(&self, host: &str) -> Option<Arc<CertifiedKey>> {
        let host = host.trim().trim_end_matches('.').to_ascii_lowercase();
        if host.is_empty() {
            return None;
        }

        if let Ok(cache) = self.cache.lock() {
            if let Some(hit) = cache.get(&host) {
                return Some(Arc::clone(hit));
            }
        }

        let signer = self.signer.lock().ok()?;
        let certified = sign_certificate(&signer, &host)?;
        drop(signer);

        let certified = Arc::new(certified);
        if let Ok(mut cache) = self.cache.lock() {
            if cache.len() >= MAX_CACHED_CERTS {
                // Cheap eviction: the map is a hot-path cache, not a record.
                if let Some(any) = cache.keys().next().cloned() {
                    cache.remove(&any);
                }
            }
            cache.insert(host, Arc::clone(&certified));
        }
        Some(certified)
    }
}

fn sign_certificate(signer: &Signer, host: &str) -> Option<CertifiedKey> {
    // `CertificateParams::new` turns the host into a DNS SAN, or an IP SAN when
    // it happens to be a literal address — both cases a browser accepts.
    let mut params = CertificateParams::new(vec![host.to_string()]).ok()?;
    params
        .distinguished_name
        .push(DnType::CommonName, host.to_string());
    params.is_ca = IsCa::NoCa;
    // Links the leaf to the CA's subject key identifier, which some clients
    // require when building the chain.
    params.use_authority_key_identifier_extension = true;
    // Digital signature only: `keyEncipherment` describes RSA key transport and
    // is not meaningful for the ECDSA keys we mint.
    params.key_usages = vec![KeyUsagePurpose::DigitalSignature];
    params.extended_key_usages = vec![ExtendedKeyUsagePurpose::ServerAuth];
    // Backdate by a day: a client whose clock is slightly behind must still be
    // able to validate the certificate.
    params.not_before = time::OffsetDateTime::now_utc() - time::Duration::days(1);
    params.not_after = time::OffsetDateTime::now_utc() + time::Duration::days(LEAF_VALIDITY_DAYS);

    let cert = params
        .signed_by(&signer.leaf_key, &signer.issuer, &signer.issuer_key)
        .ok()?;

    Some(CertifiedKey::new(
        vec![cert.der().clone()],
        Arc::clone(&signer.key),
    ))
}

struct Resolver {
    inner: Arc<Inner>,
    fallback_host: String,
}

impl std::fmt::Debug for Resolver {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Resolver")
            .field("fallback_host", &self.fallback_host)
            .finish()
    }
}

impl ResolvesServerCert for Resolver {
    fn resolve(&self, client_hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        let host = match client_hello.server_name() {
            Some(name) => name.to_string(),
            // No SNI: fall back to the CONNECT authority.
            None => self.fallback_host.clone(),
        };
        self.inner.certified_for(&host)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn authority() -> CertAuthority {
        let key = KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256).unwrap();
        CertAuthority::from_ca_key_pem(&key.serialize_pem()).unwrap()
    }

    #[test]
    fn issues_a_certificate_per_host_and_caches_it() {
        let ca = authority();
        let first = ca.inner.certified_for("example.com").expect("leaf");
        assert_eq!(first.cert.len(), 1, "leaf chain carries one certificate");

        // Same host → same cached object, not a freshly signed certificate.
        let second = ca.inner.certified_for("EXAMPLE.com.").expect("leaf");
        assert!(Arc::ptr_eq(&first, &second));

        // A different host gets a different certificate.
        let other = ca.inner.certified_for("api.test").expect("leaf");
        assert!(!Arc::ptr_eq(&first, &other));
        assert_ne!(first.cert[0], other.cert[0]);
    }

    #[test]
    fn ip_targets_get_an_ip_san_instead_of_a_dns_name() {
        let ca = authority();
        // Signing must not fail just because the host is a literal address —
        // `https://127.0.0.1` is a common local test target.
        assert!(ca.inner.certified_for("127.0.0.1").is_some());
        assert!(ca.inner.certified_for("::1").is_some());
    }

    #[test]
    fn empty_host_is_refused() {
        let ca = authority();
        assert!(ca.inner.certified_for("").is_none());
        assert!(ca.inner.certified_for("   ").is_none());
    }

    #[test]
    fn server_config_only_offers_http11() {
        let ca = authority();
        let config = ca.server_config("example.com").unwrap();
        assert_eq!(config.alpn_protocols, vec![b"http/1.1".to_vec()]);
    }

    #[test]
    fn cache_does_not_grow_without_bound() {
        let ca = authority();
        for i in 0..(MAX_CACHED_CERTS + 10) {
            assert!(ca.inner.certified_for(&format!("host{i}.test")).is_some());
        }
        assert!(ca.inner.cache.lock().unwrap().len() <= MAX_CACHED_CERTS);
    }
}
