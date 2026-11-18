pub mod collection_runner;
pub mod data_reader;

use serde::{Deserialize, Serialize};

use crate::models::request::ProxyConfig;

/// Network behaviour for requests started by the collection runner / monitor.
///
/// A single request from the editor reads these straight from the settings
/// store; runs and monitors used to hard-code them. Keeping them together
/// makes every outbound request honour the same proxy, redirect and TLS rules.
#[derive(Debug, Clone)]
pub struct NetworkOptions {
    pub proxy: Option<ProxyConfig>,
    pub follow_redirects: bool,
    pub verify_ssl: bool,
}

impl NetworkOptions {
    pub fn from_settings(settings: &crate::storage::settings::AppSettings) -> Self {
        Self {
            proxy: Some(settings.proxy_config()),
            follow_redirects: settings.follow_redirects,
            verify_ssl: settings.verify_ssl,
        }
    }
}

impl Default for NetworkOptions {
    fn default() -> Self {
        Self {
            proxy: None,
            follow_redirects: true,
            verify_ssl: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunConfig {
    pub collection_path: String,
    pub folder_path: Option<String>,
    pub environment_name: Option<String>,
    pub delay_ms: u64,
    pub iterations: u32,
    pub data_file: Option<String>,
    pub stop_on_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestRunResult {
    pub name: String,
    pub method: String,
    pub url: String,
    pub status: Option<u16>,
    pub time_ms: Option<u64>,
    pub passed: bool,
    pub test_count: usize,
    pub test_passed: usize,
    pub assertion_count: usize,
    pub assertion_passed: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IterationResult {
    pub iteration: u32,
    pub results: Vec<RequestRunResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSummary {
    pub total_requests: usize,
    pub total_passed: usize,
    pub total_failed: usize,
    pub total_time_ms: u64,
    pub iterations: Vec<IterationResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunProgress {
    pub run_id: String,
    pub iteration: u32,
    pub request_index: usize,
    pub total_requests: usize,
    pub result: RequestRunResult,
}
