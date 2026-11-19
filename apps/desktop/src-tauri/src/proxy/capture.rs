use std::collections::{HashMap, VecDeque};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Router;
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper_util::rt::TokioIo;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use tauri::{AppHandle, Emitter};
use tokio::io::{copy_bidirectional, AsyncRead, AsyncWrite};
use tokio::net::{TcpListener, TcpStream};
use tokio_rustls::TlsAcceptor;
use tower::ServiceExt;

use crate::proxy::mitm::CertAuthority;
use futures_util::TryStreamExt;

/// How many exchanges are kept in memory. The list is a debugging window, not a
/// log — an unbounded buffer plus 10MB bodies is what made the UI die.
const MAX_CAPTURES: usize = 500;
/// Bodies are truncated before they leave the proxy: keeping whole downloads in
/// memory froze both the backend and the webview.
const MAX_REQUEST_BODY: usize = 32 * 1024;
const MAX_RESPONSE_BODY: usize = 64 * 1024;
/// Upstream call budget. Without it a hung target keeps a request (and its UI
/// row) alive forever.
const UPSTREAM_TIMEOUT: Duration = Duration::from_secs(60);
/// Request bodies are forwarded whole; only the recorded copy is truncated.
/// Sending a cut-down body upstream would corrupt uploads silently.
const MAX_FORWARD_BODY: usize = 32 * 1024 * 1024;
/// A client that opens a tunnel and then says nothing must not pin a task.
const TLS_HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(30);
/// Responses larger than this are relayed as they arrive instead of being read
/// into memory. Debugging needs the first kilobytes, not a video file.
const MAX_BUFFERED_RESPONSE: u64 = 8 * 1024 * 1024;

/// A captured HTTP request/response pair.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedRequest {
    pub id: String,
    pub method: String,
    pub url: String,
    pub request_headers: HashMap<String, String>,
    pub request_body: Option<String>,
    pub status: Option<u16>,
    pub response_headers: HashMap<String, String>,
    pub response_body: Option<String>,
    pub time_ms: u64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyStatus {
    pub running: bool,
    pub port: u16,
    pub capture_count: usize,
    /// True when HTTPS is being decrypted (CA available), false for a blind
    /// tunnel. The UI uses it to tell the user which mode is active.
    pub mitm: bool,
}

pub(crate) struct ProxyState {
    /// `None` in tests, where there is no running Tauri app to emit to.
    app: Option<AppHandle>,
    captures: Arc<Mutex<VecDeque<CapturedRequest>>>,
    passthrough_domains: Arc<Mutex<Vec<String>>>,
    /// One client for the whole proxy: built with `no_proxy()` so upstream hops
    /// can never be routed back into this listener (that recursion is what made
    /// the app hang and repeat a single request forever).
    client: reqwest::Client,
    listen_port: u16,
    /// `None` when the CA has not been generated yet: HTTPS then stays a blind
    /// tunnel instead of breaking every site with an untrusted certificate.
    mitm: Option<Arc<CertAuthority>>,
}

pub struct ProxyCaptureManager {
    shutdown_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    port: Mutex<u16>,
    captures: Arc<Mutex<VecDeque<CapturedRequest>>>,
    passthrough_domains: Arc<Mutex<Vec<String>>>,
    /// Whether the running instance decrypts HTTPS.
    mitm_active: Mutex<bool>,
}

impl ProxyCaptureManager {
    pub fn new() -> Self {
        Self {
            shutdown_tx: Mutex::new(None),
            port: Mutex::new(0),
            captures: Arc::new(Mutex::new(VecDeque::new())),
            passthrough_domains: Arc::new(Mutex::new(Vec::new())),
            mitm_active: Mutex::new(false),
        }
    }

    pub fn is_running(&self) -> bool {
        self.shutdown_tx.lock().unwrap().is_some()
    }

    pub fn status(&self) -> ProxyStatus {
        ProxyStatus {
            running: self.is_running(),
            port: *self.port.lock().unwrap(),
            capture_count: self.captures.lock().unwrap().len(),
            mitm: *self.mitm_active.lock().unwrap(),
        }
    }

    pub fn get_captures(&self) -> Vec<CapturedRequest> {
        self.captures
            .lock()
            .map(|c| c.iter().cloned().collect())
            .unwrap_or_default()
    }

    pub fn clear_captures(&self) {
        if let Ok(mut captures) = self.captures.lock() {
            captures.clear();
        }
    }

    pub fn set_passthrough_domains(&self, domains: Vec<String>) {
        if let Ok(mut domains_ref) = self.passthrough_domains.lock() {
            *domains_ref = domains;
        }
    }

