use std::path::Path;

use serde::{Deserialize, Serialize};

use super::secret;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_accent_color")]
    pub accent_color: String,
    #[serde(default)]
    pub proxy_url: Option<String>,
    #[serde(default)]
    pub proxy_username: Option<String>,
    #[serde(default)]
    pub proxy_password: Option<String>,
    #[serde(default = "default_true")]
    pub verify_ssl: bool,
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_sidebar_width")]
    pub sidebar_width: u32,
    #[serde(default)]
    pub onboarding_complete: bool,
    #[serde(default)]
    pub crash_reports_enabled: Option<bool>,
    /// Path to a custom CA certificate (PEM format)
    #[serde(default)]
    pub ca_cert_path: Option<String>,
    /// Path to a client certificate (PEM or PFX/PKCS12)
    #[serde(default)]
    pub client_cert_path: Option<String>,
    /// Path to the client certificate private key (PEM, required for PEM certs)
    #[serde(default)]
    pub client_key_path: Option<String>,
    /// Passphrase for PFX/PKCS12 client certificates
    #[serde(default)]
    pub client_cert_passphrase: Option<String>,
    /// Update channel: "stable", "beta", or "nightly"
    #[serde(default = "default_update_channel")]
    pub update_channel: String,
    /// AI assistant: OpenAI-compatible API endpoint
    #[serde(default)]
    pub ai_endpoint: Option<String>,
    /// AI assistant: API key
    #[serde(default)]
    pub ai_api_key: Option<String>,
    /// AI assistant: model name
    #[serde(default)]
    pub ai_model: Option<String>,
    /// Request/Response panel split ratio (0.0-1.0, proportion for request panel)
    #[serde(default = "default_panel_ratio")]
    pub panel_ratio: f64,
    /// Layout mode: "horizontal" (side-by-side) or "vertical" (stacked)
    #[serde(default = "default_layout")]
    pub layout: String,
    /// Persist request edits automatically instead of waiting for an explicit save
    #[serde(default = "default_true")]
    pub auto_save: bool,
}

fn default_theme() -> String {
    "dark".to_string()
}

fn default_accent_color() -> String {
    "indigo".to_string()
}

fn default_true() -> bool {
    true
}

fn default_timeout() -> u64 {
    30000
}

fn default_sidebar_width() -> u32 {
    256
}

fn default_update_channel() -> String {
    "stable".to_string()
}

fn default_panel_ratio() -> f64 {
    0.5
}

fn default_layout() -> String {
    "horizontal".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            accent_color: default_accent_color(),
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
            verify_ssl: true,
            follow_redirects: true,
            timeout_ms: default_timeout(),
            sidebar_width: default_sidebar_width(),
            onboarding_complete: false,
            crash_reports_enabled: None,
            ca_cert_path: None,
            client_cert_path: None,
            client_key_path: None,
            client_cert_passphrase: None,
            update_channel: default_update_channel(),
            ai_endpoint: None,
            ai_api_key: None,
            ai_model: None,
            panel_ratio: default_panel_ratio(),
            layout: default_layout(),
            auto_save: true,
        }
    }
}

pub fn load_settings(path: &Path) -> AppSettings {
    match std::fs::read_to_string(path) {
        Ok(contents) => {
            let mut value: serde_json::Value = match serde_json::from_str(&contents) {
                Ok(value) => value,
                Err(e) => {
                    tracing::warn!("Failed to parse settings, using defaults: {e}");
                    return AppSettings::default();
                }
            };
            if let Some(dir) = path.parent() {
                secret::decrypt_settings(dir, &mut value);
            }
            serde_json::from_value(value).unwrap_or_else(|e| {
                tracing::warn!("Failed to read settings, using defaults: {e}");
                AppSettings::default()
            })
        }
        Err(_) => AppSettings::default(),
    }
}

pub fn save_settings(path: &Path, settings: &AppSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {e}"))?;
    }

    let mut value =
        serde_json::to_value(settings).map_err(|e| format!("Failed to serialize settings: {e}"))?;

    // Secrets are sealed on the way out and opened on the way in, so the in-memory
    // value stays plaintext for the rest of the app.
    if let Some(dir) = path.parent() {
        secret::encrypt_settings(dir, &mut value)?;
    }

    let json = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;

    // Atomic write: write to .tmp then rename. The temp file is created 0600 so the
    // plaintext of a crash-time copy is never group/world readable.
    let tmp_path = path.with_extension("json.tmp");
    secret::write_private_file(&tmp_path, json.as_bytes())?;
    std::fs::rename(&tmp_path, path).map_err(|e| format!("Failed to rename settings file: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_secrets() -> AppSettings {
        AppSettings {
            ai_api_key: Some("sk-live-secret".to_string()),
            proxy_password: Some("proxy-hunter2".to_string()),
            client_cert_passphrase: Some("cert-passphrase".to_string()),
            ..AppSettings::default()
        }
    }

    #[test]
    fn secrets_are_sealed_on_disk_and_restored_on_load() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let original = with_secrets();

        save_settings(&path, &original).unwrap();

        let raw = std::fs::read_to_string(&path).unwrap();
        for plain in ["sk-live-secret", "proxy-hunter2", "cert-passphrase"] {
            assert!(
                !raw.contains(plain),
                "plaintext secret leaked into {path:?}"
            );
        }
        assert!(raw.contains(secret::PREFIX));

        let loaded = load_settings(&path);
        assert_eq!(loaded.ai_api_key, original.ai_api_key);
        assert_eq!(loaded.proxy_password, original.proxy_password);
        assert_eq!(
            loaded.client_cert_passphrase,
            original.client_cert_passphrase
        );
        assert_eq!(loaded.theme, original.theme);
    }

    #[test]
    fn settings_file_is_owner_only() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("settings.json");
            save_settings(&path, &with_secrets()).unwrap();

            let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600, "settings.json should be 0600, got {mode:o}");
        }
    }

    #[test]
    fn plaintext_settings_from_an_older_build_still_load() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, r#"{"theme":"black","aiApiKey":"legacy-key"}"#).unwrap();

        let loaded = load_settings(&path);
        assert_eq!(loaded.ai_api_key.as_deref(), Some("legacy-key"));
        assert_eq!(loaded.theme, "black");
    }

    #[test]
    fn unreadable_secret_becomes_unset_instead_of_ciphertext() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(
            &path,
            r#"{"theme":"dark","aiApiKey":"enc:v1:AAAAAAAAAAAAAAAAAAAAAAAA"}"#,
        )
        .unwrap();

        let loaded = load_settings(&path);
        assert_eq!(loaded.ai_api_key, None);
        assert_eq!(loaded.theme, "dark");
    }
}
