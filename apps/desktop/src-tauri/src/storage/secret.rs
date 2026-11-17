//! Encryption at rest for user-supplied secrets in `settings.json`.
//!
//! Secrets (AI API key, proxy password, client-certificate passphrase) are sealed
//! with AES-256-GCM. The data key lives in the OS credential store — macOS
//! Keychain, Windows Credential Manager, or the Secret Service provider on Linux.
//! When no credential store is reachable (headless Linux, CI, broken dbus) the key
//! falls back to `<app_dir>/.master-key`, which is created with 0600 permissions.
//!
//! Sealed values carry an `enc:v1:` prefix inside the JSON so a plaintext value
//! from an older build is still readable and gets re-sealed on the next save.

use std::path::Path;
use std::sync::Mutex;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM, NONCE_LEN};

/// Prefix that marks a sealed value in `settings.json`.
pub const PREFIX: &str = "enc:v1:";

/// Settings fields (already camelCased for JSON) that must never be written in the clear.
pub const SECRET_FIELDS: [&str; 3] = ["aiApiKey", "proxyPassword", "clientCertPassphrase"];

const KEYCHAIN_SERVICE: &str = "dev.reqmate.app";
const KEYCHAIN_USER: &str = "settings-master-key";
const KEY_FILE_NAME: &str = ".master-key";

/// The data key is loaded once per process. A `Mutex` rather than a `OnceLock`
/// because first-launch creation must be serialised: two threads racing on an empty
/// keychain would otherwise each generate a key, and the loser's ciphertext would be
/// unreadable on the next launch.
static MASTER_KEY: Mutex<Option<[u8; 32]>> = Mutex::new(None);

/// Seal one secret. Returns the value unchanged when it is empty.
pub fn encrypt(dir: &Path, plain: &str) -> Result<String, String> {
    if plain.is_empty() {
        return Ok(String::new());
    }
    let key = master_key(dir)?;
    let less_safe = LessSafeKey::new(
        UnboundKey::new(&AES_256_GCM, &key).map_err(|_| "Failed to initialise cipher")?,
    );

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut nonce_bytes);

    let mut buffer = plain.as_bytes().to_vec();
    less_safe
        .seal_in_place_append_tag(
            Nonce::assume_unique_for_key(nonce_bytes),
            Aad::empty(),
            &mut buffer,
        )
        .map_err(|_| "Failed to encrypt secret".to_string())?;

    let mut sealed = Vec::with_capacity(NONCE_LEN + buffer.len());
    sealed.extend_from_slice(&nonce_bytes);
    sealed.extend_from_slice(&buffer);

    Ok(format!("{PREFIX}{}", BASE64.encode(sealed)))
}

/// Open one secret. Plaintext input (pre-upgrade data) is passed through untouched.
pub fn decrypt(dir: &Path, stored: &str) -> Result<String, String> {
    let Some(encoded) = stored.strip_prefix(PREFIX) else {
        return Ok(stored.to_string());
    };

    let raw = BASE64
        .decode(encoded)
        .map_err(|e| format!("Stored secret is not valid base64: {e}"))?;
    if raw.len() <= NONCE_LEN {
        return Err("Stored secret is truncated".to_string());
    }

    let (nonce_bytes, ciphertext) = raw.split_at(NONCE_LEN);
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(nonce_bytes);

    let key = master_key(dir)?;
    let less_safe = LessSafeKey::new(
        UnboundKey::new(&AES_256_GCM, &key).map_err(|_| "Failed to initialise cipher")?,
    );

    let mut buffer = ciphertext.to_vec();
    let plain = less_safe
        .open_in_place(
            Nonce::assume_unique_for_key(nonce),
            Aad::empty(),
            &mut buffer,
        )
        .map_err(|_| "Failed to decrypt secret (wrong key or tampered data)".to_string())?;

    String::from_utf8(plain.to_vec()).map_err(|_| "Decrypted secret is not valid UTF-8".to_string())
}

