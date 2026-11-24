use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use crate::models::collection::{
    CollectionConfig, CollectionNode, FolderConfig, RequestFile, RequestMeta,
};

/// Directory holding collection metadata.
pub const CONFIG_DIR: &str = ".reqmate";
/// Metadata file inside [`CONFIG_DIR`].
pub const CONFIG_FILE: &str = "reqmate.yaml";

/// Path of the collection metadata file (`.reqmate/reqmate.yaml`).
pub fn config_file_path(collection_path: &Path) -> PathBuf {
    collection_path.join(CONFIG_DIR).join(CONFIG_FILE)
}

/// Load a collection tree from a directory containing `.reqmate/reqmate.yaml`.
pub fn load_collection_tree(collection_path: &Path) -> Result<CollectionNode, String> {
    let config_path = config_file_path(collection_path);
    if !config_path.exists() {
        return Err(not_a_collection_message(collection_path));
    }

    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read collection config: {e}"))?;
    let config: CollectionConfig = serde_yaml::from_str(&config_content)
        .map_err(|e| format!("Invalid collection config YAML: {e}"))?;

    let children = scan_directory(collection_path)?;

    Ok(CollectionNode::Collection {
        name: config.name,
        path: collection_path.to_string_lossy().to_string(),
        children,
    })
}

/// Recursively scan a directory for request YAML files and subfolders.
fn scan_directory(dir: &Path) -> Result<Vec<CollectionNode>, String> {
    // Track canonical paths so a symlink pointing at an ancestor (a loop) does
    // not recurse forever and blow the stack.
    let mut visited = HashSet::new();
    scan_directory_inner(dir, &mut visited)
}

fn scan_directory_inner(
    dir: &Path,
    visited: &mut HashSet<PathBuf>,
) -> Result<Vec<CollectionNode>, String> {
    // `canonicalize` fails on exotic paths; fall back to the literal path so a
    // read error there can never wedge the scan.
    let identity = fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf());
    if !visited.insert(identity) {
        tracing::warn!(
            "Skipping {} — already visited (symlink loop?)",
            dir.display()
        );
        return Ok(Vec::new());
    }

    let mut folders = Vec::new();
    let mut requests = Vec::new();

    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {e}", dir.display()))?;

    // Check for folder ordering
    let folder_config = load_folder_config(dir);
    let order_map: HashMap<String, usize> = folder_config
        .as_ref()
        .map(|fc| {
            fc.order
                .iter()
                .enumerate()
                .map(|(i, name)| (name.clone(), i))
                .collect()
        })
        .unwrap_or_default();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read dir entry: {e}"))?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden dirs/files and special files
        if file_name.starts_with('.') || file_name == "_folder.yaml" {
            continue;
        }

        if path.is_dir() {
            let folder_name = file_name.clone();

            let children = scan_directory_inner(&path, visited)?;
            folders.push((
                order_map.get(&file_name).copied().unwrap_or(usize::MAX),
                CollectionNode::Folder {
                    name: folder_name,
                    path: path.to_string_lossy().to_string(),
                    children,
                },
            ));
        } else if file_name.ends_with(".yaml") || file_name.ends_with(".yml") {
            match read_request_meta(&path) {
                Ok(meta) => {
                    let stem = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let detected = meta.detect_protocol();
                    let is_gql = detected == Some("graphql");
                    let protocol = detected.map(|s| s.to_string());
                    requests.push((
                        order_map.get(&stem).copied().unwrap_or(usize::MAX),
                        CollectionNode::Request {
                            name: meta.name,
                            is_graphql: is_gql,
                            method: meta.method,
                            path: path.to_string_lossy().to_string(),
                            protocol,
                        },
                    ));
                }
                Err(e) => {
                    tracing::warn!("Skipping invalid request file {}: {e}", path.display());
                }
            }
        }
    }

    // Sort: folders first (by order then alpha), then requests (by order then alpha)
    folders.sort_by(|a, b| {
        a.0.cmp(&b.0)
            .then_with(|| node_name(&a.1).cmp(node_name(&b.1)))
    });
    requests.sort_by(|a, b| {
        a.0.cmp(&b.0)
            .then_with(|| node_name(&a.1).cmp(node_name(&b.1)))
    });

    let mut result: Vec<CollectionNode> = folders.into_iter().map(|(_, n)| n).collect();
    result.extend(requests.into_iter().map(|(_, n)| n));
    Ok(result)
}

