/**
 * Window geometry tracking used by tab persistence.
 *
 * `persistTabs` runs during `beforeunload`, where async calls never resolve,
 * so maximized state and the last "normal" geometry are cached synchronously
 * and refreshed from a resize listener.
 */
let cachedMaximized = false;

// Last known "normal" (non-maximized) window geometry
let normalWindowGeometry = { x: 100, y: 100, width: 1280, height: 800 };

/**
 * Detect maximized by comparing window size to screen.availWidth/Height.
 * Tauri's isMaximized() is unreliable on some Linux WMs.
 */
export function detectMaximized(): boolean {
  const threshold = 100; // px tolerance for taskbars/panels
  return (
    window.outerWidth >= screen.availWidth - threshold &&
    window.outerHeight >= screen.availHeight - threshold
  );
}

/** Recompute the cached state; call on resize and before persisting. */
export function refreshWindowState(): void {
  if (typeof window === "undefined") return;
  cachedMaximized = detectMaximized();
  if (!cachedMaximized) {
    normalWindowGeometry = {
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight,
    };
  }
}

export function isMaximizedCached(): boolean {
  return cachedMaximized;
}

/**
 * Geometry to persist: when maximized, keep the last non-maximized size so
 * restoring does not span multiple monitors.
 */
export function getPersistableGeometry(): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return cachedMaximized
    ? normalWindowGeometry
    : {
        x: window.screenX,
        y: window.screenY,
        width: window.outerWidth,
        height: window.outerHeight,
      };
}
