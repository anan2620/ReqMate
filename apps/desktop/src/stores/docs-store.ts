import { create } from "zustand";

export interface DocsTarget {
  path: string;
  name: string;
}

interface DocsStore {
  open: boolean;
  /** Collections included in the next generated document */
  targets: DocsTarget[];
  openDocs: (targets: DocsTarget[]) => void;
  /** Convenience for the collection context menu: docs for a single collection */
  openDocsForCollection: (path: string, name: string) => void;
  closeDocs: () => void;
}

export const useDocsStore = create<DocsStore>((set) => ({
  open: false,
  targets: [],
  openDocs: (targets) => set({ open: true, targets }),
  openDocsForCollection: (path, name) => set({ open: true, targets: [{ path, name }] }),
  closeDocs: () => set({ open: false }),
}));
