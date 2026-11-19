/**
 * Copy text to the clipboard, with fallbacks.
 *
 * `navigator.clipboard.writeText` requires *transient user activation*, and the
 * activation is consumed by the first `await` in a click handler. Copying a
 * value that has to be fetched over IPC first (e.g. the CA PEM) therefore
 * rejects with `NotAllowedError: The request is not allowed by the user agent…`
 * even though the user did click a button.
 *
 * Two ways out, both applied here:
 * 1. callers can pre-load the payload and copy it inside the gesture, and
 * 2. when the async API still refuses, fall back to the legacy
 *    selection + `execCommand("copy")` path, which only needs a focused
 *    document and works in every webview we ship on.
 *
 * Returns `false` when both strategies fail, so callers can surface an error
 * instead of showing a fake “Copied”.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission or activation problem — try the legacy path.
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined" || !document.body) return false;

  const previouslyFocused = document.activeElement as HTMLElement | null;
  const area = document.createElement("textarea");
  area.value = text;
  // Keep it in the layout (WebKit ignores `display:none` selections) but out of
  // sight, and readonly so the mobile keyboard never pops up.
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.width = "1px";
  area.style.height = "1px";
  area.style.padding = "0";
  area.style.border = "none";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";

  document.body.appendChild(area);
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
    previouslyFocused?.focus?.();
  }
}
