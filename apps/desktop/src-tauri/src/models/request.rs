use serde::{Deserialize, Serialize};

use super::auth::AuthConfig;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "UPPERCASE")]
#[allow(clippy::upper_case_acronyms)]
pub enum HttpMethod {
    #[default]
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    HEAD,
    OPTIONS,
}

impl HttpMethod {
    pub fn to_reqwest(&self) -> reqwest::Method {
        match self {
            HttpMethod::GET => reqwest::Method::GET,
            HttpMethod::POST => reqwest::Method::POST,
            HttpMethod::PUT => reqwest::Method::PUT,
            HttpMethod::PATCH => reqwest::Method::PATCH,
            HttpMethod::DELETE => reqwest::Method::DELETE,
            HttpMethod::HEAD => reqwest::Method::HEAD,
            HttpMethod::OPTIONS => reqwest::Method::OPTIONS,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum BodyType {
    Json,
    Xml,
    FormData,
    Urlencoded,
    Raw,
    Binary,
    #[default]
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValuePair {
    #[serde(default)]
    pub id: String,
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// For form-data: "file" means value is a file path whose content is embedded
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value_type: Option<String>,
}

impl KeyValuePair {
    pub fn new(key: String, value: String, enabled: bool) -> Self {
        Self {
            id: String::new(),
            key,
            value,
            enabled,
            value_type: None,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestBody {
    #[serde(rename = "type")]
    pub body_type: BodyType,
    #[serde(default)]
    pub content: String,
    /// Form-data fields (used when body_type is FormData)
    #[serde(default)]
    pub form_data: Vec<KeyValuePair>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    /// "off" (direct), "on" (the proxy below) or "system" (OS / env proxy)
    pub mode: String,
    /// Scheme when mode = "on": "http" | "https" | "socks5"
    #[serde(default)]
    pub proxy_type: Option<String>,
    /// Host without scheme or port
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub port: Option<u16>,
    /// Comma or newline separated hosts that bypass the proxy
    #[serde(default)]
    pub bypass: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendRequestParams {
    pub method: HttpMethod,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<KeyValuePair>,
    #[serde(default)]
    pub params: Vec<KeyValuePair>,
    pub body: Option<RequestBody>,
    pub auth: Option<AuthConfig>,
    pub proxy: Option<ProxyConfig>,
    /// Request timeout in milliseconds
    pub timeout_ms: Option<u64>,
    /// Whether to follow redirects (default: true)
    #[serde(default = "default_true")]
    pub follow_redirects: bool,
    /// Whether to verify SSL certificates (default: true)
    #[serde(default = "default_true")]
    pub verify_ssl: bool,
    /// Per-request cookie overrides
    #[serde(default)]
    pub cookies: Option<std::collections::HashMap<String, String>>,
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
}
