import { create } from "zustand";

export interface ConsoleLogEntry {
  id: number;
  timestamp: number;
  level: "log" | "info" | "warn" | "error";
  source: string;
  message: string;
}

/** Which tab of the bottom panel is active. */
export type BottomPanelTab = "console" | "terminal";

interface ConsoleState {
  entries: ConsoleLogEntry[];
  /** Bottom panel visibility — the console and the terminal share one panel. */
  open: boolean;
  /** Active tab of the bottom panel. */
  panel: BottomPanelTab;
  height: number;
  filter: "all" | "log" | "info" | "warn" | "error";

  log: (source: string, message: string, level?: ConsoleLogEntry["level"]) => void;
  clear: () => void;
  /** Toggle the console tab — opens the panel on the console when closed. */
  toggle: () => void;
  /** Toggle the terminal tab — opens the panel on the terminal when closed. */
  toggleTerminal: () => void;
  setOpen: (open: boolean) => void;
  setPanel: (panel: BottomPanelTab) => void;
  setHeight: (height: number) => void;
  setFilter: (filter: ConsoleState["filter"]) => void;
}

let nextId = 1;

export const useConsoleStore = create<ConsoleState>((set) => ({
  entries: [],
  open: false,
  panel: "console",
  height: 200,
  filter: "all",

  log: (source, message, level = "log") => {
    set((state) => ({
      entries: [
        ...state.entries.slice(-999),
        { id: nextId++, timestamp: Date.now(), level, source, message },
      ],
    }));
  },

  clear: () => set({ entries: [] }),
  // Both toggles are panel-aware: if the panel already shows that tab it
  // closes, otherwise it opens on that tab. One click always does the right
  // thing, no matter which tab was visible before (the old two-boolean model
  // made "console is open → click terminal" a no-op that took two clicks).
  toggle: () =>
    set((s) =>
      s.open && s.panel === "console"
        ? { open: false }
        : { open: true, panel: "console" },
    ),
  toggleTerminal: () =>
    set((s) =>
      s.open && s.panel === "terminal"
        ? { open: false }
        : { open: true, panel: "terminal" },
    ),
  setOpen: (open) => set({ open }),
  setPanel: (panel) => set({ open: true, panel }),
  setHeight: (height) => set({ height: Math.max(100, Math.min(500, height)) }),
  setFilter: (filter) => set({ filter }),
}));
