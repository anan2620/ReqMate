use reqwest::{Client, ClientBuilder, RequestBuilder};
use std::time::Duration;
use url::Url;

use crate::http::auth_handlers;
use crate::models::auth::{ApiKeyLocation, AuthConfig};
use crate::models::error::HttpEngineError;
use crate::models::request::{BodyType, KeyValuePair, RequestBody, SendRequestParams};

/// Default timeout: 30 seconds.
const DEFAULT_TIMEOUT_MS: u64 = 30_000;

/// Install the proxy configuration on the client builder.
///
/// Shared by every outbound reqwest client in the app (single requests, the
/// collection runner, SSE, OAuth, AI and monitor webhooks) so that the
/// `off` / `on` / `system` setting behaves identically everywhere.
///
/// - `off`    → no proxy at all, including the ones reqwest picks up from the
///              environment (HTTP_PROXY/HTTPS_PROXY/ALL_PROXY)
/// - `system` → keep reqwest's OS/environment proxy detection (default)
/// - `on`     → use the configured proxy, with optional bypass list and auth
pub(crate) fn apply_proxy(
    builder: ClientBuilder,
    proxy: Option<&crate::models::request::ProxyConfig>,
) -> Result<ClientBuilder, HttpEngineError> {
    let Some(proxy) = proxy else {
        // No configuration crossing the bridge — behave like "system".
        return Ok(builder);
    };

    match proxy.mode.as_str() {
        "off" => Ok(builder.no_proxy()),
        "on" => {
            let raw_host = proxy.host.as_deref().unwrap_or("");
            // Be forgiving: accept "host", "host:port" or a pasted URL.
            let (clean_host, inline_port) = split_host_port(raw_host);
            if clean_host.is_empty() {
                return Ok(builder.no_proxy());
            }
            let scheme = match proxy.proxy_type.as_deref().unwrap_or("http") {
                "https" => "https",
                "socks5" | "socks5h" | "socks" => "socks5h",
                other => other,
            };
            let port = proxy
                .port
                .or(inline_port)
                .unwrap_or(default_proxy_port(scheme));
            let url = format!("{scheme}://{clean_host}:{port}");

            // no_proxy() first so env/OS proxies can't interfere, then ours.
            let mut reqwest_proxy = reqwest::Proxy::all(&url).map_err(|e| {
                HttpEngineError::RequestError(format!("Invalid proxy address {url}: {e}"))
            })?;

            if let Some(bypass) = proxy.bypass.as_deref() {
                let list = normalize_bypass(bypass);
                if !list.is_empty() {
                    reqwest_proxy = reqwest_proxy.no_proxy(reqwest::NoProxy::from_string(&list));
                }
            }
            if let (Some(user), Some(pass)) = (&proxy.username, &proxy.password) {
                if !user.is_empty() {
                    reqwest_proxy = reqwest_proxy.basic_auth(user, pass);
                }
            }

            Ok(builder.no_proxy().proxy(reqwest_proxy))
        }
        // "system" or anything unknown: keep reqwest's own detection.
        _ => Ok(builder),
    }
}

/// Split a host that may still carry a scheme, path or inline port.
fn split_host_port(raw: &str) -> (String, Option<u16>) {
    let mut host = raw.trim();
    if let Some((_, rest)) = host.split_once("://") {
        host = rest;
    }
    host = host
        .split(['/', '?', '#'])
        .next()
        .unwrap_or(host)
        .trim_end_matches('/');

    // `host:port` (IPv6 literals keep their brackets, so only split on the last colon)
    if let Some((head, tail)) = host.rsplit_once(':') {
        if !head.is_empty() && !head.ends_with(':') {
            if let Ok(port) = tail.parse::<u16>() {
                return (head.trim_matches(['[', ']']).to_string(), Some(port));
            }
        }
    }
    (host.trim_matches(['[', ']']).to_string(), None)
}

fn default_proxy_port(scheme: &str) -> u16 {
    match scheme {
        "https" => 443,
        "socks5h" => 1080,
        _ => 8080,
    }
}

