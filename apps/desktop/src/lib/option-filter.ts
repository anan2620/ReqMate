/**
 * Suggestion filtering shared by the comboboxes.
 *
 * Prefix matches come first so that typing "con" surfaces `Content-Type`
 * before `Idempotency-Key`, and matching is case-insensitive because HTTP
 * header names are case-insensitive.
 */
export function filterOptions(options: readonly string[], text: string): string[] {
  const query = text.trim().toLowerCase();
  if (!query) return [...options];

  const prefix: string[] = [];
  const partial: string[] = [];
  for (const option of options) {
    const lower = option.toLowerCase();
    if (lower.startsWith(query)) prefix.push(option);
    else if (lower.includes(query)) partial.push(option);
  }
  return [...prefix, ...partial];
}
