use std::any::Any;
use std::panic::{catch_unwind, AssertUnwindSafe};

use tauri::ipc::{Invoke, InvokeResolver};
use tauri::Runtime;

/// Wraps a Tauri invoke handler so that a panic inside a synchronous command
/// becomes a rejected promise instead of taking the whole app down.
///
/// Tauri runs sync commands on the webview thread, inside the IPC callback that
/// WebKit calls from C++. A Rust panic cannot unwind through that boundary: the
/// runtime aborts the process, so the user sees a plain "app quit" with a
/// `SIGABRT` crash report and no explanation. Catching the panic here keeps the
/// unwind inside Rust frames and reports the failure to the frontend instead.
pub fn guard_panics<R, F>(handler: F) -> impl Fn(Invoke<R>) -> bool + Send + Sync + 'static
where
    R: Runtime,
    F: Fn(Invoke<R>) -> bool + Send + Sync + 'static,
{
    move |invoke| {
        let command = invoke.message.command().to_string();
        // The invoke is moved into the handler, so keep the resolver around to
        // answer with an error if the handler never gets to answer itself.
        let resolver: InvokeResolver<R> = invoke.resolver.clone();

        // `handler` is borrowed (it is `Fn`), only the invoke is moved, so the
        // outer closure can stay `Fn`.
        match catch_unwind(AssertUnwindSafe(|| handler(invoke))) {
            Ok(handled) => handled,
            Err(payload) => {
                let detail = panic_message(payload.as_ref());
                tracing::error!(command = %command, panic = %detail, "Command panicked");
                resolver.reject(format!("Command '{command}' failed unexpectedly: {detail}"));
                // The command name matched, and the error response is on its
                // way — do not let Tauri fall through to "command not found".
                true
            }
        }
    }
}

/// Extracts the human readable message from a panic payload.
fn panic_message(payload: &(dyn Any + Send)) -> String {
    payload
        .downcast_ref::<&str>()
        .map(|s| (*s).to_string())
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic".to_string())
}

#[cfg(test)]
mod tests {
    use super::panic_message;

    #[test]
    fn reads_str_and_string_payloads() {
        let from_str = std::panic::catch_unwind(|| panic!("boom")).unwrap_err();
        assert_eq!(panic_message(from_str.as_ref()), "boom");

        let from_string = std::panic::catch_unwind(|| {
            let reason = String::from("owned payload");
            panic!("{reason}");
        })
        .unwrap_err();
        assert_eq!(panic_message(from_string.as_ref()), "owned payload");

        let opaque = std::panic::catch_unwind(|| std::panic::panic_any(42u8)).unwrap_err();
        assert_eq!(panic_message(opaque.as_ref()), "unknown panic");
    }
}

#[cfg(test)]
mod ipc_tests {
    use tauri::ipc::{CallbackFn, InvokeBody};
    use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY};
    use tauri::webview::InvokeRequest;
    use tauri::WebviewWindowBuilder;

    #[tauri::command]
    fn panics_on_purpose() -> Result<String, String> {
        panic!("simulated backend panic");
    }

    #[tauri::command]
    fn answers_normally() -> String {
        "ok".into()
    }

    fn invoke(
        webview: &tauri::WebviewWindow<tauri::test::MockRuntime>,
        cmd: &str,
    ) -> Result<String, serde_json::Value> {
        let request = InvokeRequest {
            cmd: cmd.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: InvokeBody::default(),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.into(),
        };
        get_ipc_response(webview, request).map(|body| body.deserialize::<String>().unwrap())
    }

    // If the guard were missing, the panic would unwind into the webview
    // callback and this test process would die with SIGABRT instead of failing
    // an assertion — which is exactly the crash users were hitting.
    #[test]
    fn panicking_command_rejects_the_promise() {
        let app = mock_builder()
            .invoke_handler(super::guard_panics(tauri::generate_handler![
                panics_on_purpose,
                answers_normally
            ]))
            .build(mock_context(noop_assets()))
            .unwrap();
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();

        let error = invoke(&webview, "panics_on_purpose").unwrap_err();
        let message = error.as_str().unwrap_or_default();
        assert!(
            message.contains("simulated backend panic"),
            "unexpected error: {message}"
        );
        assert!(message.contains("panics_on_purpose"));

        // The app stays usable afterwards: later commands still answer.
        assert_eq!(invoke(&webview, "answers_normally").unwrap(), "ok");
    }
}