/// The bypass list arrives as newline-separated text from the settings dialog
/// but `NoProxy` wants a comma separated list.
fn normalize_bypass(raw: &str) -> String {
    raw.split(['\n', '\r', ',', ';'])
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>()
        .join(",")
}

/// Build a plain reqwest client that honours the global proxy settings.
///
/// Callers that don't use the full request engine (SSE, OAuth, AI, monitor
/// webhooks) use this instead of `reqwest::Client::new()`, otherwise `off`
/// would be ignored there and those requests would still pick up environment
/// proxies.
pub(crate) fn client_with_proxy(
    proxy: Option<&crate::models::request::ProxyConfig>,
) -> Result<Client, HttpEngineError> {
    apply_proxy(Client::builder(), proxy)?
        .build()
        .map_err(|e| HttpEngineError::RequestError(format!("Failed to build HTTP client: {e}")))
}

/// Build a reqwest Client from request params.
pub fn build_client(params: &SendRequestParams) -> Result<Client, HttpEngineError> {
    let timeout = Duration::from_millis(params.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));

    let mut builder = Client::builder()
        .timeout(timeout)
        .redirect(if params.follow_redirects {
            reqwest::redirect::Policy::limited(10)
        } else {
            reqwest::redirect::Policy::none()
        })
        .cookie_store(true);

    if !params.verify_ssl {
        builder = builder.danger_accept_invalid_certs(true);
    }

    // Custom CA certificate
    if let Some(ca_path) = &params.ca_cert_path {
        if !ca_path.is_empty() {
            let ca_pem = std::fs::read(ca_path).map_err(|e| {
                HttpEngineError::RequestError(format!(
                    "Failed to read CA cert '{}': {}",
                    ca_path, e
                ))
            })?;
            let cert = reqwest::Certificate::from_pem(&ca_pem).map_err(|e| {
                HttpEngineError::RequestError(format!("Invalid CA certificate: {}", e))
            })?;
            builder = builder.add_root_certificate(cert);
        }
    }

    // Client certificate (mutual TLS)
    if let Some(cert_path) = &params.client_cert_path {
        if !cert_path.is_empty() {
            let cert_data = std::fs::read(cert_path).map_err(|e| {
                HttpEngineError::RequestError(format!(
                    "Failed to read client cert '{}': {}",
                    cert_path, e
                ))
            })?;

            // PEM format — combine cert + key into a single PEM buffer
            let mut pem_buf = cert_data;
            if let Some(key_path) = &params.client_key_path {
                if !key_path.is_empty() {
                    let key_data = std::fs::read(key_path).map_err(|e| {
                        HttpEngineError::RequestError(format!(
                            "Failed to read client key '{}': {}",
                            key_path, e
                        ))
                    })?;
                    pem_buf.push(b'\n');
                    pem_buf.extend_from_slice(&key_data);
                }
            }
            let identity = reqwest::Identity::from_pem(&pem_buf).map_err(|e| {
                HttpEngineError::RequestError(format!("Invalid PEM client certificate: {}", e))
            })?;
            builder = builder.identity(identity);
        }
    }

    builder = apply_proxy(builder, params.proxy.as_ref())?;

    builder
        .build()
        .map_err(|e| HttpEngineError::RequestError(format!("Failed to build HTTP client: {}", e)))
}

/// Build the full URL with query parameters appended.
pub fn build_url_with_params(
    base_url: &str,
    params: &[KeyValuePair],
    auth: &Option<AuthConfig>,
) -> Result<Url, HttpEngineError> {
    let mut url = Url::parse(base_url)
        .map_err(|e| HttpEngineError::InvalidUrl(format!("{}: {}", e, base_url)))?;

    // Add enabled query params
    {
        let mut query_pairs = url.query_pairs_mut();
        for param in params.iter().filter(|p| p.enabled && !p.key.is_empty()) {
            query_pairs.append_pair(&param.key, &param.value);
        }

        // Add API key to query if configured
        if let Some(AuthConfig::ApiKey {
            key,
            value,
            add_to: ApiKeyLocation::Query,
        }) = auth
        {
            query_pairs.append_pair(key, value);
        }
    }

    // Remove trailing `?` if no params were added
    if url.query() == Some("") {
        url.set_query(None);
    }

    Ok(url)
}

