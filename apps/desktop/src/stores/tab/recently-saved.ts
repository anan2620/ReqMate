/**
 * Tracks file paths that were recently saved by us (save/autoSave).
 * The file watcher checks this set to avoid reloading tabs that we just wrote.
 */
const recentlySavedPaths = new Set<string>();
const RECENTLY_SAVED_TTL = 2000; // ms — ignore watcher events for this long after save

export function markRecentlySaved(filePath: string): void {
  recentlySavedPaths.add(filePath);
  setTimeout(() => recentlySavedPaths.delete(filePath), RECENTLY_SAVED_TTL);
}

export function wasRecentlySaved(filePath: string): boolean {
  return recentlySavedPaths.has(filePath);
}
