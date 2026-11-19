use std::time::Instant;

use url::Url;

use crate::models::error::HttpEngineError;
use crate::models::request::{HttpMethod, KeyValuePair, SendRequestParams};
use crate::models::response::{CookieData, ResponseData};

use super::error_classifier::classify_reqwest_error;
use super::request_builder::{build_client, build_request};
use super::response_parser::{parse_response, parse_set_cookie_header};

/// Core HTTP engine. Executes a request and returns the response.
pub struct HttpEngine;

/// Maximum number of redirects to follow manually.
const MAX_REDIRECTS: usize = 10;

/// How the next hop of a redirect chain must be sent.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RedirectMode {
    /// Repeat the method (and body) of the previous request.
    Preserve,
    /// Downgrade to GET and drop the body (HEAD stays HEAD).
    DowngradeToGet,
}

/// Decide how to follow a redirect, per RFC 9110 §15.4.
///
/// - `307` / `308` must not change the method or the body.
/// - `303` asks for a GET, whatever the original method was.
/// - `301` / `302` only downgrade `POST` to `GET`; other methods are preserved,
///   which is what browsers and curl do.
pub fn redirect_mode(status: u16, method: &HttpMethod) -> RedirectMode {
    match status {
        307 | 308 => RedirectMode::Preserve,
        303 => RedirectMode::DowngradeToGet,
        301 | 302 => match method {
            HttpMethod::POST => RedirectMode::DowngradeToGet,
            _ => RedirectMode::Preserve,
        },
        _ => RedirectMode::Preserve,
    }
}

impl HttpEngine {
    /// Send an HTTP request and return the parsed response.
    ///
    /// Redirects are followed manually so that `Set-Cookie` headers from every
    /// hop can be captured, and so that method/body semantics per status code
    /// are respected (reqwest would otherwise always downgrade to GET).
    pub async fn send(params: SendRequestParams) -> Result<ResponseData, HttpEngineError> {
        let timeout_ms = params.timeout_ms.unwrap_or(30_000);
        let should_follow_redirects = params.follow_redirects;

        // Always disable automatic redirects on the client — we handle them here.
        let mut current = params;
        current.follow_redirects = false;

        let client = build_client(&current)?;

        let start = Instant::now();

        let mut response = build_request(&client, &current)?
            .send()
            .await
            .map_err(|e| classify_reqwest_error(e, timeout_ms))?;

        // Accumulate cookies from all responses in the redirect chain
        let mut all_cookies: Vec<CookieData> = Vec::with_capacity(4);
        let mut redirect_count = 0;

        while should_follow_redirects
            && response.status().is_redirection()
            && redirect_count < MAX_REDIRECTS
        {
            // Capture Set-Cookie headers from this redirect response
            collect_set_cookie_headers(&response, &mut all_cookies);

            let status = response.status().as_u16();

            // Without a Location header there is nothing to follow
            let Some(location) = response
                .headers()
                .get("location")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
            else {
                break;
            };

            let next_url = resolve_location(response.url().as_str(), &location);

            // 303 (and 301/302 after a POST) downgrade to GET and drop the body.
            // 307/308 keep both, which is the whole point of those status codes.
            if redirect_mode(status, &current.method) == RedirectMode::DowngradeToGet {
                if !matches!(current.method, HttpMethod::HEAD) {
                    current.method = HttpMethod::GET;
                }
                current.body = None;
            }

            // Credentials must not follow a redirect to a different origin.
            if origin_of(&current.url) != origin_of(&next_url) {
                current.headers.retain(|h| !is_sensitive_header(&h.key));
                current.auth = None;
                current.cookies = None;
                // The cookies harvested from the previous origin must not be
                // attached below either — otherwise the header we just stripped
                // is rebuilt from `all_cookies` and sent to the new host.
                all_cookies.clear();
            }

            current.url = next_url;
            // Query parameters belonged to the original URL only.
            current.params.clear();

            // Send the cookies accumulated so far on the next hop
            let cookie_header = all_cookies
                .iter()
                .map(|c| format!("{}={}", c.name, c.value))
                .collect::<Vec<_>>()
                .join("; ");
            if !cookie_header.is_empty() {
                set_header(&mut current.headers, "Cookie", cookie_header);
            }

            response = build_request(&client, &current)?
                .send()
                .await
                .map_err(|e| classify_reqwest_error(e, timeout_ms))?;

            redirect_count += 1;
        }

        // Capture cookies from the final response too
        collect_set_cookie_headers(&response, &mut all_cookies);

        let elapsed_ms = start.elapsed().as_millis() as u64;

        let mut result = parse_response(response, elapsed_ms).await?;

        // Merge accumulated cookies into the result (dedup by name)
        for cookie in all_cookies {
            if !result.cookies.iter().any(|c| c.name == cookie.name) {
                result.cookies.push(cookie);
            }
        }

        Ok(result)
    }
}

/// Resolve a `Location` header value (absolute or relative) against the URL
/// that produced it.
fn resolve_location(base: &str, location: &str) -> String {
    match Url::parse(base).and_then(|b| b.join(location)) {
        Ok(url) => url.to_string(),
        // Fall back to the raw value so the failure surfaces as a request error
        // with a readable URL instead of being swallowed here.
        Err(_) => location.to_string(),
    }
}

