# ReqMate Development Setup

How to get every part of this monorepo running locally, plus the exact commands CI uses.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | >= 22 | `engines.node` in root `package.json` |
| pnpm | >= 10 | `engines.pnpm`; the repo is a pnpm workspace |
| Rust | current stable | Desktop backend and the standalone CLI / MCP crates |
| Tauri v2 system deps | — | See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) |

Platform system deps, in short:

- **macOS** — Xcode Command Line Tools (`xcode-select --install`)
- **Windows** — WebView2 runtime + MSVC build tools
- **Linux** — `webkit2gtk-4.1`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`

## First-time setup

```bash
git clone https://github.com/anan2620/ReqMate.git
cd reqmate
pnpm install
```

`pnpm-workspace.yaml` covers `apps/*` and `packages/*`. If pnpm asks for approval on build
scripts, the pending entries are `esbuild` and `sharp` — set them to `true` in
`pnpm-workspace.yaml` under `allowBuilds` before installing.

## Repository layout

```
reqmate/
├── apps/
│   ├── desktop/            Tauri v2 app — React frontend (src/) + Rust backend (src-tauri/)
│   ├── web/                Marketing site (Next.js 15)
│   ├── cli/                Standalone Rust crate → bin `reqmate`
│   ├── mcp-server/         Standalone Rust crate → bin `reqmate-mcp` (stdio MCP)
│   └── vscode-extension/   VS Code extension (tsc only, no bundler)
├── packages/
│   ├── types/              Shared TypeScript types (@reqmate/types)
│   └── importer/           Collection importers (@reqmate/importer)
├── scripts/                check-versions.mjs, check-model-drift.mjs
└── docs/
```

There is **no Cargo workspace** at the root. `apps/desktop/src-tauri`, `apps/cli`, and
`apps/mcp-server` are three independent crates, each with its own `Cargo.lock`. Always pass
`--manifest-path` or `cd` into the crate directory — `cargo run` from the repo root will fail.

## Entry points at a glance

| Target | Command | URL / port |
|---|---|---|
| Desktop app (full Tauri) | `pnpm tauri dev` | window opens; Vite on 1420 |
| Desktop frontend only | `pnpm dev` | http://localhost:1420 |
| Marketing site | `pnpm dev:web` | http://localhost:3000 |
| CLI | `cargo run --manifest-path apps/cli/Cargo.toml -- <args>` | — |
| MCP server | `cargo build --manifest-path apps/mcp-server/Cargo.toml` | stdio |
| VS Code extension | `pnpm --filter reqmate-vscode compile`, then F5 | Extension Host |

## Desktop app (primary development target)

```bash
pnpm tauri dev
```

This is the command to use. `tauri.conf.json` sets `beforeDevCommand: "pnpm dev"`, so Tauri starts
Vite itself and then attaches the Rust backend.

- Vite dev server: **1420**, `strictPort: true` — the port must be free, Tauri will not fall back
- HMR websocket: **1421**
- Frontend-only (`pnpm dev`) boots the React app in a normal browser, but every Tauri IPC call
  fails. Use it only for styling work, never to verify a feature.

Root `package.json` scripts, all thin `pnpm --filter @reqmate/desktop` wrappers:

| Script | Expands to |
|---|---|
| `pnpm dev` | `vite` |
| `pnpm build` | `tsc -b && vite build` |
| `pnpm tauri <cmd>` | `tauri <cmd>` |
| `pnpm lint` | `eslint .` |
| `pnpm preview` | `vite preview` |

## Marketing site (Next.js)

```bash
pnpm dev:web                       # root alias → rm -rf .next && next dev --turbopack
pnpm build:web
pnpm start:web                     # production preview
# or the long form: pnpm --filter @reqmate/web dev
```

Runs on 3000 and is fully independent of the desktop app — you can run both at once. The `dev`
script wipes `.next` every start, so a cold start takes a few seconds by design.

In a sandboxed shell Next may hang on telemetry; prefix with `NEXT_TELEMETRY_DISABLED=1`.

## CLI (`apps/cli`)

Standalone crate, binary name `reqmate`:

```bash
# Run a collection
cargo run --manifest-path apps/cli/Cargo.toml -- run ./my-collection --env production

# Data-driven, JUnit report to a file
cargo run --manifest-path apps/cli/Cargo.toml -- \
  run ./my-collection --data users.csv --reporter junit --output results.xml

# Import / export
cargo run --manifest-path apps/cli/Cargo.toml -- import postman-export.json --output ./collection
cargo run --manifest-path apps/cli/Cargo.toml -- export ./my-collection --format openapi
```

`run` flags (`apps/cli/src/main.rs`): `-e/--env`, `-d/--delay` ms, `-i/--iterations`,
`--data` (CSV/JSON/YAML), `-r/--reporter` (`cli` default | `json` | `junit` | `html`),
`-o/--output`. `import` flags: `-o/--output`, `-f/--format` (`postman` | `insomnia` | `openapi`,
auto-detected when omitted). `export` flags: `-f/--format` (required), `-o/--output`.

Exit code is **0** when everything passed and **1** on any failure or path error — that is the
whole contract the binary implements today.

## MCP server (`apps/mcp-server`)

```bash
cargo build --manifest-path apps/mcp-server/Cargo.toml
```

Produces `apps/mcp-server/target/debug/reqmate-mcp`. It speaks JSON-RPC over **stdio**, so running
it by hand just blocks on stdin. Point an MCP client at the binary instead:

```json
{
  "mcpServers": {
    "reqmate": {
      "command": "/absolute/path/to/ReqMate/apps/mcp-server/target/debug/reqmate-mcp"
    }
  }
}
```

Exposed tools: `list_collections`, `list_requests`, `read_request`, `send_request`,
`list_environments`, `create_request`. Protocol version reported is `2024-11-05`.

## VS Code extension

```bash
pnpm --filter reqmate-vscode compile   # tsc -p ./
pnpm --filter reqmate-vscode watch     # incremental
```

Then open the folder in VS Code and press **F5** → *VS Code Extension Development*. There is no
checked-in `.vscode/launch.json`, so VS Code asks which environment to use on the first launch.
Activation is scoped to workspaces containing `**/.reqmate/reqmate.yaml`.

## Quality gates

These mirror `.github/workflows/ci.yml` — run them before pushing.

```bash
pnpm lint                                  # eslint (desktop)
pnpm -C apps/desktop exec tsc --noEmit     # type check
pnpm --filter @reqmate/desktop test        # vitest run
pnpm check:versions                        # every manifest matches root version
pnpm check:models                          # Rust DTOs vs TS mirrors

