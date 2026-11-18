use tauri::{AppHandle, State};

use crate::commands::history::AppState;
use crate::commands::settings::SettingsState;
use crate::http::cookies::CookieJarManager;
use crate::oauth::OAuthTokenStore;
use crate::runner::collection_runner;
use crate::runner::{RunConfig, RunSummary};

#[tauri::command]
pub async fn run_collection_command(
    app: AppHandle,
    state: State<'_, AppState>,
    oauth_store: State<'_, OAuthTokenStore>,
    cookie_jar: State<'_, CookieJarManager>,
    settings_state: State<'_, SettingsState>,
    config: RunConfig,
) -> Result<RunSummary, String> {
    let history_db = state.history_db.clone();
    // Honour the same proxy configuration as a single request does.
    let proxy = settings_state
        .settings
        .lock()
        .map(|s| s.proxy_config())
        .ok();
    collection_runner::run_collection(app, config, history_db, &oauth_store, &cookie_jar, proxy)
        .await
}