fn node_name(node: &CollectionNode) -> &str {
    match node {
        CollectionNode::Collection { name, .. }
        | CollectionNode::Folder { name, .. }
        | CollectionNode::Request { name, .. } => name,
    }
}

fn load_folder_config(dir: &Path) -> Option<FolderConfig> {
    let path = dir.join("_folder.yaml");
    if !path.exists() {
        return None;
    }
    let content = fs::read_to_string(&path).ok()?;
    serde_yaml::from_str(&content).ok()
}

/// Read only name + method from a request YAML (lightweight).
fn read_request_meta(path: &Path) -> Result<RequestMeta, String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {e}", path.display()))?;
    serde_yaml::from_str::<RequestMeta>(&content)
        .map_err(|e| format!("Invalid request YAML {}: {e}", path.display()))
}

/// Check if a file contains Git merge conflict markers.
fn has_merge_conflicts(content: &str) -> bool {
    content.contains("<<<<<<<") && content.contains(">>>>>>>")
}

/// Read the full request file.
pub fn read_request(path: &Path) -> Result<RequestFile, String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {e}", path.display()))?;
    if has_merge_conflicts(&content) {
        return Err(format!("MERGE_CONFLICT:{}", path.display()));
    }
    serde_yaml::from_str::<RequestFile>(&content)
        .map_err(|e| format!("Invalid request YAML {}: {e}", path.display()))
}

/// Write a request file atomically (write to .tmp, then rename).
pub fn write_request(path: &Path, request: &RequestFile) -> Result<(), String> {
    let yaml =
        serde_yaml::to_string(request).map_err(|e| format!("Failed to serialize request: {e}"))?;
    atomic_write(path, &yaml)
}

/// Create a new request YAML file.
pub fn create_request_file(
    dir: &Path,
    filename: &str,
    request: &RequestFile,
) -> Result<PathBuf, String> {
    let filename = sanitize_entry_name(filename)?;
    let file_path = dir.join(format!("{filename}.yaml"));
    if file_path.exists() {
        return Err(format!("File already exists: {}", file_path.display()));
    }
    write_request(&file_path, request)?;
    Ok(file_path)
}

/// Create a folder in a collection.
pub fn create_folder(parent: &Path, name: &str) -> Result<PathBuf, String> {
    let name = sanitize_entry_name(name)?;
    let folder_path = parent.join(&name);
    if folder_path.exists() {
        return Err(format!("Folder already exists: {}", folder_path.display()));
    }
    fs::create_dir_all(&folder_path).map_err(|e| format!("Failed to create folder: {e}"))?;
    Ok(folder_path)
}

/// Delete an item (file or folder) by moving it to trash.
/// Moves an item to trash. Returns the trash directory path for undo support.
pub fn delete_item(path: &Path, collection_name: &str) -> Result<String, String> {
    let trash_base = dirs::home_dir()
        .ok_or("Could not determine home directory")?
        .join(".reqmate")
        .join("trash")
        .join(collection_name);

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let item_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let trash_dir = trash_base.join(format!("{timestamp}_{item_name}"));

    fs::create_dir_all(&trash_dir).map_err(|e| format!("Failed to create trash dir: {e}"))?;

    let dest = trash_dir.join(&item_name);
    if path.is_dir() {
        copy_dir_all(path, &dest)?;
        fs::remove_dir_all(path).map_err(|e| format!("Failed to remove original dir: {e}"))?;
    } else {
        fs::copy(path, &dest).map_err(|e| format!("Failed to copy to trash: {e}"))?;
        fs::remove_file(path).map_err(|e| format!("Failed to remove original file: {e}"))?;
    }

    Ok(trash_dir.to_string_lossy().to_string())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("Failed to create dir: {e}"))?;
    for entry in fs::read_dir(src).map_err(|e| format!("Failed to read dir: {e}"))? {
        let entry = entry.map_err(|e| format!("Dir entry error: {e}"))?;
        let dest_path = dst.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir_all(&entry.path(), &dest_path)?;
        } else {
            fs::copy(entry.path(), &dest_path).map_err(|e| format!("Failed to copy file: {e}"))?;
        }
    }
    Ok(())
}

