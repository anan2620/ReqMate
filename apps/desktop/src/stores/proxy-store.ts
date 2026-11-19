import { create } from "zustand";
import type { CapturedRequest, ProxyStatus } from "@/lib/tauri-api";

/** Rows kept in the list. Beyond this the panel is unreadable — and expensive. */
const MAX_CAPTURES = 500;

interface ProxyStore {
  status: ProxyStatus;
  captures: CapturedRequest[];
  selectedId: string | null;
  filter: string;

  setStatus: (status: ProxyStatus) => void;
  /** Append a batch in one update — a capture burst must not cause a render each. */
  appendCaptures: (captures: CapturedRequest[]) => void;
  setCaptures: (captures: CapturedRequest[]) => void;
  clearCaptures: () => void;
  selectCapture: (id: string | null) => void;
  setFilter: (filter: string) => void;
}

export const useProxyStore = create<ProxyStore>((set) => ({
  status: { running: false, port: 8888, captureCount: 0, mitm: false },
  captures: [],
  selectedId: null,
  filter: "",

  setStatus: (status) => set({ status }),
  appendCaptures: (batch) =>
    set((s) => {
      if (batch.length === 0) return s;
      // Never copy the whole list twice for a burst: slice once, append once.
      const next =
        batch.length >= MAX_CAPTURES
          ? batch.slice(-MAX_CAPTURES)
          : [...s.captures, ...batch].slice(-MAX_CAPTURES);
      return {
        captures: next,
        status: { ...s.status, captureCount: next.length },
      };
    }),
  setCaptures: (captures) =>
    set((s) => ({
      captures: captures.slice(-MAX_CAPTURES),
      status: { ...s.status, captureCount: Math.min(captures.length, MAX_CAPTURES) },
    })),
  clearCaptures: () =>
    set((s) => ({
      captures: [],
      selectedId: null,
      status: { ...s.status, captureCount: 0 },
    })),
  selectCapture: (id) => set({ selectedId: id }),
  setFilter: (filter) => set({ filter }),
}));
