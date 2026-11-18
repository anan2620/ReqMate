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
    /// Proxy mode: "off" (direct connection), "on" (use the proxy below),
    /// "system" (use the OS / environment proxy configuration)
    #[serde(default = "default_proxy_mode")]
    pub proxy_mode: String,
    /// Proxy scheme when proxy_mode is "on": "http" | "https" | "socks5"
    #[serde(default = "default_proxy_type")]
    pub proxy_type: String,
    /// Proxy host without scheme or port (e.g. "127.0.0.1")
    #[serde(default)]
    pub proxy_host: Option<String>,
    /// Proxy port (defaults to 8080 in the UI when empty)
    #[serde(default)]
    pub proxy_port: Option<u16>,
    /// Comma or newline separated hosts that bypass the proxy
    #[serde(default)]
    pub proxy_bypass: Option<String>,
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

fn default_proxy_mode() -> String {
    "system".to_string()
}

fn default_proxy_type() -> String {
    "http".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            accent_color: default_accent_color(),
            proxy_mode: default_proxy_mode(),
            proxy_type: default_proxy_type(),
            proxy_host: None,
            proxy_port: None,
            proxy_bypass: None,
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

impl AppSettings {
    /// Proxy settings in the shape the HTTP engine expects.
    ///
    /// The settings dialog also builds this DTO on the frontend; the collection
    /// runner and anything else that sends requests server-side uses this so the
    /// proxy behaves identically no matter who starts the request.
    pub fn proxy_config(&self) -> crate::models::request::ProxyConfig {
        use crate::models::request::ProxyConfig;

        if self.proxy_mode == "on"
            && self
                .proxy_host
                .as_deref()
                .is_some_and(|h| !h.trim().is_empty())
        {
            ProxyConfig {
                mode: "on".to_string(),
                proxy_type: Some(self.proxy_type.clone()),
                host: self.proxy_host.clone(),
                port: self.proxy_port,
                bypass: self.proxy_bypass.clone(),
                username: self.proxy_username.clone(),
                password: self.proxy_password.clone(),
            }
        } else {
            ProxyConfig {
                mode: if self.proxy_mode == "system" {
                    "system".to_string()
                } else {
                    "off".to_string()
                },
                proxy_type: None,
                host: None,
                port: None,
                bypass: None,
                username: None,
                password: None,
            }
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
            migrate_legacy_proxy(&mut value);
            serde_json::from_value(value).unwrap_or_else(|e| {
                tracing::warn!("Failed to read settings, using defaults: {e}");
                AppSettings::default()
            })
        }
        Err(_) => AppSettings::default(),
    }
}

/// Older builds stored a single `proxyUrl` string. Fold it into the
/// mode/type/host/port fields so upgrading users keep their proxy settings.
fn migrate_legacy_proxy(value: &mut serde_json::Value) {
    let Some(obj) = value.as_object_mut() else {
        return;
    };

    // Already migrated (or a fresh file) — just drop the stale key.
    if obj.contains_key("proxyMode") {
        obj.remove("proxyUrl");
        return;
    }

    let legacy = obj
        .remove("proxyUrl")
        .and_then(|v| v.as_str().map(str::trim).map(str::to_string))
        .filter(|s| !s.is_empty());

    let Some(raw) = legacy else {
        return;
    };

    // Accept both "http://host:port" and a bare "host:port".
    let parsed = url::Url::parse(&raw)
        .or_else(|_| url::Url::parse(&format!("http://{raw}")))
        .ok();
    let Some(parsed) = parsed else {
        tracing::warn!("Could not migrate legacy proxy URL, ignoring: {raw}");
        return;
    };
    let Some(host) = parsed.host_str() else {
        return;
    };

    let proxy_type = match parsed.scheme().to_ascii_lowercase().as_str() {
        "https" => "https",
        "socks" | "socks5" | "socks5h" => "socks5",
        _ => "http",
    };

    obj.insert("proxyMode".to_string(), serde_json::json!("on"));
    obj.insert("proxyType".to_string(), serde_json::json!(proxy_type));
    obj.insert("proxyHost".to_string(), serde_json::json!(host));
    if let Some(port) = parsed.port() {
        obj.insert("proxyPort".to_string(), serde_json::json!(port));
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
    fn legacy_proxy_url_migrates_to_mode_on() {
        let mut value = serde_json::json!({ "proxyUrl": "socks5://10.0.0.2:1080" });
        migrate_legacy_proxy(&mut value);
        let obj = value.as_object().unwrap();
        assert_eq!(obj["proxyMode"], "on");
        assert_eq!(obj["proxyType"], "socks5");
        assert_eq!(obj["proxyHost"], "10.0.0.2");
        assert_eq!(obj["proxyPort"], 1080);
        assert!(!obj.contains_key("proxyUrl"));
    }

    #[test]
    fn legacy_proxy_url_without_scheme_is_migrated() {
        let mut value = serde_json::json!({ "proxyUrl": "127.0.0.1:3128" });
        migrate_legacy_proxy(&mut value);
        let obj = value.as_object().unwrap();
        assert_eq!(obj["proxyMode"], "on");
        assert_eq!(obj["proxyType"], "http");
        assert_eq!(obj["proxyHost"], "127.0.0.1");
        assert_eq!(obj["proxyPort"], 3128);
    }

    #[test]
    fn proxy_config_reflects_mode() {
        let mut settings = AppSettings::default();
        // Fresh installs follow the OS proxy, like curl and browsers do.
        assert_eq!(settings.proxy_mode, "system");
        assert_eq!(settings.proxy_config().mode, "system");

        settings.proxy_mode = "off".to_string();
        assert_eq!(settings.proxy_config().mode, "off");

        settings.proxy_mode = "on".to_string();
        // No host configured → fall back to direct.
        assert_eq!(settings.proxy_config().mode, "off");

        settings.proxy_host = Some("proxy.internal".to_string());
        settings.proxy_port = Some(8080);
        settings.proxy_type = "https".to_string();
        settings.proxy_bypass = Some("localhost\n127.0.0.1".to_string());
        settings.proxy_username = Some("user".to_string());
        settings.proxy_password = Some("pass".to_string());
        let cfg = settings.proxy_config();
        assert_eq!(cfg.mode, "on");
        assert_eq!(cfg.host.as_deref(), Some("proxy.internal"));
        assert_eq!(cfg.port, Some(8080));
        assert_eq!(cfg.proxy_type.as_deref(), Some("https"));
        assert_eq!(cfg.bypass.as_deref(), Some("localhost\n127.0.0.1"));
        assert_eq!(cfg.username.as_deref(), Some("user"));
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
