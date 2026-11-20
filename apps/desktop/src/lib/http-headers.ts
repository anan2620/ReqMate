/**
 * Header keys offered as presets by the request editor.
 *
 * These are only suggestions — the key field still accepts any text, so custom
 * and vendor headers (`X-...`) can be typed freely. Kept as plain protocol
 * tokens on purpose: header names are never localised.
 */
export const COMMON_REQUEST_HEADERS: readonly string[] = [
  "Authorization",
  "Cookie",
  "Content-Type",
  "Content-Range",
  "Content-Encoding",
  "Content-Length",
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Cache-Control",
  "Origin",
  "Referer",
  "User-Agent",
  "If-Match",
  "If-None-Match",
  "If-Modified-Since",
  "Range",
  "Idempotency-Key",
  "X-Request-Id",
];
