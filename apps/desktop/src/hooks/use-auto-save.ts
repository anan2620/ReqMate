import { useEffect, useRef } from "react";
import { useTabStore } from "@/stores/tab-store";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Auto-save hook: debounces saving the active tab 1 second after changes.
 * Only saves file-backed tabs (those with a filePath), and only while the
 * "auto save" preference is on — with it off, edits stay dirty until the user
 * hits Save.
 * Returns the last auto-save error (if any) for display in a banner.
 */
export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveError = useTabStore((s) => s.autoSaveError);
  const autoSaveEnabled = useSettingsStore((s) => s.settings.autoSave);

  // Turning the preference off should never leave a queued write behind
  useEffect(() => {
    if (!autoSaveEnabled && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [autoSaveEnabled]);

  useEffect(() => {
    // Subscribe to store changes and auto-save dirty file-backed tabs
    const unsubscribe = useTabStore.subscribe((state, prevState) => {
      if (!useSettingsStore.getState().settings.autoSave) return;

      const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
      const prevActiveTab = prevState.tabs.find((t) => t.id === prevState.activeTabId);

      // Only trigger auto-save if the active tab became dirty and is file-backed
      if (
        activeTab &&
        activeTab.filePath &&
        activeTab.isDirty &&
        // Check if this is a new dirty state (wasn't dirty before, or content changed)
        (!prevActiveTab || !prevActiveTab.isDirty || activeTab !== prevActiveTab)
      ) {
        // Clear previous timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        // Debounce 1 second
        timerRef.current = setTimeout(() => {
          // The preference may have been switched off while the timer was running
          if (!useSettingsStore.getState().settings.autoSave) return;
          useTabStore.getState().autoSave();
        }, 1000);
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { autoSaveError };
}
