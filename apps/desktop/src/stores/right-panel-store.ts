import { create } from "zustand";

/** Which tool surface currently replaces the editor area. */
export type RightPanelKind = "mock" | "monitor" | null;

interface RightPanelStore {
  kind: RightPanelKind;
  open: (kind: Exclude<RightPanelKind, null>) => void;
  close: () => void;
  /** Opens the panel if it is closed or showing something else, closes it otherwise. */
  toggle: (kind: Exclude<RightPanelKind, null>) => void;
}

export const useRightPanelStore = create<RightPanelStore>((set, get) => ({
  kind: null,
  open: (kind) => set({ kind }),
  close: () => set({ kind: null }),
  toggle: (kind) => set({ kind: get().kind === kind ? null : kind }),
}));
