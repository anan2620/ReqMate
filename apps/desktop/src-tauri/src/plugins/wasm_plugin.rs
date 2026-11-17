//! WebAssembly plugin runtime.
//!
//! WASM plugins are sandboxed: the module may not import any host function except
//! `env.abort` (kept only so AssemblyScript-compiled modules load), so a plugin
//! cannot touch the filesystem, the network, or the process environment.
//! Execution is metered with fuel, which bounds both CPU and memory growth.
//!
//! ## ABI
//!
//! A plugin is a single `.wasm` file exporting three symbols:
//!
//! ```text
//! memory              linear memory, exported as "memory"
//! alloc(len: i32) -> i32          return a pointer to `len` writable bytes
//! handle(ptr: i32, len: i32) -> i64
//!                                 read `len` bytes of JSON at `ptr`, return
//!                                 (result_ptr as u32) << 32 | (result_len as u32)
//! dealloc(ptr: i32, len: i32)     optional, called once after the result is read
//! ```
//!
//! The host writes a JSON envelope to the buffer returned by `alloc` and reads the
//! plugin's answer back from the pointer packed into `handle`'s return value.
//!
//! The envelope is the same context object the JavaScript runtime receives, plus a
//! `hook` field so one module can dispatch between hooks:
//!
//! ```json
//! { "hook": "preRequest", "request": { "method": "POST", "url": "…", "headers": {}, "body": null }, "response": null }
//! ```
//!
//! Returning `{}` (or an empty string) means "no changes".

use std::path::Path;

use wasmi::{Config, Engine, Linker, Module, Store};

/// Fuel budget for a single hook execution. Roughly tens of milliseconds of
/// interpreted work — far above any legitimate header/URL rewrite, far below
/// anything a user would notice as a hang.
const DEFAULT_FUEL: u64 = 50_000_000;

/// Upper bound on the JSON a plugin may return, so a runaway module cannot make
/// the host allocate unbounded memory reading the result back.
const MAX_RESULT_BYTES: usize = 1024 * 1024;

/// Upper bound on the context handed to a plugin.
const MAX_INPUT_BYTES: usize = 8 * 1024 * 1024;

fn build_engine() -> Engine {
    let mut config = Config::default();
    config.consume_fuel(true);
    Engine::new(&config)
}

/// Run a WASM plugin hook loaded from `<plugin_dir>/<entry>`.
pub fn execute_wasm_hook(
    plugin_dir: &Path,
    entry: &str,
    hook: &str,
    context_json: &str,
) -> Result<String, String> {
    let entry_path = plugin_dir.join(entry);
    let wasm_bytes = std::fs::read(&entry_path)
        .map_err(|e| format!("Failed to read wasm entry '{}': {e}", entry_path.display()))?;
    run_wasm_hook(&wasm_bytes, hook, context_json)
}

/// Run a WASM plugin hook from module bytes. Split out so tests do not need a file.
pub fn run_wasm_hook(wasm_bytes: &[u8], hook: &str, context_json: &str) -> Result<String, String> {
    let envelope = build_envelope(hook, context_json)?;
    let input = envelope.as_bytes();
    if input.len() > MAX_INPUT_BYTES {
        return Err(format!(
            "Plugin context is too large ({} bytes, limit {MAX_INPUT_BYTES})",
            input.len()
        ));
    }

    let engine = build_engine();
    let module =
        Module::new(&engine, wasm_bytes).map_err(|e| format!("Invalid wasm module: {e}"))?;

    let mut store = Store::new(&engine, ());
    let mut linker = <Linker<()>>::new(&engine);

    // AssemblyScript emits `env.abort` for its runtime checks. Allow it and nothing
    // else: any other import fails instantiation, which is what keeps the sandbox tight.
    linker
        .func_wrap(
            "env",
            "abort",
            |_caller: wasmi::Caller<'_, ()>, _msg: i32, _file: i32, _line: i32, _col: i32| {},
        )
        .map_err(|e| format!("Failed to register host imports: {e}"))?;

    store
        .set_fuel(DEFAULT_FUEL)
        .map_err(|e| format!("Failed to meter plugin execution: {e}"))?;

    let instance = linker.instantiate_and_start(&mut store, &module).map_err(|e| {
        format!(
            "Failed to instantiate plugin (wasm plugins may not import host functions other than env.abort): {e}"
        )
    })?;

    let memory = instance
        .get_memory(&store, "memory")
        .ok_or("Wasm plugin must export its linear memory as \"memory\"")?;

    let alloc = instance
        .get_typed_func::<i32, i32>(&store, "alloc")
        .map_err(|e| format!("Wasm plugin must export `alloc(i32) -> i32`: {e}"))?;

    let handle = instance
        .get_typed_func::<(i32, i32), i64>(&store, "handle")
        .map_err(|e| format!("Wasm plugin must export `handle(i32, i32) -> i64`: {e}"))?;

    let input_len = i32::try_from(input.len()).map_err(|_| "Plugin context is too large")?;
    let input_ptr = alloc
        .call(&mut store, input_len)
        .map_err(|e| trap_message("alloc", e))?;
    let input_offset =
        usize::try_from(input_ptr).map_err(|_| "alloc returned a negative pointer")?;

    memory
        .write(&mut store, input_offset, input)
        .map_err(|e| format!("Failed to write plugin context into wasm memory: {e}"))?;

    // Re-arm the meter so alloc/instantiation cannot eat the whole budget.
    store
        .set_fuel(DEFAULT_FUEL)
        .map_err(|e| format!("Failed to meter plugin execution: {e}"))?;

    let packed = handle
        .call(&mut store, (input_ptr, input_len))
        .map_err(|e| trap_message("handle", e))?;

    let packed = packed as u64;
    let out_offset = (packed >> 32) as usize;
    let out_len = (packed & 0xFFFF_FFFF) as usize;

    if out_len == 0 {
        return Ok("{}".to_string());
    }
    if out_len > MAX_RESULT_BYTES {
        return Err(format!(
            "Plugin returned {out_len} bytes, over the {MAX_RESULT_BYTES} byte limit"
        ));
    }

    let mut out = vec![0u8; out_len];
    memory
        .read(&store, out_offset, &mut out)
        .map_err(|e| format!("Plugin returned an out-of-bounds result pointer: {e}"))?;

    if let Ok(dealloc) = instance.get_typed_func::<(i32, i32), ()>(&store, "dealloc") {
        let _ = dealloc.call(&mut store, (input_ptr, input_len));
        let _ = dealloc.call(&mut store, (out_offset as i32, out_len as i32));
    }

    String::from_utf8(out).map_err(|_| "Plugin returned invalid UTF-8".to_string())
}