/// Build the reqwest RequestBuilder from our params.
pub fn build_request(
    client: &Client,
    params: &SendRequestParams,
) -> Result<RequestBuilder, HttpEngineError> {
    let url = build_url_with_params(&params.url, &params.params, &params.auth)?;
    let method = params.method.to_reqwest();

    let mut builder = client.request(method, url);

    // Apply headers
    for header in params
        .headers
        .iter()
        .filter(|h| h.enabled && !h.key.is_empty())
    {
        builder = builder.header(&header.key, &header.value);
    }

    // Apply auth
    builder = apply_auth(builder, &params.auth, params);

    // Apply body
    builder = apply_body(builder, &params.body)?;

    // Apply cookie overrides
    if let Some(cookies) = &params.cookies {
        let cookie_str = cookies
            .iter()
            .filter(|(_, v)| !v.is_empty())
            .map(|(k, v)| format!("{k}={v}"))
            .collect::<Vec<_>>()
            .join("; ");
        if !cookie_str.is_empty() {
            builder = builder.header("Cookie", cookie_str);
        }
    }

    Ok(builder)
}

/// Apply authentication to the request builder.
fn apply_auth(
    mut builder: RequestBuilder,
    auth: &Option<AuthConfig>,
    params: &SendRequestParams,
) -> RequestBuilder {
    match auth {
        Some(AuthConfig::Bearer { token }) => {
            builder = builder.bearer_auth(token);
        }
        Some(AuthConfig::Basic { username, password }) => {
            builder = builder.basic_auth(username, Some(password));
        }
        Some(AuthConfig::ApiKey {
            key,
            value,
            add_to: ApiKeyLocation::Header,
        }) => {
            builder = builder.header(key, value);
        }
        // ApiKey::Query is handled in build_url_with_params
        Some(AuthConfig::ApiKey {
            add_to: ApiKeyLocation::Query,
            ..
        }) => {}
        // OAuth2 is resolved before reaching here (converted to Bearer in interpolate_auth)
        Some(AuthConfig::Oauth2 { .. }) => {}
        // Digest auth — we store credentials; actual challenge-response is complex.
        // For now, pre-compute a digest header if realm/nonce are provided (from a prior 401).
        // In practice, most Digest flows need a two-step process; this provides the header
        // when the user supplies the nonce/realm manually.
        Some(AuthConfig::Digest { username, password }) => {
            // Digest is typically challenge-response. We use basic auth as fallback
            // so reqwest can handle the 401 challenge. For explicit digest, the user
            // would need to supply nonce/realm which we don't collect in the UI yet.
            builder = builder.basic_auth(username, Some(password));
        }
        Some(AuthConfig::AwsV4 {
            access_key,
            secret_key,
            region,
            service,
            session_token,
        }) => {
            let now = chrono::Utc::now();
            let url = build_url_with_params(&params.url, &params.params, &params.auth)
                .unwrap_or_else(|_| url::Url::parse("http://localhost").unwrap());
            let method = format!("{:?}", params.method);
            let headers: Vec<(String, String)> = params
                .headers
                .iter()
                .filter(|h| h.enabled && !h.key.is_empty())
                .map(|h| (h.key.clone(), h.value.clone()))
                .collect();
            let body_str = params
                .body
                .as_ref()
                .map(|b| b.content.as_str())
                .unwrap_or("");

            let (auth_header, extra_headers) = auth_handlers::compute_aws_v4_auth(
                access_key,
                secret_key,
                session_token,
                region,
                service,
                &method,
                &url,
                &headers,
                body_str,
                &now,
            );

            builder = builder.header("Authorization", auth_header);
            for (k, v) in extra_headers {
                builder = builder.header(k, v);
            }
        }
        Some(AuthConfig::JwtBearer {
            secret,
            algorithm,
            payload,
            header_prefix,
        }) => match auth_handlers::generate_jwt(secret, algorithm, payload) {
            Ok(token) => {
                let value = if header_prefix.is_empty() {
                    token
                } else {
                    format!("{header_prefix} {token}")
                };
                builder = builder.header("Authorization", value);
            }
            Err(e) => {
                tracing::warn!("JWT generation failed: {e}");
            }
        },
        Some(AuthConfig::Ntlm {
            domain,
            workstation,
            ..
        }) => {
            // First request sends Type 1 (Negotiate) message.
            // If we get a 401 with a Type 2 challenge, the caller handles retry with Type 3.
            let negotiate = auth_handlers::generate_ntlm_negotiate(domain, workstation);
            builder = builder.header("Authorization", format!("NTLM {negotiate}"));
        }
        Some(AuthConfig::Saml { saml_token, .. }) => {
            // SAML for API testing: the user obtains a SAML assertion/token from the IdP
            // externally (e.g. via browser SSO flow) and provides it here. We send it
            // as a Bearer token in the Authorization header.
            if !saml_token.is_empty() {
                builder = builder.header("Authorization", format!("Bearer {saml_token}"));
            }
        }
        Some(AuthConfig::None) | None => {}
    }
    builder
}

