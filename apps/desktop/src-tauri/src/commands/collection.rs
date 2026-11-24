use std::path::{Path, PathBuf};

use crate::models::collection::{
    CollectionConfig, CollectionDefaults, CollectionNode, RequestFile,
};
use crate::models::request::HttpMethod;
use crate::storage::collection;

#[tauri::command]
pub async fn get_collection_defaults(
    collection_path: String,
) -> Result<CollectionDefaults, String> {
    let path = collection_path.clone();
    tokio::task::spawn_blocking(move || {
        let config = collection::load_collection_config(Path::new(&path))?;
        Ok(config.defaults)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn update_collection_defaults(
    collection_path: String,
    defaults: CollectionDefaults,
) -> Result<(), String> {
    let path = collection_path.clone();
    tokio::task::spawn_blocking(move || {
        let mut config = collection::load_collection_config(Path::new(&path))?;
        config.defaults = defaults;
        collection::save_collection_config(Path::new(&path), &config)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn open_collection(path: String) -> Result<CollectionNode, String> {
    tracing::info!(path = %path, "Opening collection");
    tokio::task::spawn_blocking(move || {
        let collection_path = Path::new(&path);
        // A folder of requests whose `.reqmate` metadata went missing (sync
        // tools dropping hidden directories, a hand-copied collection, …) is
        // repaired instead of refused.
        if collection::ensure_collection_metadata(collection_path)? {
            tracing::warn!(
                path = %path,
                "Collection metadata was missing — created .reqmate/reqmate.yaml"
            );
        }
        collection::load_collection_tree(collection_path)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn read_request_file(path: String) -> Result<RequestFile, String> {
    tracing::debug!(path = %path, "Reading request file");
    tokio::task::spawn_blocking(move || {
        let file_path = Path::new(&path);
        collection::read_request(file_path)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn save_request_file(
    path: String,
    mut request: RequestFile,
    assert_yaml: Option<String>,
) -> Result<(), String> {
    tracing::debug!(path = %path, "Saving request file");

    merge_assertions(&mut request, assert_yaml)?;

    tokio::task::spawn_blocking(move || {
        let file_path = Path::new(&path);
        collection::write_request(file_path, &request)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn create_request(
    dir: String,
    filename: String,
    name: String,
    method: HttpMethod,
    url: String,
) -> Result<String, String> {
    let dir_path = Path::new(&dir);
    let request = RequestFile {
        name,
        method,
        url,
        protocol: None,
        description: None,
        headers: Default::default(),
        auth: None,
        body: None,
        params: None,
        assert: None,
        tests: None,
        pre_request_script: None,
        post_response_script: None,
        cookies: None,
    };
    let path = collection::create_request_file(dir_path, &filename, &request)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_folder(parent: String, name: String) -> Result<String, String> {
    let parent_path = Path::new(&parent);
    let path = collection::create_folder(parent_path, &name)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_item(path: String, collection_name: String) -> Result<String, String> {
    let item_path = Path::new(&path);
    tracing::info!(path = %path, "Deleting item (moving to trash)");
    collection::delete_item(item_path, &collection_name)
}

#[tauri::command]
pub async fn save_folder_order(dir: String, order: Vec<String>) -> Result<(), String> {
    let dir_path = Path::new(&dir);
    tracing::debug!(dir = %dir, "Saving folder order");
    collection::save_folder_order(dir_path, &order)
}

#[tauri::command]
pub async fn rename_item(path: String, new_name: String) -> Result<String, String> {
    let item_path = Path::new(&path);
    tracing::info!(path = %path, new_name = %new_name, "Renaming item");
    let new_path = collection::rename_item(item_path, &new_name)?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_sample_collection() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let base = home.join("ReqMate").join("getting-started");

    if base.join(".reqmate").join("reqmate.yaml").exists() {
        return Ok(base.to_string_lossy().to_string());
    }

    // Create directory structure
    let reqmate_dir = base.join(".reqmate");
    let env_dir = reqmate_dir.join("environments");
    let basics_dir = base.join("basics");

    for d in [&reqmate_dir, &env_dir, &basics_dir] {
        std::fs::create_dir_all(d).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    // Collection config
    let config = CollectionConfig {
        name: "Getting Started".to_string(),
        version: 1,
        defaults: Default::default(),
    };
    let config_yaml =
        serde_yaml::to_string(&config).map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(reqmate_dir.join("reqmate.yaml"), config_yaml)
        .map_err(|e| format!("Failed to write config: {e}"))?;

    // Default environment
    std::fs::write(
        env_dir.join("default.yaml"),
        "name: Default\nvariables:\n  baseUrl: https://httpbin.org\n",
    )
    .map_err(|e| format!("Failed to write env: {e}"))?;

    // .gitignore (inside .reqmate/)
    std::fs::write(reqmate_dir.join(".gitignore"), ".env\n")
        .map_err(|e| format!("Failed to write .gitignore: {e}"))?;

    // Root .gitignore (covers collection root .env file)
    let root_gitignore = base.join(".gitignore");
    if !root_gitignore.exists() {
        std::fs::write(&root_gitignore, ".env\n.env.local\n")
            .map_err(|e| format!("Failed to write root .gitignore: {e}"))?;
    }

    // Sample requests
    write_sample(&basics_dir.join("simple-get.yaml"),
        "name: Simple GET\nmethod: GET\nurl: \"{{baseUrl}}/get\"\ndescription: A basic GET request to httpbin.org\n"
    )?;

    write_sample(&basics_dir.join("post-json.yaml"),
        "name: POST JSON\nmethod: POST\nurl: \"{{baseUrl}}/post\"\ndescription: Send a JSON body to httpbin.org\nbody:\n  type: json\n  content: |\n    {\n      \"name\": \"ReqMate\",\n      \"version\": \"1.0\"\n    }\n"
    )?;

    write_sample(&basics_dir.join("with-auth.yaml"),
        "name: Bearer Auth\nmethod: GET\nurl: \"{{baseUrl}}/bearer\"\ndescription: GET request with Bearer token authentication\nauth:\n  type: bearer\n  token: my-secret-token\n"
    )?;

    write_sample(&basics_dir.join("query-params.yaml"),
        "name: Query Parameters\nmethod: GET\nurl: \"{{baseUrl}}/get\"\ndescription: GET request with query parameters\nparams:\n  page: \"1\"\n  limit: \"10\"\n  search: hello\n"
    )?;

    Ok(base.to_string_lossy().to_string())
}

fn write_sample(path: &PathBuf, content: &str) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| format!("Failed to write {}: {e}", path.display()))
}

/// Apply the assertions editor text to a request before it is written.
///
/// The editor is free-form YAML, so parsing happens here (the frontend has no
/// YAML parser). An empty string clears the block; `None` leaves
/// `request.assert` untouched, which is what a caller that merely echoes the
/// file should do.
fn merge_assertions(request: &mut RequestFile, assert_yaml: Option<String>) -> Result<(), String> {
    let Some(raw) = assert_yaml else {
        return Ok(());
    };
    if raw.trim().is_empty() {
        request.assert = None;
        return Ok(());
    }
    let parsed = serde_yaml::from_str::<serde_yaml::Value>(&raw)
        .map_err(|e| format!("Invalid assertions YAML: {e}"))?;
    request.assert = Some(parsed);
    Ok(())
}

#[tauri::command]
pub async fn create_collection(parent_dir: String, name: String) -> Result<String, String> {
    let folder_name = name
        .trim()
        .to_lowercase()
        .replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "-");
    if folder_name.is_empty() {
        return Err("Collection name cannot be empty".to_string());
    }

    // An empty parent means "use the default location from Settings" — the
    // frontend no longer asks for a location when creating a collection.
    let parent = match parent_dir.trim() {
        "" => PathBuf::from(crate::storage::settings::default_collection_root()),
        dir => PathBuf::from(dir),
    };
    std::fs::create_dir_all(&parent)
        .map_err(|e| format!("Failed to create directory {}: {e}", parent.display()))?;

    let base = parent.join(&folder_name);
    if base.join(".reqmate").join("reqmate.yaml").exists() {
        return Err(format!("Collection already exists at {}", base.display()));
    }

    let reqmate_dir = base.join(".reqmate");
    let env_dir = reqmate_dir.join("environments");

    for d in [&reqmate_dir, &env_dir] {
        std::fs::create_dir_all(d).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    let config = CollectionConfig {
        name: name.trim().to_string(),
        version: 1,
        defaults: Default::default(),
    };
    let config_yaml =
        serde_yaml::to_string(&config).map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(reqmate_dir.join("reqmate.yaml"), config_yaml)
        .map_err(|e| format!("Failed to write config: {e}"))?;

    // Default environment
    std::fs::write(
        env_dir.join("default.yaml"),
        "name: Default\nvariables:\n  baseUrl: http://localhost:3000\n",
    )
    .map_err(|e| format!("Failed to write env: {e}"))?;

    // .gitignore
    std::fs::write(reqmate_dir.join(".gitignore"), ".env\n")
        .map_err(|e| format!("Failed to write .gitignore: {e}"))?;

    let root_gitignore = base.join(".gitignore");
    if !root_gitignore.exists() {
        std::fs::write(&root_gitignore, ".env\n.env.local\n")
            .map_err(|e| format!("Failed to write root .gitignore: {e}"))?;
    }

    Ok(base.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn blank_request() -> RequestFile {
        RequestFile {
            name: "r".to_string(),
            method: HttpMethod::GET,
            url: "https://api.test".to_string(),
            protocol: None,
            description: None,
            headers: Default::default(),
            auth: None,
            body: None,
            params: None,
            assert: None,
            tests: None,
            pre_request_script: None,
            post_response_script: None,
            cookies: None,
        }
    }

    #[test]
    fn assertion_text_is_parsed_into_the_yaml_value() {
        let mut request = blank_request();
        merge_assertions(
            &mut request,
            Some("status: 200\nheaders:\n  content-type: json".into()),
        )
        .unwrap();

        let value = request.assert.expect("assert set");
        assert_eq!(value["status"], serde_yaml::Value::Number(200.into()));
    }

    #[test]
    fn empty_assertion_text_clears_the_block() {
        let mut request = blank_request();
        request.assert = Some(serde_yaml::Value::String("old".into()));
        merge_assertions(&mut request, Some("   ".into())).unwrap();
        assert!(request.assert.is_none());
    }

    #[test]
    fn missing_assertion_text_keeps_whatever_was_there() {
        let mut request = blank_request();
        request.assert = Some(serde_yaml::Value::String("kept".into()));
        merge_assertions(&mut request, None).unwrap();
        assert!(request.assert.is_some());
    }

    #[test]
    fn invalid_assertion_yaml_is_reported() {
        let mut request = blank_request();
        let err = merge_assertions(&mut request, Some("status: [".into())).unwrap_err();
        assert!(err.contains("Invalid assertions YAML"), "{err}");
    }
}