fn build_envelope(hook: &str, context_json: &str) -> Result<String, String> {
    let mut value: serde_json::Value =
        serde_json::from_str(context_json).map_err(|e| format!("Invalid plugin context: {e}"))?;
    if let Some(obj) = value.as_object_mut() {
        obj.insert(
            "hook".to_string(),
            serde_json::Value::String(hook.to_string()),
        );
    }
    Ok(value.to_string())
}

fn trap_message(stage: &str, err: wasmi::Error) -> String {
    let text = err.to_string();
    if text.to_lowercase().contains("fuel") {
        format!("Plugin exceeded its execution budget in `{stage}` (possible infinite loop)")
    } else {
        format!("Plugin trapped in `{stage}`: {text}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Minimal module implementing the ABI: `alloc` hands out memory from a bump
    /// pointer, `handle` ignores the input and returns the static `{}` at 4096.
    const ECHO_MODULE: &str = r#"
        (module
          (memory (export "memory") 1)
          (global $next (mut i32) (i32.const 1024))
          (func (export "alloc") (param $len i32) (result i32)
            (local $ptr i32)
            (local.set $ptr (global.get $next))
            (global.set $next (i32.add (local.get $ptr) (local.get $len)))
            (local.get $ptr))
          (func (export "handle") (param $ptr i32) (param $len i32) (result i64)
            (i64.or
              (i64.shl (i64.extend_i32_u (i32.const 4096)) (i64.const 32))
              (i64.extend_i32_u (i32.const 2))))
          (data (i32.const 4096) "{}"))
    "#;

    fn echo_bytes() -> Vec<u8> {
        wat::parse_str(ECHO_MODULE).expect("valid wat")
    }

    #[test]
    fn runs_a_hook_and_reads_the_result() {
        let out = run_wasm_hook(
            &echo_bytes(),
            "preRequest",
            r#"{"request":{"url":"http://x"}}"#,
        )
        .expect("hook should run");
        assert_eq!(out, "{}");
    }

    #[test]
    fn envelope_carries_the_hook_name() {
        let envelope = build_envelope("postResponse", r#"{"request":null}"#).unwrap();
        let value: serde_json::Value = serde_json::from_str(&envelope).unwrap();
        assert_eq!(value["hook"], "postResponse");
        assert!(value.get("request").is_some());
    }

    #[test]
    fn rejects_modules_that_import_host_functions() {
        let wat = r#"
            (module
              (import "env" "read_file" (func $read (param i32) (result i32)))
              (memory (export "memory") 1)
              (func (export "alloc") (param i32) (result i32) (i32.const 16))
              (func (export "handle") (param i32) (param i32) (result i64) (i64.const 0)))
        "#;
        let bytes = wat::parse_str(wat).unwrap();
        let err = run_wasm_hook(&bytes, "preRequest", "{}").unwrap_err();
        assert!(
            err.contains("may not import"),
            "unexpected error message: {err}"
        );
    }

    #[test]
    fn stops_a_runaway_plugin() {
        let wat = r#"
            (module
              (memory (export "memory") 1)
              (func (export "alloc") (param i32) (result i32) (i32.const 16))
              (func (export "handle") (param i32) (param i32) (result i64)
                (loop $spin (br $spin))
                (i64.const 0)))
        "#;
        let bytes = wat::parse_str(wat).unwrap();
        let err = run_wasm_hook(&bytes, "preRequest", "{}").unwrap_err();
        assert!(
            err.contains("execution budget"),
            "unexpected error message: {err}"
        );
    }

    #[test]
    fn reports_missing_exports() {
        let wat = r#"(module (memory (export "memory") 1))"#;
        let bytes = wat::parse_str(wat).unwrap();
        let err = run_wasm_hook(&bytes, "preRequest", "{}").unwrap_err();
        assert!(err.contains("alloc"), "unexpected error message: {err}");
    }

    #[test]
    fn rejects_non_wasm_payloads() {
        let err = run_wasm_hook(b"not wasm at all", "preRequest", "{}").unwrap_err();
        assert!(err.contains("Invalid wasm module"), "got: {err}");
    }
}
