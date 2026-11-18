use tauri::{AppHandle, State};

use crate::commands::history::AppState;
use crate::commands::settings::SettingsState;
use crate::http::cookies::CookieJarManager;
use crate::oauth::OAuthTokenStore;
use crate::runner::collection_runner;
use crate::runner::{NetworkOptions, RunConfig, RunSummary};

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
    // A collection run must behave exactly like a single request from the
    // editor: same proxy, redirect and TLS-verification settings.
    let network = settings_state
        .settings
        .lock()
        .map(|s| NetworkOptions::from_settings(&s))
        .unwrap_or_default();
    collection_runner::run_collection(app, config, history_db, &oauth_store, &cookie_jar, &network)
        .await
}
