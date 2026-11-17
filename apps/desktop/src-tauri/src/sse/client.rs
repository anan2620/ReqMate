use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;

use super::parser::SseParser;
use super::{SseConnectParams, SseEvent, SseStatus};

/// Connect to an SSE endpoint and stream events to the frontend.
pub async fn connect_sse(
    app: AppHandle,
    connection_id: String,
    params: SseConnectParams,
    mut cancel_rx: watch::Receiver<bool>,
) {
    // Emit connecting
    let _ = app.emit(
        "sse:status",
        SseStatus {
            connection_id: connection_id.clone(),
            state: "connecting".to_string(),
            error: None,
        },
    );

    // Build request
    let client = reqwest::Client::new();
    let mut req = client
        .get(&params.url)
        .header("Accept", "text/event-stream")
        .header("Cache-Control", "no-cache");

    for h in &params.headers {
        if h.enabled && !h.key.is_empty() {
            req = req.header(&h.key, &h.value);
        }
    }

    let response = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            let _ = app.emit(
                "sse:status",
                SseStatus {
                    connection_id,
                    state: "disconnected".to_string(),
                    error: Some(format!("Connection failed: {e}")),
                },
            );
            return;
        }
    };

    if !response.status().is_success() {
        let _ = app.emit(
            "sse:status",
            SseStatus {
                connection_id,
                state: "disconnected".to_string(),
                error: Some(format!("HTTP {}", response.status())),
            },
        );
        return;
    }

    // Connected
    let _ = app.emit(
        "sse:status",
        SseStatus {
            connection_id: connection_id.clone(),
            state: "connected".to_string(),
            error: None,
        },
    );

    // Parse SSE stream
    let mut stream = response.bytes_stream();
    let mut parser = SseParser::new();

    loop {
        tokio::select! {
            _ = cancel_rx.changed() => {
                break;
            }
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        for frame in parser.push(&String::from_utf8_lossy(&bytes)) {
                            let _ = app.emit("sse:event", SseEvent {
                                connection_id: connection_id.clone(),
                                event_type: frame.event_type,
                                data: frame.data,
                                id: frame.id,
                                timestamp: chrono::Utc::now().to_rfc3339(),
                            });
                        }
                    }
                    Some(Err(e)) => {
                        let _ = app.emit("sse:status", SseStatus {
                            connection_id: connection_id.clone(),
                            state: "disconnected".to_string(),
                            error: Some(format!("Stream error: {e}")),
                        });
                        return;
                    }
                    None => {
                        // Stream ended
                        break;
                    }
                }
            }
        }
    }

    // Flush an event that was not terminated by a blank line before the stream closed
    if let Some(frame) = parser.finish() {
        let _ = app.emit(
            "sse:event",
            SseEvent {
                connection_id: connection_id.clone(),
                event_type: frame.event_type,
                data: frame.data,
                id: frame.id,
                timestamp: chrono::Utc::now().to_rfc3339(),
            },
        );
    }

    // Disconnected
    let _ = app.emit(
        "sse:status",
        SseStatus {
            connection_id,
            state: "disconnected".to_string(),
            error: None,
        },
    );
}