/// Rename a file or folder.
/// Turn a user-supplied name into a single safe path segment.
///
/// Replaces characters that are illegal on Windows or that would let the name
/// escape its parent (`/`, `\`), strips control characters, and rejects names
/// that are empty or resolve to `.` / `..`. Requests and folders both use this,
/// so `../evil` can no longer be written outside the collection.
fn sanitize_entry_name(raw: &str) -> Result<String, String> {
    let cleaned: String = raw
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect();

    // Windows rejects trailing dots/spaces; trim them everywhere for parity.
    let cleaned = cleaned.trim().trim_end_matches(['.', ' ']).trim();

    if cleaned.is_empty() || cleaned == "." || cleaned == ".." {
        return Err("Name cannot be empty".to_string());
    }
    if cleaned.len() > 200 {
        return Err("Name is too long".to_string());
    }
    Ok(cleaned.to_string())
}

/// Replace an entry in the parent folder's ordering list, keeping its slot.
fn rename_in_folder_order(parent: &Path, old_key: &str, new_key: &str) {
    if old_key == new_key {
        return;
    }
    let Some(mut config) = load_folder_config(parent) else {
        return;
    };
    let mut changed = false;
    for entry in config.order.iter_mut() {
        if entry == old_key {
            *entry = new_key.to_string();
            changed = true;
        }
    }
    if changed {
        if let Ok(yaml) = serde_yaml::to_string(&config) {
            let _ = atomic_write(&parent.join("_folder.yaml"), &yaml);
        }
    }
}

pub fn rename_item(path: &Path, new_name: &str) -> Result<PathBuf, String> {
    let parent = path.parent().ok_or("Cannot get parent directory")?;

    let safe_name = sanitize_entry_name(new_name)?;
    let old_key = if path.is_dir() {
        path.file_name().map(|n| n.to_string_lossy().to_string())
    } else {
        path.file_stem().map(|n| n.to_string_lossy().to_string())
    };

    let new_path = if path.is_dir() {
        parent.join(&safe_name)
    } else {
        // Preserve .yaml extension for request files
        let ext = path.extension().map(|e| e.to_string_lossy().to_string());
        if let Some(ext) = ext {
            parent.join(format!("{safe_name}.{ext}"))
        } else {
            parent.join(&safe_name)
        }
    };

    if new_path.exists() {
        return Err("A file or folder with that name already exists".to_string());
    }

    fs::rename(path, &new_path).map_err(|e| format!("Failed to rename: {e}"))?;

    // Custom ordering in `_folder.yaml` is keyed by the file stem / folder
    // name. Without this the renamed item loses its position and jumps to the
    // end on the next load.
    if let Some(old_key) = old_key {
        rename_in_folder_order(parent, &old_key, &safe_name);
    }

    // If it's a request YAML, also update the name field inside
    if new_path.is_file() {
        if let Ok(mut request) = read_request(&new_path) {
            request.name = safe_name.clone();
            let _ = write_request(&new_path, &request);
        }
    }

    // If it's a collection directory, update the name in .reqmate/reqmate.yaml
    if new_path.is_dir() {
        let config_path = new_path.join(".reqmate").join("reqmate.yaml");
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(mut config) = serde_yaml::from_str::<CollectionConfig>(&content) {
                    config.name = safe_name.clone();
                    if let Ok(yaml) = serde_yaml::to_string(&config) {
                        let _ = fs::write(&config_path, yaml);
                    }
                }
            }
        }
    }

    Ok(new_path)
}

/// Save the ordering of items within a folder by writing/updating `_folder.yaml`.
pub fn save_folder_order(dir: &Path, order: &[String]) -> Result<(), String> {
    let config_path = dir.join("_folder.yaml");

    // Load existing config or create new
    let mut config = load_folder_config(dir).unwrap_or(FolderConfig {
        name: None,
        auth: None,
        order: Vec::new(),
    });
    config.order = order.to_vec();

    let yaml = serde_yaml::to_string(&config)
        .map_err(|e| format!("Failed to serialize folder config: {e}"))?;
    atomic_write(&config_path, &yaml)
}