/// Seal every secret field in a serialised settings object, in place.
pub fn encrypt_settings(dir: &Path, value: &mut serde_json::Value) -> Result<(), String> {
    let Some(obj) = value.as_object_mut() else {
        return Ok(());
    };
    for field in SECRET_FIELDS {
        let Some(serde_json::Value::String(plain)) = obj.get(field) else {
            continue;
        };
        if plain.is_empty() || plain.starts_with(PREFIX) {
            continue;
        }
        let sealed = encrypt(dir, plain)?;
        obj.insert(field.to_string(), serde_json::Value::String(sealed));
    }
    Ok(())
}

/// Open every sealed secret field in a serialised settings object, in place.
///
/// A field that cannot be opened is dropped rather than surfaced as ciphertext, so
/// the UI shows "not set" instead of a meaningless blob.
pub fn decrypt_settings(dir: &Path, value: &mut serde_json::Value) {
    let Some(obj) = value.as_object_mut() else {
        return;
    };
    for field in SECRET_FIELDS {
        let Some(serde_json::Value::String(stored)) = obj.get(field) else {
            continue;
        };
        if !stored.starts_with(PREFIX) {
            continue;
        }
        match decrypt(dir, stored) {
            Ok(plain) => {
                obj.insert(field.to_string(), serde_json::Value::String(plain));
            }
            Err(e) => {
                tracing::warn!("Dropping unreadable secret '{field}': {e}");
                obj.insert(field.to_string(), serde_json::Value::Null);
            }
        }
    }
}

fn master_key(dir: &Path) -> Result<[u8; 32], String> {
    let mut cached = MASTER_KEY
        .lock()
        .map_err(|_| "Master key lock is poisoned".to_string())?;
    if let Some(key) = *cached {
        return Ok(key);
    }
    let key = load_or_create_key(dir)?;
    *cached = Some(key);
    Ok(key)
}

fn load_or_create_key(dir: &Path) -> Result<[u8; 32], String> {
    if let Some(key) = read_keychain() {
        return Ok(key);
    }

    let key_path = dir.join(KEY_FILE_NAME);
    if let Ok(contents) = std::fs::read_to_string(&key_path) {
        if let Some(key) = decode_key(contents.trim()) {
            return Ok(key);
        }
        tracing::warn!("Ignoring malformed master key at {}", key_path.display());
    }

    let mut key = [0u8; 32];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut key);

    if write_keychain(&key) {
        return Ok(key);
    }

    if let Err(e) = std::fs::create_dir_all(dir) {
        return Err(format!("Failed to create app data directory: {e}"));
    }
    write_private_file(&key_path, BASE64.encode(key).as_bytes())?;
    tracing::info!(
        "No OS credential store available; master key stored at {}",
        key_path.display()
    );
    Ok(key)
}

fn decode_key(encoded: &str) -> Option<[u8; 32]> {
    let raw = BASE64.decode(encoded).ok()?;
    raw.try_into().ok()
}

fn keychain_entry() -> Option<keyring::Entry> {
    // Unit tests and headless CI must not touch the developer's real credential
    // store: on macOS an unsigned test binary triggers an access prompt and would
    // hang the suite. Those runs fall through to the 0600 key file instead.
    if cfg!(test) || std::env::var_os("REQMATE_DISABLE_KEYCHAIN").is_some() {
        return None;
    }
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER).ok()
}

fn read_keychain() -> Option<[u8; 32]> {
    let entry = keychain_entry()?;
    match entry.get_password() {
        Ok(encoded) => decode_key(encoded.trim()),
        Err(e) => {
            tracing::debug!("Credential store unavailable: {e}");
            None
        }
    }
}