    pub async fn start(&self, port: u16, app: AppHandle) -> Result<(), String> {
        if self.is_running() {
            return Err("Proxy is already running".to_string());
        }

        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        let listener = bind_listener(addr)
            .await
            .map_err(|e| format!("Failed to bind proxy to port {port}: {e}"))?;

        let actual_port = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local addr: {e}"))?
            .port();

        let client = reqwest::Client::builder()
            // The proxy must talk to the network directly. Following the
            // system/env proxy here would send every forwarded request back to
            // ourselves when the user points their OS proxy at this port.
            .no_proxy()
            .danger_accept_invalid_certs(true)
            .timeout(UPSTREAM_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build proxy client: {e}"))?;

        // Only intercept when the CA already exists. Silently creating one here
        // would still be untrusted by every client, turning working HTTPS into
        // certificate errors.
        let mitm = match CertAuthority::load() {
            Ok(authority) => Some(Arc::new(authority)),
            Err(err) => {
                tracing::info!("HTTPS interception off ({err}) — using a blind tunnel");
                None
            }
        };

        let state = Arc::new(ProxyState {
            app: Some(app),
            captures: Arc::clone(&self.captures),
            passthrough_domains: Arc::clone(&self.passthrough_domains),
            client,
            listen_port: actual_port,
            mitm,
        });
        *self.mitm_active.lock().unwrap() = state.mitm.is_some();

        *self.port.lock().unwrap() = actual_port;

        let (tx, rx) = tokio::sync::oneshot::channel::<()>();
        *self.shutdown_tx.lock().unwrap() = Some(tx);

        let serve_state = Arc::clone(&state);
        tokio::spawn(async move {
            serve(listener, serve_state, rx).await;
        });

        tracing::info!("Proxy capture started on port {actual_port}");
        Ok(())
    }

    pub fn stop(&self) {
        if let Some(tx) = self.shutdown_tx.lock().unwrap().take() {
            let _ = tx.send(());
            *self.port.lock().unwrap() = 0;
            *self.mitm_active.lock().unwrap() = false;
            tracing::info!("Proxy capture stopped");
        }
    }
}

/// Bind the listening socket, retrying briefly.
///
/// `stop()` only signals the accept loop; the socket is released when that task
/// actually wakes up. Restarting straight away — which the UI does after a CA is
/// generated — would otherwise fail with `AddrInUse` on a port nobody else uses.
async fn bind_listener(addr: SocketAddr) -> std::io::Result<TcpListener> {
    let mut last = None;
    for attempt in 0..12 {
        match TcpListener::bind(addr).await {
            Ok(listener) => return Ok(listener),
            Err(err) => {
                if err.kind() != std::io::ErrorKind::AddrInUse {
                    return Err(err);
                }
                last = Some(err);
                if attempt < 11 {
                    tokio::time::sleep(Duration::from_millis(20)).await;
                }
            }
        }
    }
    Err(last.expect("a bind attempt always fails with an error"))
}

/// What the TLS handshake established about the target.
///
/// A decrypted request only carries a path, so scheme and authority have to come
/// from the `CONNECT` that opened the tunnel.
struct MitmCtx {
    host: String,
    port: u16,
}

fn build_router(state: Arc<ProxyState>, ctx: Option<Arc<MitmCtx>>) -> Router {
    Router::new().fallback(move |req: axum::extract::Request| {
        let state = Arc::clone(&state);
        let ctx = ctx.clone();
        async move { handle_http(state, req, ctx).await }
    })
}

/// Accept loop.
///
/// CONNECT is dispatched by hand: hyper only hands a connection over as a tunnel
/// through its upgrade API, and getting that wrong silently drops the `200`,
/// which looks exactly like "the proxy killed my HTTPS request". Peeking at the
/// first bytes keeps the two paths independent.
async fn serve(
    listener: TcpListener,
    state: Arc<ProxyState>,
    mut shutdown: tokio::sync::oneshot::Receiver<()>,
) {
    let router = build_router(Arc::clone(&state), None);

    loop {
        tokio::select! {
            _ = &mut shutdown => break,
            accepted = listener.accept() => {
                let Ok((stream, peer)) = accepted else { break };
                let state = Arc::clone(&state);
                let router = router.clone();
                tokio::spawn(async move {
                    if peek_is_connect(&stream).await {
                        handle_connect(stream, state, peer).await;
                    } else {
                        serve_http(stream, router, peer).await;
                    }
                });
            }
        }
    }
}

/// True when the peer opened the connection with `CONNECT host:port`.
///
/// `peek` leaves the bytes in place, so whichever path runs next still sees the
/// full request.
async fn peek_is_connect(stream: &TcpStream) -> bool {
    let mut buf = [0u8; 8];
    // `peek` returns immediately with whatever has arrived — often nothing, as
    // the client may still be sending. Wait for the bytes first.
    for _ in 0..20 {
        if stream.readable().await.is_err() {
            return false;
        }
        match stream.peek(&mut buf).await {
            Ok(n) if n >= 8 => return buf.eq_ignore_ascii_case(b"CONNECT "),
            Ok(_) => tokio::time::sleep(Duration::from_millis(2)).await,
            Err(_) => return false,
        }
    }
    false
}

/// Serve one HTTP/1 connection with the axum router.
///
/// Generic over the byte stream so the exact same handler serves plain-text
/// requests and decrypted HTTPS ones.
async fn serve_http<I>(io: I, router: Router, peer: SocketAddr)
where
    I: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    let io = TokioIo::new(io);
    let service = service_fn(move |req: hyper::Request<Incoming>| {
        let router = router.clone();
        async move {
            let (parts, body) = req.into_parts();
            let req = axum::extract::Request::from_parts(parts, Body::new(body));
            let resp = router.oneshot(req).await.unwrap_or_else(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, "proxy error").into_response()
            });
            Ok::<_, Infallible>(resp)
        }
    });
    if let Err(err) = http1::Builder::new().serve_connection(io, service).await {
        tracing::debug!("proxy connection from {peer} ended: {err}");
    }
}

/// Handle a `CONNECT host:port` request.
///
/// With a CA available the tunnel is intercepted: a leaf certificate for the
/// target host is signed on the fly, TLS is terminated here, and the decrypted
/// HTTP/1.1 is served by the same handler as plain traffic — that is what makes
/// HTTPS bodies visible. Without a CA (or for passthrough domains, or for a
/// client that does not actually speak TLS) it stays a blind byte relay.
async fn handle_connect(mut client: TcpStream, state: Arc<ProxyState>, peer: SocketAddr) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let start = Instant::now();
    let mut head = Vec::with_capacity(256);
    let mut byte = [0u8; 1];
    while !head.ends_with(b"\r\n\r\n") {
        if head.len() > 16 * 1024 {
            return;
        }
        match client.read(&mut byte).await {
            Ok(1) => head.push(byte[0]),
            _ => return,
        }
    }

    let text = String::from_utf8_lossy(&head).to_string();
    let authority = text
        .split_whitespace()
        .nth(1)
        .filter(|a| a.contains(':'))
        .map(|a| a.to_string());
    let Some(authority) = authority else {
        let _ = client
            .write_all(b"HTTP/1.1 400 Bad Request\r\ncontent-length: 0\r\n\r\n")
            .await;
        return;
    };

    if is_self_authority(&authority, state.listen_port) {
        record_and_emit(
            &state,
            CapturedRequest {
                id: uuid::Uuid::new_v4().to_string(),
                method: "CONNECT".to_string(),
                url: authority,
                request_headers: HashMap::new(),
                request_body: None,
                status: Some(508),
                response_headers: HashMap::new(),
                response_body: Some(self_request_body(state.listen_port)),
                time_ms: start.elapsed().as_millis() as u64,
                timestamp: chrono::Utc::now().to_rfc3339(),
            },
        );
        let _ = client
            .write_all(b"HTTP/1.1 508 Loop Detected\r\ncontent-length: 0\r\n\r\n")
            .await;
        return;
    }

    let (host, port) = split_authority(&authority);

    // Passthrough domains are explicitly excluded from capture, so there is
    // nothing to decrypt — relay their bytes untouched.
    if host_is_passthrough(&state, &host) {
        relay_tunnel(client, &authority, &state, start, false).await;
        return;
    }

    if let Some(mitm) = state.mitm.clone() {
        // Announce the tunnel first: the client sends its ClientHello only after
        // this line, and those bytes are what tell TLS from plain HTTP. `peek`
        // leaves them in the stream, so the fallback relay still works.
        let _ = client
            .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            .await;

        if is_tls_client_hello(&client).await {
            match intercept(client, &host, port, mitm, Arc::clone(&state), peer).await {
                Ok(()) => return,
                Err(err) => {
                    // Almost always "the CA is not trusted yet": the client
                    // aborted the handshake right after its warning page.
                    record_and_emit(
                        &state,
                        CapturedRequest {
                            id: uuid::Uuid::new_v4().to_string(),
                            method: "CONNECT".to_string(),
                            url: authority,
                            request_headers: HashMap::new(),
                            request_body: None,
                            status: Some(502),
                            response_headers: HashMap::new(),
                            response_body: Some(format!(
                                "HTTPS interception failed: {err}\n\n\
                                 Install the ReqMate CA certificate in your system or browser \
                                 trust store, then reload the page."
                            )),
                            time_ms: start.elapsed().as_millis() as u64,
                            timestamp: chrono::Utc::now().to_rfc3339(),
                        },
                    );
                    return;
                }
            }
        }

        // A CONNECT to something that is not TLS (e.g. a plain port): relay.
        relay_tunnel(client, &authority, &state, start, true).await;
        return;
    }

    relay_tunnel(client, &authority, &state, start, false).await;
}

