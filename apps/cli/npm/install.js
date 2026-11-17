#!/usr/bin/env node
"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");
const https = require("https");

const VERSION = require("./package.json").version;
const REPO = "anan2620/ReqMate";

// Asset labels exactly as produced by .github/workflows/release.yml (build-cli matrix).
const TARGET_MAP = {
  "darwin-arm64": "macos-arm64",
  "darwin-x64": "macos-x86_64",
  "linux-x64": "linux-x86_64",
  "win32-x64": "windows-x86_64",
};

function getBinaryName() {
  return os.platform() === "win32" ? "reqmate.exe" : "reqmate";
}

function getDownloadUrl() {
  const label = TARGET_MAP[`${os.platform()}-${os.arch()}`];

  if (!label) {
    console.error(`Unsupported platform: ${os.platform()}-${os.arch()}`);
    console.error(`Supported: ${Object.keys(TARGET_MAP).join(", ")}`);
    process.exit(1);
  }

  const ext = os.platform() === "win32" ? ".exe" : "";
  return `https://github.com/${REPO}/releases/download/v${VERSION}/reqmate-cli-${label}${ext}`;
}

function downloadBinary(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url, redirects = 0) => {
      if (redirects > 5) return reject(new Error("Too many redirects"));

      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed: HTTP ${res.statusCode} from ${url}`));
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          try {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, Buffer.concat(chunks));
            fs.chmodSync(dest, 0o755);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

async function main() {
  const binDir = path.join(__dirname, "bin");
  const binaryPath = path.join(binDir, getBinaryName());

  // Skip download if binary already exists (e.g., local development)
  if (fs.existsSync(binaryPath)) {
    console.log("reqmate binary already exists, skipping download.");
    return;
  }

  const url = getDownloadUrl();
  console.log(`Downloading reqmate CLI v${VERSION}...`);
  console.log(`  ${url}`);

  try {
    await downloadBinary(url, binaryPath);
    console.log("reqmate CLI installed successfully.");
  } catch (err) {
    console.error(`Failed to install reqmate CLI: ${err.message}`);
    console.error("You can manually download from: https://github.com/anan2620/ReqMate/releases");
    process.exit(1);
  }
}

main();
