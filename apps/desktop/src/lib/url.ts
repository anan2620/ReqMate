/**
 * Extract `:paramName` path variables from a URL.
 *
 * Only the path is scanned: the scheme (`http:`), the port (`:31017`) and the
 * query string are not path variables. A name must also start with a letter so
 * a bare `:31017` can never be mistaken for one.
 */
export function extractPathVariables(url: string): string[] {
  // Drop the scheme, then everything up to the first "/" (the authority).
  const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").trim();
  const pathStart = withoutScheme.indexOf("/");
  if (pathStart === -1) return [];

  const path = withoutScheme.slice(pathStart).split(/[?#]/)[0];

  const names: string[] = [];
  const regex = /(?:^|\/):([A-Za-z_][\w-]*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(path)) !== null) {
    names.push(match[1]);
  }

  return [...new Set(names)];
}

/**
 * Substitute `:paramName` path variables with their values.
 *
 * Matching is limited to whole `:name` segments, so a port (`:31017`), a stale
 * variable key, or a `:name` inside the query string is never rewritten.
 */
export function resolvePathVariables(url: string, values: Record<string, string>): string {
  let resolved = url.trim();
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    resolved = resolved.replace(
      new RegExp(`(^|/):${escaped}(?=[/?#]|$)`, "g"),
      (_match, prefix: string) => `${prefix}${encodeURIComponent(value)}`,
    );
  }
  return resolved;
}