/// Terminate TLS for one tunnel and serve the decrypted HTTP/1.1.
async fn intercept(
    client: TcpStream,
    host: &str,
    port: u16,
    authority: Arc<CertAuthority>,
    state: Arc<ProxyState>,
    peer: SocketAddr,
) -> Result<(), String> {
    let config = authority.server_config(host)?;
    let acceptor = TlsAcceptor::from(config);

    let tls = tokio::time::timeout(TLS_HANDSHAKE_TIMEOUT, acceptor.accept(client))
        .await
        .map_err(|_| "TLS handshake timed out".to_string())?
        .map_err(|e| format!("TLS handshake failed: {e}"))?;

    let ctx = Arc::new(MitmCtx {
        host: host.to_string(),
        port,
    });
    serve_http(tls, build_router(state, Some(ctx)), peer).await;
    Ok(())
}

/// Blind `CONNECT` relay: bytes are copied in both directions, nothing is
/// decrypted, and only the tunnel target is recorded.
///
/// `announced` says whether the `200 Connection Established` line was already
/// written (the interception path writes it before deciding).
async fn relay_tunnel(
    mut client: TcpStream,
    authority: &str,
    state: &ProxyState,
    start: Instant,
    announced: bool,
) {
    use tokio::io::AsyncWriteExt;

    match TcpStream::connect(authority).await {
        Ok(mut upstream) => {
            if !announced {
                let _ = client
                    .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                    .await;
            }
            record_and_emit(
                state,
                CapturedRequest {
                    id: uuid::Uuid::new_v4().to_string(),
                    method: "CONNECT".to_string(),
                    url: authority.to_string(),
                    request_headers: HashMap::new(),
                    request_body: None,
                    status: Some(200),
                    response_headers: HashMap::new(),
                    response_body: Some(
                        "TLS tunnel (not intercepted) — generate and install the CA certificate \
                         to see HTTPS requests and responses."
                            .to_string(),
                    ),
                    time_ms: start.elapsed().as_millis() as u64,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                },
            );
            let _ = copy_bidirectional(&mut client, &mut upstream).await;
        }
        Err(err) => {
            record_and_emit(
                state,
                CapturedRequest {
                    id: uuid::Uuid::new_v4().to_string(),
                    method: "CONNECT".to_string(),
                    url: authority.to_string(),
                    request_headers: HashMap::new(),
                    request_body: None,
                    status: Some(502),
                    response_headers: HashMap::new(),
                    response_body: Some(err.to_string()),
                    time_ms: start.elapsed().as_millis() as u64,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                },
            );
            // Once the tunnel was announced the client is already speaking TLS,
            // so there is no HTTP status line left to send.
            if !announced {
                let _ = client
                    .write_all(b"HTTP/1.1 502 Bad Gateway\r\ncontent-length: 0\r\n\r\n")
                    .await;
            }
        }
    }
}

/// True when the next bytes are a TLS handshake record (0x16 = handshake).
async fn is_tls_client_hello(stream: &TcpStream) -> bool {
    let mut byte = [0u8; 1];
    match tokio::time::timeout(Duration::from_secs(10), stream.peek(&mut byte)).await {
        Ok(Ok(n)) if n >= 1 => byte[0] == 0x16,
        _ => false,
    }
}

/// Split `host:port`, defaulting to 443 and keeping IPv6 brackets intact.
fn split_authority(authority: &str) -> (String, u16) {
    match authority.rsplit_once(':') {
        Some((host, port)) => match port.parse::<u16>() {
            Ok(port) => (host.to_string(), port),
            Err(_) => (authority.to_string(), 443),
        },
        None => (authority.to_string(), 443),
    }
}

/// Absolute URL of a request that arrived through a decrypted tunnel.
fn build_tunnel_url(uri: &str, host: &str, port: u16) -> String {
    if uri.starts_with("http://") || uri.starts_with("https://") {
        return uri.to_string();
    }
    let suffix = if port == 443 {
        String::new()
    } else {
        format!(":{port}")
    };
    format!("https://{host}{suffix}{uri}")
}

/// Passthrough check by host name (used before any decryption happens).
fn host_is_passthrough(state: &ProxyState, host: &str) -> bool {
    state
        .passthrough_domains
        .lock()
        .map(|domains| {
            domains
                .iter()
                .any(|domain| !domain.is_empty() && host.contains(domain.as_str()))
        })
        .unwrap_or(false)
}

/// Headers that belong to a single connection (RFC 9110 §7.6.1). Passing them
/// on breaks framing and keep-alive on the other side.
fn is_hop_by_hop(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "connection"
            | "proxy-connection"
            | "keep-alive"
            | "proxy-authorization"
            | "te"
            | "trailer"
            | "transfer-encoding"
            | "upgrade"
    )
}