cd apps/desktop/src-tauri && cargo test    # Rust unit + integration tests
cd apps/desktop/src-tauri && cargo clippy -- -W warnings
cd apps/desktop/src-tauri && cargo fmt -- --check
cd apps/cli && cargo test
```

`check:versions` and `check:models` are drift guards, not style checks: they fail when a version
bumps in one manifest but not the others, or when a Rust DTO gains a field the TypeScript mirror
does not know about. Bump the version in the root `package.json` first, then propagate.

## Building release artifacts

```bash
pnpm tauri build                                    # desktop installer (all bundle targets)
cargo build --release --manifest-path apps/cli/Cargo.toml
cargo build --release --manifest-path apps/mcp-server/Cargo.toml
```

The desktop build runs `beforeBuildCommand: "pnpm build"` (`tsc -b && vite build`) first. Bundle
targets, icons, and updater settings live in `apps/desktop/src-tauri/tauri.conf.json`.

## Troubleshooting

**`cargo` fails with `Operation not permitted (os error 1)` while writing `target/`** — the shell is
sandboxed. Run the command in a foreground, non-sandboxed shell.

**`failed to read plugin permissions ... AICode/apiark/...`** — stale build-script output from the
pre-rename checkout path. Clear the cached build dirs so the build scripts re-run:

```bash
rm -rf apps/desktop/src-tauri/target/debug/build/tauri-* \
       apps/desktop/src-tauri/target/debug/build/reqmate-*
```

**Cargo registry extremely slow / stalled** — check `~/.cargo/config.toml`. A `git`-based crates.io
mirror serializes the index; switching the replace-with source to a `sparse+https://` index fixes
it.

**Port 1420 already in use** — `strictPort: true` means Tauri refuses to start rather than picking
another port. Kill the stale Vite process instead of changing the config, otherwise `devUrl` drifts
out of sync.

**Next dev hangs on start** — set `NEXT_TELEMETRY_DISABLED=1`.

**Desktop window is blank after switching branches** — `Cargo.lock` conflicts usually mean the
`src-tauri` crate needs a rebuild: `cd apps/desktop/src-tauri && cargo clean -p reqmate`.
