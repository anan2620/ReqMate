pub mod js_plugin;
pub mod manager;
pub mod wasm_plugin;

use std::path::Path;

use manager::PluginInfo;

/// Execute one plugin hook, dispatching on the manifest's declared runtime.
///
/// `js` uses the embedded rquickjs engine, `wasm` uses the fuel-metered wasmi
/// sandbox. Unknown runtimes are rejected at install time, but we fall back to
/// the JavaScript engine here so a hand-edited manifest cannot break requests.
pub fn execute_hook(
    plugin: &PluginInfo,
    hook_name: &str,
    context_json: &str,
) -> Result<String, String> {
    let plugin_dir = Path::new(&plugin.path);
    match plugin.manifest.runtime.as_str() {
        "wasm" => wasm_plugin::execute_wasm_hook(
            plugin_dir,
            &plugin.manifest.entry,
            hook_name,
            context_json,
        ),
        _ => {
            js_plugin::execute_js_hook(plugin_dir, &plugin.manifest.entry, hook_name, context_json)
        }
    }
}
