use std::fs;
use std::path::PathBuf;

use rcgen::{BasicConstraints, CertificateParams, IsCa, KeyPair, PKCS_ECDSA_P256_SHA256};

/// Get the directory where proxy CA files are stored.
fn proxy_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not determine home directory")
        .join(".reqmate")
        .join("proxy")
}

/// Path to the CA certificate PEM file.
pub fn ca_cert_path() -> PathBuf {
    proxy_dir().join("ca-cert.pem")
}

/// Path to the CA private key PEM file.
pub fn ca_key_path() -> PathBuf {
    proxy_dir().join("ca-key.pem")
}

/// Check if a CA certificate already exists.
pub fn ca_exists() -> bool {
    ca_cert_path().exists() && ca_key_path().exists()
}

/// Parameters of the local CA.
///
/// Shared by generation and by the interceptor: when minting a certificate for
/// a host, rcgen only reads the issuer's subject and key identifier from these
/// fields, so rebuilding them from the same definition keeps every leaf chained
/// to the CA that is actually installed in the browser.
pub(crate) fn ca_params() -> CertificateParams {
    let mut params = CertificateParams::default();
    params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
    params
        .distinguished_name
        .push(rcgen::DnType::CommonName, "ReqMate Local CA");
    params
        .distinguished_name
        .push(rcgen::DnType::OrganizationName, "ReqMate");
    // Valid for 10 years
    params.not_before = time::OffsetDateTime::now_utc();
    params.not_after = time::OffsetDateTime::now_utc() + time::Duration::days(3650);
    params
}

/// Generate a new self-signed CA certificate for HTTPS interception.
/// Returns the paths to (cert, key) files.
pub fn generate_ca() -> Result<(PathBuf, PathBuf), String> {
    let dir = proxy_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create proxy directory: {e}"))?;

    let key_pair = KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256)
        .map_err(|e| format!("Failed to generate key pair: {e}"))?;

    let params = ca_params();

    let cert = params
        .self_signed(&key_pair)
        .map_err(|e| format!("Failed to generate CA certificate: {e}"))?;

    let cert_pem = cert.pem();
    let key_pem = key_pair.serialize_pem();

    let cert_path = ca_cert_path();
    let key_path = ca_key_path();

    fs::write(&cert_path, &cert_pem).map_err(|e| format!("Failed to write CA cert: {e}"))?;
    fs::write(&key_path, &key_pem).map_err(|e| format!("Failed to write CA key: {e}"))?;

    // Set restrictive permissions on the key file (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&key_path, fs::Permissions::from_mode(0o600));
    }

    tracing::info!("Generated new CA certificate at {}", cert_path.display());
    Ok((cert_path, key_path))
}

/// Ensure the CA certificate exists, generating if needed.
/// Returns paths to (cert, key).
pub fn ensure_ca() -> Result<(PathBuf, PathBuf), String> {
    if ca_exists() {
        Ok((ca_cert_path(), ca_key_path()))
    } else {
        generate_ca()
    }
}

/// Read the CA private key PEM. Only the interceptor needs it.
pub(crate) fn read_ca_key_pem() -> Result<String, String> {
    fs::read_to_string(ca_key_path())
        .map_err(|e| format!("CA key not readable. Generate the CA first: {e}"))
}

/// Read the CA certificate PEM content (for user to install in their browser/OS).
pub fn read_ca_cert_pem() -> Result<String, String> {
    let path = ca_cert_path();
    fs::read_to_string(&path)
        .map_err(|e| format!("CA certificate not found. Generate it first: {e}"))
}

/// Add the CA to the current user's trust store.
///
/// This is the step that makes interception invisible: without it every HTTPS
/// site shows a certificate warning after the proxy mints a leaf. Nothing is
/// installed silently — macOS asks for administrator approval, Windows writes to
/// the per-user store.
pub fn trust_ca() -> Result<(), String> {
    if !ca_exists() {
        return Err("Generate the CA certificate first".to_string());
    }
    let cert = ca_cert_path();
    let path = cert.to_string_lossy().to_string();
    // The path goes through a shell on macOS; ours never contains quotes, but a
    // home directory theoretically could, so refuse instead of escaping badly.
    if path.contains('\'') || path.contains('"') || path.contains('\\') {
        return Err(format!("Unsupported certificate path: {path}"));
    }

    #[cfg(target_os = "macos")]
    {
        // `-d` targets the system store; `with administrator privileges` makes
        // osascript show the native password prompt.
        let script = format!(
            "do shell script \"/usr/bin/security add-trusted-cert -d -r trustRoot \
             -k /Library/Keychains/System.keychain '{path}'\" with administrator privileges"
        );
        let output = std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| format!("Failed to run security: {e}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let message = stderr.trim();
            return Err(if message.is_empty() {
                "Installing the CA was cancelled".to_string()
            } else {
                message.to_string()
            });
        }
        tracing::info!("CA certificate installed in the system trust store");
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        // The per-user root store needs no elevation.
        let output = std::process::Command::new("certutil")
            .args(["-addstore", "-user", "Root"])
            .arg(&path)
            .output()
            .map_err(|e| format!("Failed to run certutil: {e}"))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        Ok(())
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Err(format!(
            "Import {path} into your trust store, e.g. copy it to \
             /usr/local/share/ca-certificates and run update-ca-certificates"
        ))
    }
}