async fn handle_http(
    state: Arc<ProxyState>,
    req: axum::extract::Request,
    ctx: Option<Arc<MitmCtx>>,
) -> Response {
    let start = Instant::now();
    let method = req.method().to_string();
    let uri = req.uri().to_string();
    let id = uuid::Uuid::new_v4().to_string();

    let req_headers: HashMap<String, String> = req
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    // Check passthrough
    let is_passthrough = req_headers
        .get("host")
        .map(|host| host_is_passthrough(&state, host))
        .unwrap_or(false);

    if is_passthrough {
        return match forward_request(&state.client, req).await {
            Ok(resp) => resp,
            Err(_) => (StatusCode::BAD_GATEWAY, "Passthrough forward failed").into_response(),
        };
    }

    let (parts, body) = req.into_parts();
    // The forwarded body must be complete: `to_bytes` used to be capped at the
    // display limit, which silently turned any upload over 32KB into an empty
    // body upstream. Only the recorded copy is truncated.
    let req_body_bytes = match axum::body::to_bytes(body, MAX_FORWARD_BODY).await {
        Ok(bytes) => bytes,
        Err(_) => {
            let message = format!(
                "Request body is larger than {} MB and was not forwarded",
                MAX_FORWARD_BODY / (1024 * 1024)
            );
            record_and_emit(
                &state,
                CapturedRequest {
                    id,
                    method,
                    url: uri,
                    request_headers: req_headers,
                    request_body: None,
                    status: Some(413),
                    response_headers: HashMap::new(),
                    response_body: Some(message.clone()),
                    time_ms: start.elapsed().as_millis() as u64,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                },
            );
            return (StatusCode::PAYLOAD_TOO_LARGE, message).into_response();
        }
    };
    let req_body = truncate_body(&req_body_bytes, MAX_REQUEST_BODY);

    let built_target = match &ctx {
        // The decrypted request only carries a path, so scheme and authority
        // come from the CONNECT that opened the tunnel.
        Some(ctx) => Some(build_tunnel_url(&uri, &ctx.host, ctx.port)),
        None => build_target_url(&uri, &req_headers),
    };

    let target_url = match built_target {
        Some(url) => url,
        None => {
            let capture = CapturedRequest {
                id,
                method,
                url: uri,
                request_headers: req_headers,
                request_body: req_body,
                status: Some(502),
                response_headers: HashMap::new(),
                response_body: Some("No host header".to_string()),
                time_ms: start.elapsed().as_millis() as u64,
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            record_and_emit(&state, capture);
            return (StatusCode::BAD_GATEWAY, "No host header").into_response();
        }
    };

    if is_self_target(&target_url, state.listen_port) {
        let body = self_request_body(state.listen_port);
        record_and_emit(
            &state,
            CapturedRequest {
                id,
                method,
                url: target_url,
                request_headers: req_headers,
                request_body: req_body,
                status: Some(200),
                response_headers: HashMap::from([(
                    "content-type".to_string(),
                    "text/plain; charset=utf-8".to_string(),
                )]),
                response_body: Some(body.clone()),
                time_ms: start.elapsed().as_millis() as u64,
                timestamp: chrono::Utc::now().to_rfc3339(),
            },
        );
        return (
            StatusCode::OK,
            [(
                axum::http::header::CONTENT_TYPE,
                "text/plain; charset=utf-8",
            )],
            body,
        )
            .into_response();
    }

    let mut req_builder = state.client.request(
        reqwest::Method::from_bytes(parts.method.as_str().as_bytes())
            .unwrap_or(reqwest::Method::GET),
        &target_url,
    );

    for (k, v) in &req_headers {
        if k != "host" && !is_hop_by_hop(k) {
            req_builder = req_builder.header(k, v);
        }
    }

    if !req_body_bytes.is_empty() {
        req_builder = req_builder.body(req_body_bytes.to_vec());
    }

    match req_builder.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            if status == 101 {
                // An upgraded connection belongs to the two peers; hyper cannot
                // hand the socket back to us, so a WebSocket would hang forever.
                let message = "WebSocket upgrade is not supported while HTTPS capture is on —                                turn the proxy off for this connection.";
                record_and_emit(
                    &state,
                    CapturedRequest {
                        id,
                        method,
                        url: target_url,
                        request_headers: req_headers,
                        request_body: req_body,
                        status: Some(502),
                        response_headers: HashMap::new(),
                        response_body: Some(message.to_string()),
                        time_ms: start.elapsed().as_millis() as u64,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    },
                );
                return (StatusCode::BAD_GATEWAY, message).into_response();
            }
            let resp_headers: HashMap<String, String> = resp
                .headers()
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect();
            // A big download is streamed straight through: buffering it just to
            // forward it is what turns a video into an out-of-memory crash.
            if resp
                .content_length()
                .is_some_and(|len| len > MAX_BUFFERED_RESPONSE)
            {
                let length = resp.content_length().unwrap_or_default();
                let mut builder = Response::builder().status(status);
                for (k, v) in &resp_headers {
                    if k != "content-length" && !is_hop_by_hop(k) {
                        builder = builder.header(k, v);
                    }
                }
                record_and_emit(
                    &state,
                    CapturedRequest {
                        id,
                        method,
                        url: target_url,
                        request_headers: req_headers,
                        request_body: req_body,
                        status: Some(status),
                        response_headers: resp_headers.clone(),
                        response_body: Some(format!(
                            "{length} byte response streamed through without capture"
                        )),
                        time_ms: start.elapsed().as_millis() as u64,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    },
                );
                let stream = resp
                    .bytes_stream()
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
                return builder.body(Body::from_stream(stream)).unwrap_or_else(|_| {
                    (StatusCode::INTERNAL_SERVER_ERROR, "Response build failed").into_response()
                });
            }

            let resp_body_bytes = resp.bytes().await.unwrap_or_default();
            let elapsed = start.elapsed().as_millis() as u64;

            let capture = CapturedRequest {
                id,
                method,
                url: target_url,
                request_headers: req_headers,
                request_body: req_body,
                status: Some(status),
                response_headers: resp_headers.clone(),
                response_body: truncate_body(&resp_body_bytes, MAX_RESPONSE_BODY),
                time_ms: elapsed,
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            record_and_emit(&state, capture);

            let mut builder = Response::builder().status(status);
            for (k, v) in &resp_headers {
                // `content-length` is recomputed from the body we hand back, and
                // hop-by-hop headers describe a connection that ends here.
                if k != "content-length" && !is_hop_by_hop(k) {
                    builder = builder.header(k, v);
                }
            }
            builder
                .body(Body::from(resp_body_bytes.to_vec()))
                .unwrap_or_else(|_| {
                    (StatusCode::INTERNAL_SERVER_ERROR, "Response build failed").into_response()
                })
        }
        Err(e) => {
            let elapsed = start.elapsed().as_millis() as u64;
            let capture = CapturedRequest {
                id,
                method,
                url: target_url,
                request_headers: req_headers,
                request_body: req_body,
                status: None,
                response_headers: HashMap::new(),
                response_body: Some(e.to_string()),
                time_ms: elapsed,
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            record_and_emit(&state, capture);
            (StatusCode::BAD_GATEWAY, e.to_string()).into_response()
        }
    }
}

fn record_and_emit(state: &ProxyState, capture: CapturedRequest) {
    if let Ok(mut captures) = state.captures.lock() {
        while captures.len() >= MAX_CAPTURES {
            captures.pop_front();
        }
        captures.push_back(capture.clone());
    }
    if let Some(app) = &state.app {
        let _ = app.emit("proxy:capture", &capture);
    }
}

/// Page shown when a client asks the proxy for something the proxy cannot serve:
/// its own address.
///
/// Forwarding that request would call straight back into this listener, so it
/// must be answered locally — but a bare `508 Loop Detected` looks like a broken
/// API call. Naming the port and the fix in the body answers the user's actual
/// question ("why is this not my data?") where they are already looking.
fn self_request_body(port: u16) -> String {
    format!(
        "ReqMate proxy is listening on 127.0.0.1:{port}\n\n\
         This request was addressed to the proxy itself, so there is no upstream\n\
         response to show.\n\n\
         To capture traffic, set 127.0.0.1:{port} as the HTTP/HTTPS proxy of your\n\
         client and then open the real API URL through it. If a local server really\n\
         runs on port {port}, start the proxy on a different port instead.\n"
    )
}

/// Rebuild the absolute URL of a proxied request.
fn build_target_url(uri: &str, headers: &HashMap<String, String>) -> Option<String> {
    if uri.starts_with("http://") || uri.starts_with("https://") {
        return Some(uri.to_string());
    }
    headers
        .get("host")
        .or_else(|| headers.get("Host"))
        .filter(|h| !h.is_empty())
        .map(|host| format!("http://{host}{uri}"))
}

/// True when `url` points back at this proxy — forwarding it would recurse.
fn is_self_target(url: &str, listen_port: u16) -> bool {
    let Ok(parsed) = url::Url::parse(url) else {
        return false;
    };
    let Some(host) = parsed.host_str() else {
        return false;
    };
    let port = parsed.port_or_known_default().unwrap_or(0);
    port == listen_port && is_loopback_host(host)
}

/// Same check for a `CONNECT host:port` authority.
fn is_self_authority(authority: &str, listen_port: u16) -> bool {
    match authority.rsplit_once(':') {
        Some((host, port)) => port.parse::<u16>() == Ok(listen_port) && is_loopback_host(host),
        None => false,
    }
}

fn is_loopback_host(host: &str) -> bool {
    let host = host.trim_matches(['[', ']']).to_ascii_lowercase();
    matches!(host.as_str(), "localhost" | "127.0.0.1" | "::1")
}

/// Decode a body for display, cutting it at `limit` bytes.
fn truncate_body(bytes: &[u8], limit: usize) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }
    let cut = bytes.len().min(limit);
    let mut text = String::from_utf8_lossy(&bytes[..cut]).to_string();
    if cut < bytes.len() {
        text.push_str(&format!("\n… truncated ({} bytes total)", bytes.len()));
    }
    Some(text)
}

