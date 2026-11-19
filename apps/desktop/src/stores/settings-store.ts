import { create } from "zustand";
import type { AppSettings } from "@reqmate/types";
import { getSettings, updateSettings as updateSettingsApi } from "@/lib/tauri-api";

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  /** Write any pending changes immediately (dialog close, app exit). */
  flushSettings: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  theme: "dark",
  accentColor: "indigo",
  proxyMode: "system",
  proxyType: "http",
  proxyHost: null,
  proxyPort: null,
  proxyBypass: null,
  proxyUsername: null,
  proxyPassword: null,
  verifySsl: true,
  followRedirects: true,
  timeoutMs: 30000,
  sidebarWidth: 400,
  onboardingComplete: false,
  crashReportsEnabled: null,
  caCertPath: null,
  clientCertPath: null,
  clientKeyPath: null,
  clientCertPassphrase: null,
  updateChannel: "stable",
  aiEndpoint: null,
  aiApiKey: null,
  aiModel: null,
  panelRatio: 0.5,
  layout: "horizontal",
  autoSave: true,
  defaultCollectionPath: "",
};

/**
 * Settings are typed into text fields one character at a time. Writing on every
 * keystroke both hammers the disk and loses input: the input's value came from
 * the store, which only changed after the IPC round-trip, so fast typing
 * outran the echo. Apply the patch locally right away and coalesce persistence
 * into one debounced write instead.
 */
const WRITE_DELAY_MS = 250;

let pending: Partial<AppSettings> = {};
let writeTimer: ReturnType<typeof setTimeout> | null = null;
// Bumped on every local edit, so a slow response can't clobber newer input.
let editSeq = 0;

export const useSettingsStore = create<SettingsState>((set) => {
  const write = async () => {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    const patch = pending;
    pending = {};
    if (Object.keys(patch).length === 0) return;

    const seqAtSend = editSeq;
    try {
      const settings = await updateSettingsApi(patch);
      // Only adopt the server's echo if the user hasn't edited since —
      // otherwise it is already stale and would revert their typing.
      if (editSeq === seqAtSend) set({ settings });
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to save settings: ${err}`),
      );
    }
  };

  const scheduleWrite = () => {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      void write();
    }, WRITE_DELAY_MS);
  };

  return {
    settings: defaultSettings,
    loaded: false,

    loadSettings: async () => {
      try {
        const settings = await getSettings();
        set({ settings, loaded: true });
      } catch {
        // Settings load failure on startup — use defaults silently but warn
        import("@/stores/toast-store").then(({ useToastStore }) =>
          useToastStore.getState().showWarning("Could not load settings — using defaults"),
        );
        set({ loaded: true });
      }
    },

    updateSettings: async (patch) => {
      editSeq += 1;
      set((state) => ({ settings: { ...state.settings, ...patch } }));
      pending = { ...pending, ...patch };
      scheduleWrite();
    },

    flushSettings: async () => {
      if (Object.keys(pending).length === 0) return;
      await write();
    },
  };
});

// Best-effort flush so the last keystrokes survive an immediate quit.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (Object.keys(pending).length > 0) {
      void useSettingsStore.getState().flushSettings();
    }
  });
}

/** Test helper: drop any queued write and reset sequencing. */
export function __resetSettingsWriteQueue() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  pending = {};
  editSeq = 0;
}