/// Load the collection config from .reqmate/reqmate.yaml.
pub fn load_collection_config(collection_path: &Path) -> Result<CollectionConfig, String> {
    let config_path = config_file_path(collection_path);
    if !config_path.exists() {
        return Err(not_a_collection_message(collection_path));
    }
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read collection config: {e}"))?;
    serde_yaml::from_str(&content).map_err(|e| format!("Invalid collection config YAML: {e}"))
}

fn not_a_collection_message(collection_path: &Path) -> String {
    format!(
        "Not a ReqMate collection: {} (missing {CONFIG_DIR}/{CONFIG_FILE})",
        collection_path.display()
    )
}

/// YAML files that live next to requests but are not requests themselves.
const RESERVED_YAML: [&str; 2] = ["_folder.yaml", "_collection.yaml"];

/// Whether `dir` holds at least one YAML file that parses as a request.
fn looks_like_request_dir(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        match path.extension().and_then(|e| e.to_str()) {
            Some("yaml") | Some("yml") => {}
            _ => continue,
        }
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();
        if RESERVED_YAML.contains(&file_name) {
            continue;
        }
        if let Ok(content) = fs::read_to_string(&path) {
            if serde_yaml::from_str::<RequestFile>(&content).is_ok() {
                return true;
            }
        }
    }

    false
}

/// Creates `.reqmate` metadata for a folder that clearly holds requests but has
/// lost (or never had) its config — e.g. after a sync tool dropped hidden
/// directories, or when a collection folder was copied by hand.
///
/// Returns `true` when metadata was written. Folders without request files are
/// left untouched so opening an arbitrary directory still fails loudly.
pub fn ensure_collection_metadata(collection_path: &Path) -> Result<bool, String> {
    if config_file_path(collection_path).exists() || !looks_like_request_dir(collection_path) {
        return Ok(false);
    }

    let name = collection_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Collection")
        .to_string();

    let reqmate_dir = collection_path.join(CONFIG_DIR);
    let env_dir = reqmate_dir.join("environments");
    fs::create_dir_all(&env_dir)
        .map_err(|e| format!("Failed to create {}: {e}", reqmate_dir.display()))?;

    let config = CollectionConfig {
        name,
        version: crate::storage::migration::CURRENT_VERSION,
        defaults: Default::default(),
    };
    let yaml = serde_yaml::to_string(&config)
        .map_err(|e| format!("Failed to serialize collection config: {e}"))?;
    fs::write(config_file_path(collection_path), yaml)
        .map_err(|e| format!("Failed to write collection config: {e}"))?;

    let default_env = env_dir.join("default.yaml");
    if !default_env.exists() {
        fs::write(
            &default_env,
            "name: Default\nvariables:\n  baseUrl: http://localhost:3000\n",
        )
        .map_err(|e| format!("Failed to write default environment: {e}"))?;
    }

    let gitignore = reqmate_dir.join(".gitignore");
    if !gitignore.exists() {
        fs::write(&gitignore, ".env\n").map_err(|e| format!("Failed to write .gitignore: {e}"))?;
    }

    Ok(true)
}

/// Save the collection config to .reqmate/reqmate.yaml (atomic write).
pub fn save_collection_config(
    collection_path: &Path,
    config: &CollectionConfig,
) -> Result<(), String> {
    let config_path = collection_path.join(".reqmate").join("reqmate.yaml");
    let yaml = serde_yaml::to_string(config)
        .map_err(|e| format!("Failed to serialize collection config: {e}"))?;
    atomic_write(&config_path, &yaml)
}