fn write_keychain(key: &[u8; 32]) -> bool {
    let Some(entry) = keychain_entry() else {
        return false;
    };
    match entry.set_password(&BASE64.encode(key)) {
        Ok(()) => true,
        Err(e) => {
            tracing::debug!("Could not persist master key in credential store: {e}");
            false
        }
    }
}

/// Write a file readable only by the current user.
pub fn write_private_file(path: &Path, contents: &[u8]) -> Result<(), String> {
    use std::io::Write;

    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }

    let mut file = options
        .open(path)
        .map_err(|e| format!("Failed to write {}: {e}", path.display()))?;
    file.write_all(contents)
        .map_err(|e| format!("Failed to write {}: {e}", path.display()))?;
    file.flush()
        .map_err(|e| format!("Failed to flush {}: {e}", path.display()))?;

    // `create` keeps an existing file's mode, so tighten it explicitly.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> tempfile::TempDir {
        tempfile::tempdir().expect("temp dir")
    }

    #[test]
    fn roundtrips_a_secret() {
        let dir = temp_dir();
        let sealed = encrypt(dir.path(), "sk-live-12345").unwrap();
        assert!(sealed.starts_with(PREFIX));
        assert!(!sealed.contains("sk-live-12345"));
        assert_eq!(decrypt(dir.path(), &sealed).unwrap(), "sk-live-12345");
    }

    #[test]
    fn uses_a_fresh_nonce_per_value() {
        let dir = temp_dir();
        let a = encrypt(dir.path(), "same-secret").unwrap();
        let b = encrypt(dir.path(), "same-secret").unwrap();
        assert_ne!(
            a, b,
            "identical plaintext must not produce identical ciphertext"
        );
    }

    #[test]
    fn passes_plaintext_through_for_migration() {
        let dir = temp_dir();
        assert_eq!(
            decrypt(dir.path(), "legacy-plaintext").unwrap(),
            "legacy-plaintext"
        );
    }

    #[test]
    fn empty_secret_stays_empty() {
        let dir = temp_dir();
        assert_eq!(encrypt(dir.path(), "").unwrap(), "");
    }

    #[test]
    fn rejects_tampered_ciphertext() {
        let dir = temp_dir();
        let sealed = encrypt(dir.path(), "secret").unwrap();
        let mut raw = BASE64.decode(sealed.strip_prefix(PREFIX).unwrap()).unwrap();
        let last = raw.len() - 1;
        raw[last] ^= 0xFF;
        let tampered = format!("{PREFIX}{}", BASE64.encode(raw));
        assert!(decrypt(dir.path(), &tampered).is_err());
    }

    #[test]
    fn seals_only_secret_fields_in_settings() {
        let dir = temp_dir();
        let mut value = serde_json::json!({
            "aiApiKey": "sk-abc",
            "proxyPassword": "pw",
            "clientCertPassphrase": "pass",
            "theme": "dark",
            "aiEndpoint": "https://api.example.com",
        });

        encrypt_settings(dir.path(), &mut value).unwrap();
        for field in SECRET_FIELDS {
            let stored = value[field].as_str().unwrap();
            assert!(stored.starts_with(PREFIX), "{field} was not sealed");
        }
        assert_eq!(value["theme"], "dark");
        assert_eq!(value["aiEndpoint"], "https://api.example.com");

        decrypt_settings(dir.path(), &mut value);
        assert_eq!(value["aiApiKey"], "sk-abc");
        assert_eq!(value["proxyPassword"], "pw");
        assert_eq!(value["clientCertPassphrase"], "pass");
    }

    #[test]
    fn is_idempotent_for_already_sealed_values() {
        let dir = temp_dir();
        let mut value = serde_json::json!({ "aiApiKey": "sk-abc" });
        encrypt_settings(dir.path(), &mut value).unwrap();
        let once = value["aiApiKey"].as_str().unwrap().to_string();
        encrypt_settings(dir.path(), &mut value).unwrap();
        assert_eq!(value["aiApiKey"], once);
    }
}