/// Apply request body.
fn apply_body(
    builder: RequestBuilder,
    body: &Option<RequestBody>,
) -> Result<RequestBuilder, HttpEngineError> {
    let body = match body {
        Some(b) => b,
        None => return Ok(builder),
    };

    match body.body_type {
        BodyType::Json => Ok(builder
            .header("Content-Type", "application/json")
            .body(body.content.clone())),
        BodyType::Xml => Ok(builder
            .header("Content-Type", "application/xml")
            .body(body.content.clone())),
        BodyType::Raw => Ok(builder
            .header("Content-Type", "text/plain")
            .body(body.content.clone())),
        BodyType::Urlencoded => {
            let pairs: Vec<(String, String)> = body
                .form_data
                .iter()
                .filter(|kv| kv.enabled && !kv.key.is_empty())
                .map(|kv| (kv.key.clone(), kv.value.clone()))
                .collect();
            Ok(builder.form(&pairs))
        }
        BodyType::FormData => {
            let mut form = reqwest::multipart::Form::new();
            for kv in body
                .form_data
                .iter()
                .filter(|kv| kv.enabled && !kv.key.is_empty())
            {
                if kv.value_type.as_deref() == Some("file") {
                    // Embed file content as a text field (no filename in Content-Disposition)
                    let content = std::fs::read_to_string(&kv.value).map_err(|e| {
                        HttpEngineError::RequestError(format!(
                            "Failed to read file '{}': {e}",
                            kv.value
                        ))
                    })?;
                    form = form.text(kv.key.clone(), content);
                } else {
                    form = form.text(kv.key.clone(), kv.value.clone());
                }
            }
            Ok(builder.multipart(form))
        }
        BodyType::Binary => Ok(builder
            .header("Content-Type", "application/octet-stream")
            .body(body.content.clone().into_bytes())),
        BodyType::None => Ok(builder),
    }
}

#[cfg(test)]
mod proxy_tests {
    use super::{build_client, client_with_proxy, normalize_bypass, split_host_port};
    use crate::models::request::{HttpMethod, ProxyConfig, SendRequestParams};
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::time::Duration;

