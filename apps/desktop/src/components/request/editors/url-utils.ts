/** Extract :paramName path variables from a URL. */
export function extractPathVariables(url: string): string[] {
  const matches = url.match(/:([\w]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}
