import { createRequire } from "node:module";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);
// Single source of truth: the workspace root package.json (see scripts/check-versions.mjs)
const { version } = require("../../package.json") as { version: string };

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    root: "../..",
  },
  // Inlined at build time so the site never shows a stale version number
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
