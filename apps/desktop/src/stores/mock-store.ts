import { create } from "zustand";
import type { MockServerStatus, MockRequestLog } from "@reqmate/types";

interface MockStore {
  servers: MockServerStatus[];
  logs: Record<string, MockRequestLog[]>; // keyed by server_id
  /** Collection the right-hand mock panel is scoped to, when opened from a collection. */
  pendingCollectionPath: string | null;

  setServers: (servers: MockServerStatus[]) => void;
  addServer: (server: MockServerStatus) => void;
  removeServer: (serverId: string) => void;
  addLog: (serverId: string, log: MockRequestLog) => void;
  clearLogs: (serverId: string) => void;
  setPendingCollectionPath: (path: string | null) => void;
}

export const useMockStore = create<MockStore>((set) => ({
  servers: [],
  logs: {},
  pendingCollectionPath: null,

  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((s) => ({ servers: [...s.servers, server] })),

  removeServer: (serverId) =>
    set((s) => ({
      servers: s.servers.filter((srv) => srv.id !== serverId),
      logs: Object.fromEntries(
        Object.entries(s.logs).filter(([k]) => k !== serverId),
      ),
    })),

  addLog: (serverId, log) =>
    set((s) => {
      const existing = s.logs[serverId] ?? [];
      // Keep last 200 logs per server
      const updated = [...existing, log].slice(-200);
      return { logs: { ...s.logs, [serverId]: updated } };
    }),

  clearLogs: (serverId) =>
    set((s) => ({ logs: { ...s.logs, [serverId]: [] } })),

  setPendingCollectionPath: (path) => set({ pendingCollectionPath: path }),
}));
