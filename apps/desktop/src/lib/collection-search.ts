import type { CollectionNode } from "@reqmate/types";

/**
 * Search helpers for the collection sidebar.
 *
 * Kept free of React/Tauri imports so the matching rules can be unit tested —
 * a wrong answer here makes search hits vanish behind collapsed folders.
 */

/** Fuzzy subsequence match with scoring.
 * Returns a score > 0 if query is a fuzzy match for text, 0 otherwise.
 * Bonuses for consecutive matches and word-boundary matches. */
export function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  let ti = 0;
  let prevMatched = false;
  for (let qi = 0; qi < q.length; qi++) {
    let found = false;
    while (ti < t.length) {
      if (t[ti] === q[qi]) {
        score += 1;
        // Consecutive match bonus
        if (prevMatched) score += 2;
        // Word boundary bonus (start of string, after space/hyphen/underscore)
        if (ti === 0 || /[\s\-_/.]/.test(t[ti - 1])) score += 3;
        prevMatched = true;
        ti++;
        found = true;
        break;
      }
      prevMatched = false;
      ti++;
    }
    if (!found) return 0;
  }
  return score;
}

/** Check if a node or its children match a search query (fuzzy) */
export function nodeMatchesSearch(node: CollectionNode, query: string): boolean {
  if (!query) return true;
  if (fuzzyScore(node.name, query) > 0) return true;
  if (node.type !== "request" && node.children.length > 0) {
    return node.children.some((child) => nodeMatchesSearch(child, query));
  }
  return false;
}