/// Write content atomically: write to .tmp file, then rename.
fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let tmp_path = path.with_extension("reqmate.tmp");
    fs::write(&tmp_path, content).map_err(|e| format!("Failed to write temp file: {e}"))?;
    fs::rename(&tmp_path, path).map_err(|e| {
        // Clean up tmp file on rename failure
        let _ = fs::remove_file(&tmp_path);
        format!("Failed to rename temp file: {e}")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_request(dir: &Path, file: &str, name: &str) {
        let yaml = format!("name: {name}\nmethod: GET\nurl: https://api.test/users\n");
        fs::write(dir.join(file), yaml).unwrap();
    }

    #[test]
    fn missing_metadata_is_rebuilt_for_a_folder_of_requests() {
        let dir = tempfile::tempdir().unwrap();
        write_request(dir.path(), "get-users.yaml", "Get users");

        assert!(ensure_collection_metadata(dir.path()).unwrap());

        let config = load_collection_config(dir.path()).unwrap();
        assert_eq!(
            config.name,
            dir.path().file_name().unwrap().to_str().unwrap()
        );

        let tree = load_collection_tree(dir.path()).unwrap();
        match tree {
            CollectionNode::Collection { children, .. } => assert_eq!(children.len(), 1),
            other => panic!("unexpected node: {other:?}"),
        }
    }

    #[test]
    fn folders_without_requests_are_not_turned_into_collections() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("notes.yaml"), "hello: world\n").unwrap();

        assert!(!ensure_collection_metadata(dir.path()).unwrap());
        assert!(load_collection_tree(dir.path()).is_err());
        assert!(load_collection_config(dir.path()).is_err());
    }

    #[test]
    fn existing_metadata_is_left_untouched() {
        let dir = tempfile::tempdir().unwrap();
        write_request(dir.path(), "a.yaml", "A");
        fs::create_dir_all(dir.path().join(CONFIG_DIR)).unwrap();
        fs::write(config_file_path(dir.path()), "name: Custom\nversion: 1\n").unwrap();

        assert!(!ensure_collection_metadata(dir.path()).unwrap());
        assert_eq!(load_collection_config(dir.path()).unwrap().name, "Custom");
    }

    #[test]
    fn sanitize_keeps_ordinary_names() {
        assert_eq!(sanitize_entry_name("Get Users").unwrap(), "Get Users");
        assert_eq!(sanitize_entry_name("  中文请求  ").unwrap(), "中文请求");
    }

    #[test]
    fn sanitize_strips_path_separators_and_traversal() {
        // Both separators must be neutralised so the name stays one segment.
        assert_eq!(sanitize_entry_name("a/b").unwrap(), "a-b");
        assert_eq!(sanitize_entry_name("a\\b").unwrap(), "a-b");
        assert_eq!(sanitize_entry_name("../evil").unwrap(), "..-evil");
        assert_eq!(sanitize_entry_name("..").is_err(), true);
        assert_eq!(sanitize_entry_name(".").is_err(), true);
        assert!(sanitize_entry_name("   ").is_err());
    }

    #[test]
    fn sanitize_drops_windows_illegal_characters() {
        assert_eq!(sanitize_entry_name("a:b*c?").unwrap(), "a-b-c-");
        assert_eq!(sanitize_entry_name("trailing.").unwrap(), "trailing");
    }

    #[test]
    fn create_folder_refuses_to_escape_its_parent() {
        let dir = tempfile::tempdir().unwrap();
        let created = create_folder(dir.path(), "../escaped").unwrap();
        assert_eq!(
            created.parent().unwrap().canonicalize().unwrap(),
            dir.path().canonicalize().unwrap()
        );
        assert!(!dir.path().parent().unwrap().join("escaped").exists());
    }

    #[test]
    fn create_request_file_rejects_empty_names() {
        let dir = tempfile::tempdir().unwrap();
        let request = RequestFile {
            name: "r".to_string(),
            method: crate::models::request::HttpMethod::GET,
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
        };
        assert!(create_request_file(dir.path(), "  ", &request).is_err());
    }

    #[test]
    fn rename_keeps_its_slot_in_folder_order() {
        let dir = tempfile::tempdir().unwrap();
        save_folder_order(dir.path(), &["a".into(), "b".into(), "c".into()]).unwrap();

        rename_in_folder_order(dir.path(), "b", "beta");

        let config = load_folder_config(dir.path()).unwrap();
        assert_eq!(config.order, vec!["a", "beta", "c"]);
    }

    #[test]
    fn renaming_an_unordered_item_leaves_the_folder_file_alone() {
        let dir = tempfile::tempdir().unwrap();
        rename_in_folder_order(dir.path(), "missing", "other");
        assert!(!dir.path().join("_folder.yaml").exists());
    }

    #[cfg(unix)]
    #[test]
    fn scan_directory_survives_symlink_loops() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("sub")).unwrap();
        // A symlink from sub/ back to the root would recurse forever.
        std::os::unix::fs::symlink(root, root.join("sub").join("loop")).unwrap();

        let nodes = scan_directory(root).unwrap();
        assert_eq!(nodes.len(), 1, "only the real subfolder should appear");
    }
}
