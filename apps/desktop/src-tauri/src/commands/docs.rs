use crate::docs::generator;
use crate::docs::DocsFormat;

#[tauri::command]
pub fn generate_docs(
    collection_path: &str,
    format: DocsFormat,
    output_path: Option<String>,
) -> Result<String, String> {
    let content = generator::generate_docs(collection_path, &format)?;
    write_or_return(content, output_path)
}

/// Combined documentation across several collections at once.
#[tauri::command]
pub fn generate_docs_multi(
    collection_paths: Vec<String>,
    format: DocsFormat,
    output_path: Option<String>,
) -> Result<String, String> {
    let content = generator::generate_docs_multi(&collection_paths, &format)?;
    write_or_return(content, output_path)
}

#[tauri::command]
pub fn preview_docs(collection_path: &str) -> Result<String, String> {
    generator::generate_docs(collection_path, &DocsFormat::Html)
}

#[tauri::command]
pub fn preview_docs_multi(collection_paths: Vec<String>) -> Result<String, String> {
    generator::generate_docs_multi(&collection_paths, &DocsFormat::Html)
}

fn write_or_return(content: String, output_path: Option<String>) -> Result<String, String> {
    if let Some(ref path) = output_path {
        std::fs::write(path, &content).map_err(|e| format!("Failed to write docs file: {e}"))?;
        Ok(path.clone())
    } else {
        Ok(content)
    }
}
