import { useEffect, useRef } from "react";
import { useTabStore } from "@/stores/tab-store";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Auto-save hook: debounces a save for every dirty file-backed tab, with one
 * timer per tab.
 *
 * Scheduling per tab (rather than "save whatever is active when the timer
 * fires") matters because the user can switch or close a tab inside the
 * debounce window — the previous implementation then saved the *new* active tab
 * and left the edited one dirty forever, so it never reached disk and the quit
 * prompt stayed silent.
 *
 * Returns the last auto-save error (if any) for display in a banner.
 */
export function useAutoSave() {
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const autoSaveError = useTabStore((s) => s.autoSaveError);
  const autoSaveEnabled = useSettingsStore((s) => s.settings.autoSave);

  // Turning the preference off should never leave a queued write behind
  useEffect(() => {
    if (autoSaveEnabled) return;
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
  }, [autoSaveEnabled]);

  useEffect(() => {
    const timers = timersRef.current;

    const clearTimer = (tabId: string) => {
      const timer = timers.get(tabId);
      if (timer !== undefined) {
        clearTimeout(timer);
        timers.delete(tabId);
      }
    };

    const unsubscribe = useTabStore.subscribe((state, prevState) => {
      if (!useSettingsStore.getState().settings.autoSave) return;

      // Forget timers whose tab is gone
      const liveIds = new Set(state.tabs.map((t) => t.id));
      for (const id of [...timers.keys()]) {
        if (!liveIds.has(id)) clearTimer(id);
      }

      for (const tab of state.tabs) {
        if (!tab.filePath || !tab.isDirty) continue;

        const prevTab = prevState.tabs.find((t) => t.id === tab.id);
        // Only react to tabs that actually changed
        if (prevTab === tab) continue;

        clearTimer(tab.id);
        timers.set(
          tab.id,
          setTimeout(() => {
            timers.delete(tab.id);
            // The preference may have been switched off while waiting
            if (!useSettingsStore.getState().settings.autoSave) return;
            void useTabStore.getState().autoSave(tab.id);
          }, 1000),
        );
      }
    });

    return () => {
      unsubscribe();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return { autoSaveError };
}
