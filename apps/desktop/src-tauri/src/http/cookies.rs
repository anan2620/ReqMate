use std::collections::HashMap;
use std::sync::RwLock;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CookieEntry {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
    pub expires: Option<String>,
    pub http_only: bool,
    pub secure: bool,
    pub same_site: Option<String>,
}

/// Per-collection cookie jar. Stores cookies in memory with optional persistence.
pub struct CookieJarManager {
    /// Map of collection_path -> list of cookies
    jars: RwLock<HashMap<String, Vec<CookieEntry>>>,
}

impl CookieJarManager {
    pub fn new() -> Self {
        Self {
            jars: RwLock::new(HashMap::new()),
        }
    }

    /// Get all cookies for a collection.
    pub fn get_cookies(&self, collection_path: &str) -> Result<Vec<CookieEntry>, String> {
        let jars = self.jars.read().map_err(|e| format!("Lock error: {e}"))?;
        Ok(jars.get(collection_path).cloned().unwrap_or_default())
    }

    /// Store cookies from a response's Set-Cookie headers.
    pub fn store_cookies(
        &self,
        collection_path: &str,
        cookies: Vec<CookieEntry>,
    ) -> Result<(), String> {
        let mut jars = self.jars.write().map_err(|e| format!("Lock error: {e}"))?;
        let jar = jars.entry(collection_path.to_string()).or_default();

        for new_cookie in cookies {
            // Replace existing cookie with same name+domain+path
            if let Some(existing) = jar.iter_mut().find(|c| {
                c.name == new_cookie.name
                    && c.domain == new_cookie.domain
                    && c.path == new_cookie.path
            }) {
                *existing = new_cookie;
            } else {
                jar.push(new_cookie);
            }
        }

        Ok(())
    }

    /// Delete a specific cookie.
    pub fn delete_cookie(
        &self,
        collection_path: &str,
        name: &str,
        domain: &str,
    ) -> Result<(), String> {
        let mut jars = self.jars.write().map_err(|e| format!("Lock error: {e}"))?;
        if let Some(jar) = jars.get_mut(collection_path) {
            jar.retain(|c| !(c.name == name && c.domain == domain));
        }
        Ok(())
    }

    /// Clear all cookies for a collection.
    pub fn clear_jar(&self, collection_path: &str) -> Result<(), String> {
        let mut jars = self.jars.write().map_err(|e| format!("Lock error: {e}"))?;
        jars.remove(collection_path);
        Ok(())
    }

    /// Save cookie jar to disk for persistence.
    pub fn save_to_disk(&self, collection_path: &str) -> Result<(), String> {
        let jars = self.jars.read().map_err(|e| format!("Lock error: {e}"))?;
        let cookies = jars.get(collection_path).cloned().unwrap_or_default();

        let cookies_dir = dirs::home_dir()
            .ok_or("Could not determine home directory")?
            .join(".reqmate")
            .join("cookies");

        std::fs::create_dir_all(&cookies_dir)
            .map_err(|e| format!("Failed to create cookies dir: {e}"))?;

        // Use a hash of collection path as filename
        let hash = simple_hash(collection_path);
        let path = cookies_dir.join(format!("{hash}.json"));

        let json = serde_json::to_string_pretty(&cookies)
            .map_err(|e| format!("Failed to serialize cookies: {e}"))?;

        std::fs::write(&path, json).map_err(|e| format!("Failed to write cookies: {e}"))?;

        Ok(())
    }

    /// Load cookie jar from disk.
    pub fn load_from_disk(&self, collection_path: &str) -> Result<(), String> {
        let cookies_dir = dirs::home_dir()
            .ok_or("Could not determine home directory")?
            .join(".reqmate")
            .join("cookies");

        let hash = simple_hash(collection_path);
        let path = cookies_dir.join(format!("{hash}.json"));

        if !path.exists() {
            return Ok(());
        }

        let json =
            std::fs::read_to_string(&path).map_err(|e| format!("Failed to read cookies: {e}"))?;

        let cookies: Vec<CookieEntry> =
            serde_json::from_str(&json).map_err(|e| format!("Failed to parse cookies: {e}"))?;

        let mut jars = self.jars.write().map_err(|e| format!("Lock error: {e}"))?;
        jars.insert(collection_path.to_string(), cookies);

        Ok(())
    }
}

fn simple_hash(s: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// RFC 6265 domain matching for sending a stored cookie to `host`.
///
/// A plain `host.ends_with(cookie_domain)` check is wrong: `evilexample.com`
/// ends with `example.com`, so a cookie for one site would leak to a lookalike
/// domain. Matching must respect the `.` label boundary.
pub fn domain_matches(host: &str, cookie_domain: &str) -> bool {
    let host = host.trim().trim_end_matches('.').to_ascii_lowercase();
    let domain = cookie_domain
        .trim()
        .trim_start_matches('.')
        .trim_end_matches('.')
        .to_ascii_lowercase();

    // Cookies stored without a domain can't be scoped safely — don't send them.
    if host.is_empty() || domain.is_empty() {
        return false;
    }

    host == domain || host.ends_with(&format!(".{domain}"))
}

#[cfg(test)]
mod tests {
    use super::domain_matches;

    #[test]
    fn exact_host_and_subdomains_match() {
        assert!(domain_matches("example.com", "example.com"));
        assert!(domain_matches("api.example.com", "example.com"));
        assert!(domain_matches("api.example.com", ".example.com"));
        assert!(domain_matches("Example.COM", "example.com"));
    }

    #[test]
    fn lookalike_domains_do_not_match() {
        assert!(!domain_matches("evilexample.com", "example.com"));
        assert!(!domain_matches("example.com.evil.net", "example.com"));
        assert!(!domain_matches("notexample.com", ".example.com"));
    }

    #[test]
    fn unrelated_or_empty_domains_do_not_match() {
        assert!(!domain_matches("example.org", "example.com"));
        assert!(!domain_matches("example.com", ""));
        assert!(!domain_matches("", "example.com"));
    }
}
