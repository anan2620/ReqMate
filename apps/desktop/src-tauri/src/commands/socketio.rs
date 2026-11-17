use serde::{Deserialize, Serialize};

/// Socket.IO is implemented client-side (frontend) on top of the existing
/// WebSocket transport. The Rust backend provides the raw WS connection,
/// and the frontend handles the Socket.IO protocol framing (EIO/SIO packets).
///
/// This module provides helper commands for Socket.IO-specific operations.

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SocketIoConnectParams {
    pub url: String,
    pub namespace: String,
    #[serde(default)]
    pub auth: Option<serde_json::Value>,
    #[serde(default)]
    pub transports: Vec<String>,
}

/// Build the Socket.IO handshake URL from the base URL.
/// Appends EIO version and transport parameters.
#[tauri::command]
pub fn socketio_build_url(url: String, namespace: String) -> Result<String, String> {
    let mut parsed = url::Url::parse(&url).map_err(|e| format!("Invalid URL: {e}"))?;

    // Socket.IO path
    if !parsed.path().contains("socket.io") {
        parsed.set_path(&format!(
            "{}/socket.io/",
            parsed.path().trim_end_matches('/')
        ));
    }

    // Add EIO version and transport
    parsed
        .query_pairs_mut()
        .append_pair("EIO", "4")
        .append_pair("transport", "websocket");

    if namespace != "/" {
        parsed.query_pairs_mut().append_pair("nsp", &namespace);
    }

    // Convert http(s) to ws(s)
    let ws_url = parsed
        .to_string()
        .replace("http://", "ws://")
        .replace("https://", "wss://");

    Ok(ws_url)
}

#[cfg(test)]
mod tests {
    use super::socketio_build_url;

    #[test]
    fn adds_socket_io_path_and_switches_to_ws() {
        let url = socketio_build_url("http://localhost:3000".into(), "/".into()).unwrap();
        assert_eq!(
            url,
            "ws://localhost:3000/socket.io/?EIO=4&transport=websocket"
        );
    }

    #[test]
    fn switches_https_to_wss() {
        let url = socketio_build_url("https://api.example.com".into(), "/".into()).unwrap();
        assert!(url.starts_with("wss://api.example.com/socket.io/"));
    }

    #[test]
    fn keeps_an_existing_socket_io_path() {
        let url =
            socketio_build_url("http://localhost:3000/socket.io/".into(), "/".into()).unwrap();
        assert_eq!(
            url,
            "ws://localhost:3000/socket.io/?EIO=4&transport=websocket"
        );
    }

    #[test]
    fn appends_namespace_when_not_root() {
        let url = socketio_build_url("http://localhost:3000".into(), "/chat".into()).unwrap();
        assert!(url.contains("nsp=%2Fchat"), "namespace missing from {url}");
    }

    #[test]
    fn trims_trailing_slash_before_adding_the_path() {
        let url = socketio_build_url("http://localhost:3000/api/".into(), "/".into()).unwrap();
        assert!(
            url.starts_with("ws://localhost:3000/api/socket.io/"),
            "{url}"
        );
    }

    #[test]
    fn rejects_invalid_urls() {
        assert!(socketio_build_url("not a url".into(), "/".into()).is_err());
    }
}
