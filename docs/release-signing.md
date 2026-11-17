# Release signing (auto-updates)

ReqMate ships Tauri's updater. The app refuses any update bundle whose signature does
not match the public key compiled into it, so the signing keypair is what actually
authorises an update. Lose the private key and existing installs can never be updated
again — they would have to be reinstalled by hand.

## One-time setup

### 1. Generate a keypair

```bash
cd apps/desktop
pnpm exec tauri signer generate -w ~/.tauri/reqmate.key
```

You are prompted for a password. Use a long random one; store it in your password
manager. Two files appear:

- `~/.tauri/reqmate.key` — private key, never commit it
- `~/.tauri/reqmate.key.pub` — public key

`chmod 600 ~/.tauri/reqmate.key` if the tool did not already.

### 2. Put the public key in the app config

Copy the **entire contents** of `reqmate.key.pub` (it is a base64 blob, not a PEM) into
`apps/desktop/src-tauri/tauri.conf.json`:

```json
"plugins": {
  "updater": {
    "endpoints": [
      "https://github.com/anan2620/ReqMate/releases/latest/download/latest.json"
    ],
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6..."
  }
}
```

### 3. Put the private key in GitHub Actions secrets

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | contents of `~/.tauri/reqmate.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | the password from step 1 |

`.github/workflows/release.yml` already reads both. Without them `tauri build`
produces unsigned bundles and the release step fails on the updater artifact.

### 4. Verify

```bash
pnpm tauri build
```

Next to each installer you should see a `.sig` file, and the build writes
`latest.json` for the updater endpoint. A release is only complete once that JSON is
attached to the GitHub release — `releases/latest/download/latest.json` must resolve.

## Rotating the key (the trap)

A new keypair is a **breaking change for existing installs**: they were compiled with
the old public key and will reject everything signed by the new private key. If you
must rotate:

1. Keep the old key available.
2. Ship one transitional release that is still signed with the **old** key, but whose
   `tauri.conf.json` carries the **new** public key.
3. From the next release on, sign with the new key.

Skipping step 2 strands every prior install on the manual-download path.

## Alternatives to the password prompt

For local signing without a password file:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/reqmate.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="…"
pnpm tauri build
```

`TAURI_SIGNING_PRIVATE_KEY_PATH` also works if you would rather point at the file than
inline its contents.
