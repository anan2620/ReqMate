# Plugins

ReqMate plugins extend the request pipeline without touching the app. Two runtimes
are supported: **JavaScript** (embedded QuickJS) and **WebAssembly** (a metered
interpreter). WASM plugins run in a sandbox with no filesystem, network, or process
access.

An installed plugin is a directory under the app's plugins folder containing a
`plugin.json` manifest and an entry file.

## Manifest

```json
{
  "name": "team-headers",
  "version": "1.0.0",
  "description": "Adds the platform team header to every request",
  "author": "platform-team",
  "runtime": "wasm",
  "entry": "team_headers.wasm",
  "hooks": ["preRequest"]
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Unique; used as the install directory name |
| `version` | yes | Free-form string |
| `description` | yes | Shown in the plugin manager |
| `author` | no | Defaults to an empty string |
| `runtime` | yes | `js` or `wasm`; anything else is rejected at install |
| `entry` | yes | Relative path to the entry file; must exist |
| `hooks` | no | Subset of the hook names below |

## Hooks

| Hook | Runs | May mutate |
|---|---|---|
| `preRequest` | Before the request is sent | URL, headers |
| `postResponse` | After the response arrives | — (observability only) |
| `onStart` | App start | — |
| `onCollectionOpen` | A collection is opened | — |
| `authProvider` | Auth resolution | — |

## Context

Every hook receives the same JSON document. `hook` is added by the host so a single
entry file can dispatch:

```json
{
  "hook": "preRequest",
  "request": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "headers": { "content-type": "application/json" },
    "body": "{\"name\":\"Ada\"}"
  },
  "response": null
}
```

Returning the context unchanged (or `{}`) means "no modifications".

## JavaScript plugins

The entry is a `.js` file. Export the hook by name, either as a global function or
as a property of `exports`. The return value is serialised back to the host.

```js
exports.preRequest = (ctx) => {
  ctx.request.headers["x-team"] = "platform";
  return ctx;
};
```

## WebAssembly plugins

A WASM plugin is a single module exporting three symbols:

| Export | Signature | Purpose |
|---|---|---|
| `memory` | linear memory | Where the host reads and writes the JSON |
| `alloc` | `(len: i32) -> i32` | Reserve `len` writable bytes, return the pointer |
| `handle` | `(ptr: i32, len: i32) -> i64` | Read the JSON envelope, return `(result_ptr << 32) \| result_len` |
| `dealloc` | `(ptr: i32, len: i32) -> ()` | Optional; called after the result is copied out |

The module **may not import host functions**, with one exception: `env.abort`, which
AssemblyScript emits for its runtime checks. Any other import fails instantiation.
There is no WASI, so a plugin cannot reach the filesystem or the network.

### Writing one in Rust

```toml
# Cargo.toml
[package]
name = "team-headers"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
serde_json = "1"
```

```rust
use std::alloc::{alloc as raw_alloc, Layout};

#[no_mangle]
pub extern "C" fn alloc(len: i32) -> i32 {
    let layout = Layout::from_size_align(len.max(1) as usize, 8).unwrap();
    unsafe { raw_alloc(layout) as i32 }
}

#[no_mangle]
pub extern "C" fn handle(ptr: i32, len: i32) -> i64 {
    let input = unsafe { std::slice::from_raw_parts(ptr as *const u8, len as usize) };
    let mut ctx: serde_json::Value = serde_json::from_slice(input).unwrap();

    if ctx["hook"] == "preRequest" {
        if let Some(headers) = ctx["request"]["headers"].as_object_mut() {
            headers.insert("x-team".to_string(), serde_json::json!("platform"));
        }
    }

    let out = serde_json::to_vec(&ctx).unwrap();
    let out_ptr = alloc(out.len() as i32);
    unsafe { std::ptr::copy_nonoverlapping(out.as_ptr(), out_ptr as *mut u8, out.len()) };

    (((out_ptr as u32 as u64) << 32) | out.len() as u32 as u64) as i64
}
```

Build with the bare-metal WebAssembly target:

```bash
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
# target/wasm32-unknown-unknown/release/team_headers.wasm
```

### Limits

Execution is metered with fuel: a single hook call gets roughly 50 million
interpreter steps, which traps a runaway loop instead of hanging the app. Return
payloads above 1 MiB and contexts above 8 MiB are rejected. Errors surface in the
console panel as `[plugin:<name>] <hook> hook failed: …` and never abort the request.

## Installing

Plugins → Install, then pick the plugin directory (the one containing `plugin.json`).
A `wasm` plugin whose entry file does not start with the `\0asm` magic bytes is
rejected at install time rather than at the first request.