async fn forward_request(
    client: &reqwest::Client,
    req: axum::extract::Request,
) -> Result<Response, String> {
    let (parts, body) = req.into_parts();
    let body_bytes = axum::body::to_bytes(body, MAX_REQUEST_BODY)
        .await
        .map_err(|e| e.to_string())?;

    let host = parts
        .headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let uri = parts.uri.to_string();
    let url = if uri.starts_with("http") {
        uri
    } else {
        format!("http://{host}{uri}")
    };

    let mut req_builder = client.request(
        reqwest::Method::from_bytes(parts.method.as_str().as_bytes())
            .unwrap_or(reqwest::Method::GET),
        &url,
    );

    for (k, v) in &parts.headers {
        if k != "host" && k != "transfer-encoding" {
            req_builder = req_builder.header(k, v);
        }
    }

    if !body_bytes.is_empty() {
        req_builder = req_builder.body(body_bytes.to_vec());
    }

    let resp = req_builder.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let headers = resp.headers().clone();
    let resp_bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    let mut builder = Response::builder().status(status);
    for (k, v) in &headers {
        if k != "transfer-encoding" && k != "content-length" {
            builder = builder.header(k, v);
        }
    }

    builder
        .body(Body::from(resp_bytes.to_vec()))
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    #[test]
    fn absolute_form_uri_is_used_as_is() {
        let url = build_target_url("http://api.test/v1/users?x=1", &headers(&[]));
        assert_eq!(url.as_deref(), Some("http://api.test/v1/users?x=1"));
    }

    #[test]
    fn origin_form_uri_is_joined_with_the_host_header() {
        let url = build_target_url("/v1/users", &headers(&[("host", "api.test:8080")]));
        assert_eq!(url.as_deref(), Some("http://api.test:8080/v1/users"));
    }

    #[test]
    fn missing_host_header_cannot_be_forwarded() {
        assert_eq!(build_target_url("/v1/users", &headers(&[])), None);
        // An empty Host header is as useless as a missing one.
        assert_eq!(
            build_target_url("/v1/users", &headers(&[("host", "")])),
            None
        );
    }

    #[test]
    fn loop_is_detected_for_our_own_port() {
        assert!(is_self_target("http://127.0.0.1:8899/api", 8899));
        assert!(is_self_target("http://localhost:8899/", 8899));
        assert!(is_self_target("http://[::1]:8899/", 8899));
        // Same host, different port — legitimate traffic.
        assert!(!is_self_target("http://127.0.0.1:9000/api", 8899));
        // Different host — legitimate traffic.
        assert!(!is_self_target("http://api.test:8899/", 8899));
        // Unparseable input must not be treated as a loop.
        assert!(!is_self_target("not a url", 8899));
    }

    #[test]
    fn connect_loop_is_detected() {
        assert!(is_self_authority("127.0.0.1:8899", 8899));
        assert!(is_self_authority("localhost:8899", 8899));
        assert!(!is_self_authority("example.com:443", 8899));
        assert!(!is_self_authority("127.0.0.1:443", 8899));
        assert!(!is_self_authority("127.0.0.1", 8899));
    }

    #[test]
    fn bodies_are_truncated_with_a_marker() {
        assert_eq!(truncate_body(b"", 10), None);
        assert_eq!(truncate_body(b"short", 10).as_deref(), Some("short"));

        let long = vec![b'a'; 32];
        let text = truncate_body(&long, 8).unwrap();
        assert!(text.starts_with("aaaaaaaa"));
        assert!(text.contains("truncated"));
        assert!(text.contains("32 bytes"));
    }

    // ─── End-to-end through a real listener ──────────────────────────────

    /// Start a proxy on an ephemeral port. `mitm` mirrors the real setup: the
    /// interceptor is only present when a CA could be loaded.
    async fn spawn_proxy_inner(mitm: Option<Arc<CertAuthority>>) -> (SocketAddr, Arc<ProxyState>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let state = Arc::new(ProxyState {
            app: None,
            captures: Arc::new(Mutex::new(VecDeque::new())),
            passthrough_domains: Arc::new(Mutex::new(Vec::new())),
            // Same shape as production: never route upstream through a proxy,
            // and accept the upstream's own certificate.
            client: reqwest::Client::builder()
                .no_proxy()
                .danger_accept_invalid_certs(true)
                .build()
                .unwrap(),
            listen_port: addr.port(),
            mitm,
        });
        let serve_state = Arc::clone(&state);
        let (tx, rx) = tokio::sync::oneshot::channel::<()>();
        // Hold the shutdown sender open for the lifetime of the test server.
        tokio::spawn(async move {
            let _hold = tx;
            std::future::pending::<()>().await;
        });
        tokio::spawn(async move {
            serve(listener, serve_state, rx).await;
        });
        (addr, state)
    }

    async fn spawn_proxy() -> (SocketAddr, Arc<ProxyState>) {
        spawn_proxy_inner(None).await
    }

    /// A throwaway CA, built the same way `ca::generate_ca` builds the real one.
    /// Returns the interceptor plus the CA certificate DER that a user would
    /// have installed — leaf certificates must chain to *that*.
    fn test_authority() -> (
        Arc<CertAuthority>,
        rustls::pki_types::CertificateDer<'static>,
    ) {
        let key = rcgen::KeyPair::generate_for(&rcgen::PKCS_ECDSA_P256_SHA256).unwrap();
        let cert = crate::proxy::ca::ca_params().self_signed(&key).unwrap();
        let der = cert.der().clone();
        let authority = CertAuthority::from_ca_key_pem(&key.serialize_pem()).unwrap();
        (Arc::new(authority), der)
    }

    async fn read_head(stream: &mut TcpStream) -> String {
        let mut buf = Vec::new();
        let mut chunk = [0u8; 1];
        while !buf.ends_with(b"\r\n\r\n") {
            let n = tokio::io::AsyncReadExt::read(stream, &mut chunk)
                .await
                .unwrap();
            if n == 0 {
                break;
            }
            buf.extend_from_slice(&chunk[..n]);
        }
        String::from_utf8_lossy(&buf).to_string()
    }

    /// Minimal HTTP/1.1 response reader, so keep-alive can be exercised without
    /// pulling a full client into the tests.
    async fn read_response<S>(stream: &mut S) -> (u16, String)
    where
        S: tokio::io::AsyncRead + Unpin,
    {
        use tokio::io::AsyncReadExt;

        let mut head = Vec::new();
        let mut byte = [0u8; 1];
        while !head.ends_with(b"\r\n\r\n") {
            stream.read_exact(&mut byte).await.unwrap();
            head.push(byte[0]);
        }
        let text = String::from_utf8_lossy(&head).to_string();
        let status = text
            .split_whitespace()
            .nth(1)
            .and_then(|s| s.parse::<u16>().ok())
            .expect("status line");
        let length = text
            .lines()
            .find_map(|line| {
                let lower = line.to_ascii_lowercase();
                lower
                    .strip_prefix("content-length:")
                    .and_then(|v| v.trim().parse::<usize>().ok())
            })
            .unwrap_or(0);
        let mut body = vec![0u8; length];
        if length > 0 {
            stream.read_exact(&mut body).await.unwrap();
        }
        (status, String::from_utf8_lossy(&body).to_string())
    }

    #[tokio::test]
    async fn connect_opens_a_tunnel_to_the_target() {
        // Echo server standing in for an HTTPS origin.
        let echo = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let echo_addr = echo.local_addr().unwrap();
        tokio::spawn(async move {
            while let Ok((mut sock, _)) = echo.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 32];
                    if let Ok(n) = tokio::io::AsyncReadExt::read(&mut sock, &mut buf).await {
                        let _ = tokio::io::AsyncWriteExt::write_all(&mut sock, &buf[..n]).await;
                    }
                });
            }
        });

        let (proxy_addr, state) = spawn_proxy().await;

        let mut client = TcpStream::connect(proxy_addr).await.unwrap();
        let request = format!("CONNECT {echo_addr} HTTP/1.1\r\nHost: {echo_addr}\r\n\r\n");
        tokio::io::AsyncWriteExt::write_all(&mut client, request.as_bytes())
            .await
            .unwrap();

        let head = tokio::time::timeout(Duration::from_secs(5), read_head(&mut client))
            .await
            .expect("proxy must answer the CONNECT promptly");
        assert!(
            head.starts_with("HTTP/1.1 200"),
            "got: {head:?} captures={}",
            state.captures.lock().unwrap().len()
        );

        // Bytes now flow through the tunnel untouched.
        tokio::io::AsyncWriteExt::write_all(&mut client, b"ping")
            .await
            .unwrap();
        let mut echoed = [0u8; 4];
        tokio::time::timeout(
            Duration::from_secs(5),
            tokio::io::AsyncReadExt::read_exact(&mut client, &mut echoed),
        )
        .await
        .expect("tunnel must relay data")
        .unwrap();
        assert_eq!(&echoed, b"ping");

        let captures = state.captures.lock().unwrap();
        assert_eq!(captures.len(), 1);
        assert_eq!(captures[0].method, "CONNECT");
        assert_eq!(captures[0].status, Some(200));
    }

    #[tokio::test]
    async fn http_requests_are_forwarded_and_captured() {
        let target = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let target_addr = target.local_addr().unwrap();
        let target_router = Router::new().fallback(|| async { (StatusCode::OK, "hello") });
        tokio::spawn(async move {
            let _ = axum::serve(target, target_router).await;
        });

        let (proxy_addr, state) = spawn_proxy().await;

        let mut client = TcpStream::connect(proxy_addr).await.unwrap();
        let request =
            format!("GET /hello HTTP/1.1\r\nHost: {target_addr}\r\nConnection: close\r\n\r\n");
        tokio::io::AsyncWriteExt::write_all(&mut client, request.as_bytes())
            .await
            .unwrap();

        let mut response = Vec::new();
        tokio::time::timeout(
            Duration::from_secs(10),
            tokio::io::AsyncReadExt::read_to_end(&mut client, &mut response),
        )
        .await
        .expect("forwarded request must complete")
        .unwrap();
        let text = String::from_utf8_lossy(&response);
        assert!(text.starts_with("HTTP/1.1 200"), "got: {text}");
        assert!(text.ends_with("hello"), "got: {text}");

        let captures = state.captures.lock().unwrap();
        assert_eq!(captures.len(), 1);
        assert_eq!(captures[0].method, "GET");
        assert_eq!(captures[0].status, Some(200));
        assert!(captures[0].url.ends_with("/hello"));
        assert_eq!(captures[0].response_body.as_deref(), Some("hello"));
    }

    #[tokio::test]
    async fn self_addressed_requests_get_an_explanation_instead_of_a_loop() {
        let (proxy_addr, state) = spawn_proxy().await;

        let mut client = TcpStream::connect(proxy_addr).await.unwrap();
        let request = format!(
            "GET http://{proxy_addr}/loop HTTP/1.1\r\nHost: {proxy_addr}\r\nConnection: close\r\n\r\n"
        );
        tokio::io::AsyncWriteExt::write_all(&mut client, request.as_bytes())
            .await
            .unwrap();

        let mut response = Vec::new();
        tokio::time::timeout(
            Duration::from_secs(5),
            tokio::io::AsyncReadExt::read_to_end(&mut client, &mut response),
        )
        .await
        .expect("self-addressed request must be answered immediately")
        .unwrap();
        let text = String::from_utf8_lossy(&response);
        // Answered locally with an explanation: forwarding would recurse forever.
        assert!(text.starts_with("HTTP/1.1 200"), "got: {text}");
        assert!(
            text.contains(&format!("127.0.0.1:{}", proxy_addr.port())),
            "body should name the port: {text}"
        );

        // Crucially: exactly one capture, not an infinite chain.
        let captures = state.captures.lock().unwrap();
        assert_eq!(captures.len(), 1);
        assert_eq!(captures[0].status, Some(200));
    }

    #[test]
    fn self_request_body_names_the_port() {
        let body = self_request_body(8899);
        assert!(body.contains("127.0.0.1:8899"));
        // The old wording sent people looking for a broken API instead of a
        // misconfigured proxy; the new one says what to change.
        assert!(!body.contains("Loop detected"));
        assert!(body.contains("proxy"));
    }

    /// HTTPS end to end: the client trusts the test CA (exactly like a browser
    /// with the ReqMate CA installed), the proxy mints a leaf for `localhost`,
    /// and the decrypted request/response bodies show up in the capture list.
    #[tokio::test]
    async fn https_traffic_is_decrypted_and_captured() {
        use rustls::pki_types::ServerName;
        use tokio::io::{AsyncReadExt as _, AsyncWriteExt as _};
        use tokio_rustls::TlsConnector;

        let (authority, ca_cert_der) = test_authority();

        // Upstream HTTPS origin, serving with a leaf from the same CA.
        let upstream = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let upstream_addr = upstream.local_addr().unwrap();
        let upstream_acceptor = TlsAcceptor::from(authority.server_config("localhost").unwrap());
        let echo = Router::new().fallback(|req: axum::extract::Request| async move {
            let body = axum::body::to_bytes(req.into_body(), 1024 * 1024)
                .await
                .unwrap_or_default();
            (
                StatusCode::OK,
                format!("upstream:{}", String::from_utf8_lossy(&body)),
            )
        });
        tokio::spawn(async move {
            while let Ok((sock, peer)) = upstream.accept().await {
                let acceptor = upstream_acceptor.clone();
                let echo = echo.clone();
                tokio::spawn(async move {
                    if let Ok(tls) = acceptor.accept(sock).await {
                        serve_http(tls, echo, peer).await;
                    }
                });
            }
        });

        let (proxy_addr, state) = spawn_proxy_inner(Some(authority.clone())).await;

        let mut tcp = TcpStream::connect(proxy_addr).await.unwrap();
        let connect = format!(
            "CONNECT localhost:{} HTTP/1.1\r\nHost: localhost:{}\r\n\r\n",
            upstream_addr.port(),
            upstream_addr.port()
        );
        tokio::io::AsyncWriteExt::write_all(&mut tcp, connect.as_bytes())
            .await
            .unwrap();
        let head = read_head(&mut tcp).await;
        assert!(head.starts_with("HTTP/1.1 200"), "got: {head}");

        // Client that trusts the interception CA.
        // Trust exactly the certificate that would be installed from disk: this
        // is what proves the re-derived issuer parameters still chain to it.
        let mut roots = rustls::RootCertStore::empty();
        roots.add(ca_cert_der).unwrap();
        let client_cfg = rustls::ClientConfig::builder_with_provider(Arc::new(
            rustls::crypto::ring::default_provider(),
        ))
        .with_safe_default_protocol_versions()
        .unwrap()
        .with_root_certificates(roots)
        .with_no_client_auth();
        let connector = TlsConnector::from(Arc::new(client_cfg));
        let name = ServerName::try_from("localhost").unwrap().to_owned();
        let mut tls = connector.connect(name, tcp).await.expect("TLS handshake");

        tls.write_all(
            b"POST /hello?x=1 HTTP/1.1\r\nHost: localhost\r\nContent-Length: 5\r\n\
              Connection: close\r\n\r\nhello",
        )
        .await
        .unwrap();
        let mut response = Vec::new();
        tls.read_to_end(&mut response).await.unwrap();
        let text = String::from_utf8_lossy(&response);
        assert!(text.starts_with("HTTP/1.1 200"), "got: {text}");
        assert!(text.ends_with("upstream:hello"), "got: {text}");

        // The decrypted exchange replaced the opaque CONNECT row.
        let captures = state.captures.lock().unwrap();
        assert_eq!(captures.len(), 1, "expected one decrypted row");
        let cap = &captures[0];
        assert_eq!(cap.method, "POST");
        assert_eq!(
            cap.url,
            format!("https://localhost:{}/hello?x=1", upstream_addr.port())
        );
        assert_eq!(cap.status, Some(200));
        assert_eq!(cap.request_body.as_deref(), Some("hello"));
        assert_eq!(cap.response_body.as_deref(), Some("upstream:hello"));
    }

    /// Browsers keep the tunnel open and pipeline requests over it, so the
    /// decrypted side has to honour keep-alive like a real origin.
    #[tokio::test]
    async fn https_keep_alive_serves_several_requests() {
        use rustls::pki_types::ServerName;
        use tokio::io::{AsyncReadExt as _, AsyncWriteExt as _};
        use tokio_rustls::TlsConnector;

        let (authority, ca_cert_der) = test_authority();

        let upstream = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let upstream_addr = upstream.local_addr().unwrap();
        let upstream_acceptor = TlsAcceptor::from(authority.server_config("localhost").unwrap());
        let echo = Router::new().fallback(|req: axum::extract::Request| async move {
            (StatusCode::OK, req.uri().to_string())
        });
        tokio::spawn(async move {
            while let Ok((sock, peer)) = upstream.accept().await {
                let acceptor = upstream_acceptor.clone();
                let echo = echo.clone();
                tokio::spawn(async move {
                    if let Ok(tls) = acceptor.accept(sock).await {
                        serve_http(tls, echo, peer).await;
                    }
                });
            }
        });

        let (proxy_addr, state) = spawn_proxy_inner(Some(authority)).await;

        let mut tcp = TcpStream::connect(proxy_addr).await.unwrap();
        let connect = format!(
            "CONNECT localhost:{} HTTP/1.1\r\nHost: localhost\r\n\r\n",
            upstream_addr.port()
        );
        tokio::io::AsyncWriteExt::write_all(&mut tcp, connect.as_bytes())
            .await
            .unwrap();
        assert!(read_head(&mut tcp).await.starts_with("HTTP/1.1 200"));

        let mut roots = rustls::RootCertStore::empty();
        roots.add(ca_cert_der).unwrap();
        let client_cfg = rustls::ClientConfig::builder_with_provider(Arc::new(
            rustls::crypto::ring::default_provider(),
        ))
        .with_safe_default_protocol_versions()
        .unwrap()
        .with_root_certificates(roots)
        .with_no_client_auth();
        let connector = TlsConnector::from(Arc::new(client_cfg));
        let name = ServerName::try_from("localhost").unwrap().to_owned();
        let mut tls = connector.connect(name, tcp).await.expect("TLS handshake");

        for path in ["/one", "/two"] {
            let request = format!("GET {path} HTTP/1.1\r\nHost: localhost\r\n\r\n");
            tls.write_all(request.as_bytes()).await.unwrap();
            let (status, body) = read_response(&mut tls).await;
            assert_eq!(status, 200);
            assert_eq!(body, path);
        }

        let captures = state.captures.lock().unwrap();
        assert_eq!(
            captures.len(),
            2,
            "both requests on one tunnel are captured"
        );
        assert!(captures[0].url.ends_with("/one"));
        assert!(captures[1].url.ends_with("/two"));
    }

    /// A download bigger than the capture window must be relayed, not buffered.
    #[tokio::test]
    async fn large_responses_are_streamed_instead_of_buffered() {
        use tokio::io::{AsyncReadExt as _, AsyncWriteExt as _};

        let upstream = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let upstream_addr = upstream.local_addr().unwrap();
        let size = (MAX_BUFFERED_RESPONSE + 1) as usize;
        let app = Router::new().fallback(move || {
            let body = "x".repeat(size);
            async move { (StatusCode::OK, body) }
        });
        tokio::spawn(async move {
            let _ = axum::serve(upstream, app).await;
        });

        let (proxy_addr, state) = spawn_proxy().await;
        let mut client = TcpStream::connect(proxy_addr).await.unwrap();
        let request =
            format!("GET http://{upstream_addr}/big HTTP/1.1\r\nHost: {upstream_addr}\r\n\r\n");
        client.write_all(request.as_bytes()).await.unwrap();

        let head = read_head(&mut client).await;
        assert!(head.starts_with("HTTP/1.1 200"), "got: {head}");

        let captures = state.captures.lock().unwrap();
        assert_eq!(captures.len(), 1);
        let body = captures[0].response_body.clone().unwrap_or_default();
        assert!(body.contains("streamed"), "got: {body}");
        assert!(
            !body.starts_with('x'),
            "the payload itself must not be kept"
        );
        drop(captures);
        drop(client);
    }

    /// Without a CA the tunnel must stay a blind relay — no certificate, no
    /// interception, no broken HTTPS.
    #[tokio::test]
    async fn missing_ca_keeps_the_tunnel_blind() {
        let echo = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let echo_addr = echo.local_addr().unwrap();
        tokio::spawn(async move {
            while let Ok((mut sock, _)) = echo.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 32];
                    if let Ok(n) = tokio::io::AsyncReadExt::read(&mut sock, &mut buf).await {
                        let _ = tokio::io::AsyncWriteExt::write_all(&mut sock, &buf[..n]).await;
                    }
                });
            }
        });

        let (proxy_addr, state) = spawn_proxy_inner(None).await;

        let mut client = TcpStream::connect(proxy_addr).await.unwrap();
        let request = format!("CONNECT {echo_addr} HTTP/1.1\r\nHost: {echo_addr}\r\n\r\n");
        tokio::io::AsyncWriteExt::write_all(&mut client, request.as_bytes())
            .await
            .unwrap();
        let head = read_head(&mut client).await;
        assert!(head.starts_with("HTTP/1.1 200"), "got: {head}");

        // Raw bytes still pass through untouched, even a TLS-looking prefix.
        tokio::io::AsyncWriteExt::write_all(&mut client, b"ping")
            .await
            .unwrap();
        let mut echoed = [0u8; 4];
        tokio::time::timeout(
            Duration::from_secs(5),
            tokio::io::AsyncReadExt::read_exact(&mut client, &mut echoed),
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(&echoed, b"ping");

        let captures = state.captures.lock().unwrap();
        assert_eq!(captures.len(), 1);
        assert_eq!(captures[0].method, "CONNECT");
    }

    #[test]
    fn capture_buffer_drops_the_oldest_entries() {
        let captures = Arc::new(Mutex::new(VecDeque::new()));
        // Simulate the ring behaviour without spinning up a proxy.
        {
            let mut buf = captures.lock().unwrap();
            for i in 0..(MAX_CAPTURES + 5) {
                while buf.len() >= MAX_CAPTURES {
                    buf.pop_front();
                }
                buf.push_back(i);
            }
        }
        let buf = captures.lock().unwrap();
        assert_eq!(buf.len(), MAX_CAPTURES);
        assert_eq!(*buf.front().unwrap(), 5);
    }
}