/// Scheme + host + port, used to decide whether credentials may follow a redirect.
fn origin_of(raw_url: &str) -> Option<String> {
    Url::parse(raw_url)
        .ok()
        .map(|url| url.origin().ascii_serialization())
}

/// Headers that must be dropped when a redirect crosses origins.
fn is_sensitive_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "authorization" | "proxy-authorization" | "cookie" | "cookie2"
    )
}

/// Set (or replace) a header in the request header list.
fn set_header(headers: &mut Vec<KeyValuePair>, key: &str, value: String) {
    if let Some(existing) = headers.iter_mut().find(|h| h.key.eq_ignore_ascii_case(key)) {
        existing.value = value;
        existing.enabled = true;
    } else {
        headers.push(KeyValuePair::new(key.to_string(), value, true));
    }
}

/// Extract Set-Cookie headers from a response and add to the cookie list.
fn collect_set_cookie_headers(response: &reqwest::Response, cookies: &mut Vec<CookieData>) {
    let url = response.url().clone();
    for value in response.headers().get_all("set-cookie").iter() {
        if let Ok(val) = value.to_str() {
            if let Some(cookie) = parse_set_cookie_header(val, &url) {
                // Update existing cookie or add new one
                if let Some(existing) = cookies.iter_mut().find(|c| c.name == cookie.name) {
                    *existing = cookie;
                } else {
                    cookies.push(cookie);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ─── Redirect method semantics ───────────────────────────────────────

    #[test]
    fn temp_redirect_preserves_post_method_and_body() {
        assert_eq!(
            redirect_mode(307, &HttpMethod::POST),
            RedirectMode::Preserve
        );
        assert_eq!(
            redirect_mode(308, &HttpMethod::POST),
            RedirectMode::Preserve
        );
    }

    #[test]
    fn permanent_redirect_preserves_put_patch_delete() {
        for status in [301, 302, 307, 308] {
            for method in [HttpMethod::PUT, HttpMethod::PATCH, HttpMethod::DELETE] {
                assert_eq!(
                    redirect_mode(status, &method),
                    RedirectMode::Preserve,
                    "status {status} should preserve the method"
                );
            }
        }
    }

    #[test]
    fn moved_permanently_downgrades_post_to_get() {
        assert_eq!(
            redirect_mode(301, &HttpMethod::POST),
            RedirectMode::DowngradeToGet
        );
        assert_eq!(
            redirect_mode(302, &HttpMethod::POST),
            RedirectMode::DowngradeToGet
        );
    }

    #[test]
    fn see_other_always_downgrades() {
        for method in [
            HttpMethod::POST,
            HttpMethod::PUT,
            HttpMethod::PATCH,
            HttpMethod::DELETE,
        ] {
            assert_eq!(
                redirect_mode(303, &method),
                RedirectMode::DowngradeToGet,
                "303 should downgrade {method:?}"
            );
        }
    }

    // ─── Location resolution ─────────────────────────────────────────────

    #[test]
    fn resolves_relative_location_against_base() {
        assert_eq!(
            resolve_location("https://api.test/v1/users/1", "../roles"),
            "https://api.test/v1/roles"
        );
        assert_eq!(
            resolve_location("https://api.test/v1/users/1", "/login"),
            "https://api.test/login"
        );
        assert_eq!(
            resolve_location("https://api.test/a", "https://other.test/b"),
            "https://other.test/b"
        );
    }

    #[test]
    fn keeps_unparseable_location_verbatim() {
        assert_eq!(resolve_location("not-a-url", "//x"), "//x");
    }

    // ─── Credential scoping ──────────────────────────────────────────────

    #[test]
    fn same_origin_ignores_path_and_query() {
        assert_eq!(
            origin_of("https://api.test/a?b=1"),
            origin_of("https://api.test/c/d")
        );
        assert_ne!(
            origin_of("https://api.test/a"),
            origin_of("https://api.test:8443/a")
        );
        assert_ne!(
            origin_of("https://api.test/a"),
            origin_of("http://api.test/a")
        );
        assert_ne!(
            origin_of("https://api.test/a"),
            origin_of("https://evil.test/a")
        );
    }

    #[test]
    fn sensitive_headers_are_recognised_case_insensitively() {
        assert!(is_sensitive_header("Authorization"));
        assert!(is_sensitive_header("authorization"));
        assert!(is_sensitive_header("COOKIE"));
        assert!(is_sensitive_header("Proxy-Authorization"));
        assert!(!is_sensitive_header("X-Api-Key"));
        assert!(!is_sensitive_header("Cookie-Jar"));
    }

    #[test]
    fn set_header_replaces_existing_case_insensitively() {
        let mut headers = vec![KeyValuePair::new("cookie".into(), "old=1".into(), true)];
        set_header(&mut headers, "Cookie", "new=2".into());
        assert_eq!(headers.len(), 1);
        assert_eq!(headers[0].value, "new=2");
        assert!(headers[0].enabled);

        set_header(&mut headers, "X-Trace", "abc".into());
        assert_eq!(headers.len(), 2);
    }

    #[test]
    fn set_header_reenables_a_disabled_header() {
        let mut headers = vec![KeyValuePair::new("Cookie".into(), "old=1".into(), false)];
        set_header(&mut headers, "Cookie", "new=2".into());
        assert_eq!(headers.len(), 1);
        assert!(headers[0].enabled);
        assert_eq!(headers[0].value, "new=2");
    }
}