    fn params(proxy: ProxyConfig, url: &str) -> SendRequestParams {
        SendRequestParams {
            method: HttpMethod::GET,
            url: url.to_string(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            proxy: Some(proxy),
            timeout_ms: Some(3_000),
            follow_redirects: true,
            verify_ssl: true,
            cookies: None,
            ca_cert_path: None,
            client_cert_path: None,
            client_key_path: None,
            client_cert_passphrase: None,
        }
    }

    /// Minimal HTTP proxy: reports the request line it received, then answers 200.
    fn fake_proxy() -> (u16, mpsc::Receiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut buf = [0u8; 1024];
                let read = stream.read(&mut buf).unwrap_or(0);
                let head = String::from_utf8_lossy(&buf[..read]).to_string();
                let _ = tx.send(head);
                let _ = stream.write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok",
                );
            }
        });
        (port, rx)
    }

    #[tokio::test]
    async fn requests_travel_through_the_configured_proxy() {
        let (proxy_port, rx) = fake_proxy();
        let proxy = ProxyConfig {
            mode: "on".into(),
            proxy_type: Some("http".into()),
            host: Some("127.0.0.1".into()),
            port: Some(proxy_port),
            bypass: None,
            username: Some("user".into()),
            password: Some("pass".into()),
        };
        let client = build_client(&params(proxy, "http://reqmate.invalid/hello")).unwrap();
        let response = client
            .get("http://reqmate.invalid/hello")
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);

        let head = rx
            .recv_timeout(Duration::from_secs(5))
            .expect("proxy got no request");
        assert!(
            head.starts_with("GET http://reqmate.invalid/hello"),
            "expected absolute-form request line, got: {head:?}"
        );
        assert!(
            head.to_lowercase().contains("proxy-authorization: basic"),
            "proxy credentials were not sent: {head:?}"
        );
    }

    #[tokio::test]
    async fn bypassed_hosts_skip_the_proxy() {
        let (proxy_port, rx) = fake_proxy();
        let proxy = ProxyConfig {
            mode: "on".into(),
            proxy_type: Some("http".into()),
            host: Some("127.0.0.1".into()),
            port: Some(proxy_port),
            bypass: Some("localhost, 127.0.0.1".into()),
            username: None,
            password: None,
        };
        let client = build_client(&params(proxy, "http://127.0.0.1:1/")).unwrap();
        // Port 1 is refused, and the bypass means it must not hit the proxy either.
        assert!(client.get("http://127.0.0.1:1/").send().await.is_err());
        assert!(
            rx.recv_timeout(Duration::from_millis(300)).is_err(),
            "bypassed request should not reach the proxy"
        );
    }

    #[test]
    fn plain_clients_build_in_every_proxy_mode() {
        // SSE / OAuth / AI / webhook clients all go through this helper; make
        // sure none of the three modes (or a missing config) can break them.
        for mode in ["off", "system", "on"] {
            let proxy = ProxyConfig {
                mode: mode.into(),
                proxy_type: Some("http".into()),
                host: Some("127.0.0.1".into()),
                port: Some(8080),
                bypass: None,
                username: None,
                password: None,
            };
            assert!(
                client_with_proxy(Some(&proxy)).is_ok(),
                "client should build in {mode} mode"
            );
        }
        assert!(client_with_proxy(None).is_ok());
    }

    #[test]
    fn socks5_proxy_client_builds() {
        let proxy = ProxyConfig {
            mode: "on".into(),
            proxy_type: Some("socks5".into()),
            host: Some("127.0.0.1".into()),
            port: Some(1080),
            bypass: None,
            username: None,
            password: None,
        };
        assert!(client_with_proxy(Some(&proxy)).is_ok());
    }

    #[test]
    fn bypass_list_accepts_newlines_commas_and_semicolons() {
        assert_eq!(
            normalize_bypass("localhost\n127.0.0.1, *.internal; example.com\n\n"),
            "localhost,127.0.0.1,*.internal,example.com"
        );
        assert_eq!(normalize_bypass("   \n  "), "");
    }

    #[test]
    fn host_parsing_strips_scheme_path_and_inline_port() {
        assert_eq!(
            split_host_port("proxy.internal"),
            ("proxy.internal".into(), None)
        );
        assert_eq!(
            split_host_port("10.0.0.2:3128"),
            ("10.0.0.2".into(), Some(3128))
        );
        assert_eq!(
            split_host_port("http://proxy.internal:8080/path"),
            ("proxy.internal".into(), Some(8080))
        );
        assert_eq!(
            split_host_port("  socks5://proxy.internal  "),
            ("proxy.internal".into(), None)
        );
    }

    #[test]
    fn ipv6_literals_keep_their_shape() {
        assert_eq!(split_host_port("[::1]:1080"), ("::1".into(), Some(1080)));
        assert_eq!(split_host_port("[::1]"), ("::1".into(), None));
    }
}
