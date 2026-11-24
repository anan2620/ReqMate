import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui/select";
import { useMockStore } from "@/stores/mock-store";
import { useCollectionStore } from "@/stores/collection-store";
import { startMockServer, stopMockServer, listMockServers } from "@/lib/tauri-api";
import { listen } from "@tauri-apps/api/event";
import type { MockRequestLog } from "@reqmate/types";
import { Play, Square, Trash2 } from "lucide-react";

export function MockServerPanel() {
  const { t } = useTranslation();
  const {
    servers,
    logs,
    pendingCollectionPath,
    addServer,
    removeServer,
    addLog,
    clearLogs,
    setServers,
    setPendingCollectionPath,
  } = useMockStore();
  const collections = useCollectionStore((s) => s.collections);

  const [port, setPort] = useState(4000);
  const [latencyMs, setLatencyMs] = useState(0);
  const [errorRate, setErrorRate] = useState(0);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);

  // Load servers that may already be running from a previous session
  useEffect(() => {
    listMockServers().then(setServers).catch(() => {});
  }, [setServers]);

  // Selection coming from a collection context menu wins over the first item
  useEffect(() => {
    if (pendingCollectionPath) {
      setSelectedCollection(pendingCollectionPath);
      setPendingCollectionPath(null);
    }
  }, [pendingCollectionPath, setPendingCollectionPath]);

  useEffect(() => {
    if (!selectedCollection && collections.length > 0) {
      setSelectedCollection(collections[0].path);
    }
  }, [collections, selectedCollection]);

  // Keep a server selected so endpoints/logs are visible without an extra click
  useEffect(() => {
    if (servers.length === 0) {
      setActiveServerId(null);
    } else if (!activeServerId || !servers.some((s) => s.id === activeServerId)) {
      setActiveServerId(servers[0].id);
    }
  }, [servers, activeServerId]);

  // Listen for mock request events
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    for (const server of servers) {
      listen<MockRequestLog>(`mock:request:${server.id}`, (event) => {
        addLog(server.id, event.payload);
      }).then((unlisten) => unlisteners.push(unlisten));
    }

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [servers, addLog]);

  const handleStart = async () => {
    if (!selectedCollection) return;
    setStarting(true);
    setError(null);
    try {
      const status = await startMockServer({
        collectionPath: selectedCollection,
        port,
        latencyMs,
        errorRate: errorRate / 100,
      });
      addServer(status);
      setActiveServerId(status.id);
    } catch (err) {
      setError(
        typeof err === "object" && err !== null && "message" in err
          ? (err as { message: string }).message
          : String(err),
      );
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async (serverId: string) => {
    try {
      await stopMockServer(serverId);
      removeServer(serverId);
    } catch (err) {
      setError(String(err));
    }
  };

  const activeServer = servers.find((s) => s.id === activeServerId);
  const activeLogs = activeServerId ? (logs[activeServerId] ?? []) : [];

  return (
    <div className="flex min-h-0 flex-1">
      {/* Left: new server + running servers */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-[var(--color-border)]">
        <div className="shrink-0 space-y-2 border-b border-[var(--color-border)] p-3">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-dimmed)]">
            {t("mock.newMockServer")}
          </span>

          <Select
            value={selectedCollection}
            onChange={setSelectedCollection}
            options={collections.map((c) => ({ value: c.path, label: c.name }))}
            placeholder={t("mock.selectCollection", "Select a collection")}
            aria-label={t("mock.collection")}
          />

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] text-[var(--color-text-muted)]">
                {t("mock.port")}
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-[var(--color-text-muted)]">
                {t("mock.latency")}
              </label>
              <input
                type="number"
                value={latencyMs}
                onChange={(e) => setLatencyMs(Number(e.target.value))}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-[var(--color-text-muted)]">
                {t("mock.errorRate")}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={errorRate}
                onChange={(e) => setErrorRate(Number(e.target.value))}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={starting || !selectedCollection}
            className="btn-success flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            {starting ? t("mock.starting") : t("mock.start")}
          </button>

          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-dimmed)]">
            {t("mock.runningServers")} ({servers.length})
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {servers.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[var(--color-text-dimmed)]">
              {t("mock.noServers")}
            </p>
          ) : (
            servers.map((srv) => (
              <div
                key={srv.id}
                onClick={() => setActiveServerId(srv.id)}
                className={`flex cursor-pointer items-center justify-between border-b border-[var(--color-border)] px-3 py-2 transition-colors ${
                  activeServerId === srv.id
                    ? "bg-[var(--color-elevated)]"
                    : "hover:bg-[var(--color-elevated)]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-success)]" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">
                      :{srv.port} — {srv.collectionName}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {srv.endpoints.length} {t("mock.endpoints")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStop(srv.id);
                  }}
                  className="shrink-0 rounded p-1 text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                  title={t("mock.stopServer")}
                >
                  <Square className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: endpoints + request log of the selected server */}
      {activeServer ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-2">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-dimmed)]">
                {t("mock.endpoints")}
              </span>
              <span className="truncate text-[10px] text-[var(--color-text-dimmed)]">
                :{activeServer.port} · {activeServer.collectionName}
              </span>
            </div>
            <div className="max-h-[140px] overflow-auto">
              {activeServer.endpoints.map((ep, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5 text-[11px]">
                  <span className={`w-14 shrink-0 font-mono font-bold ${methodColor(ep.method)}`}>
                    {ep.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[var(--color-text-primary)]">
                    {ep.path}
                  </span>
                  <span className="shrink-0 font-mono text-[var(--color-text-muted)]">
                    {ep.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-dimmed)]">
              {t("mock.requestLog")} ({activeLogs.length})
            </span>
            <button
              onClick={() => clearLogs(activeServer.id)}
              className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              title={t("mock.clearLogs")}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 py-1.5">
            {activeLogs.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--color-text-dimmed)]">
                {t("mock.waitingForRequests")} {activeServer.port}
              </p>
            ) : (
              <div className="space-y-0.5">
                {[...activeLogs].reverse().map((log, i) => (
                  <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className={`w-9 shrink-0 text-right ${statusColor(log.status)}`}>
                      {log.status}
                    </span>
                    <span className={`w-12 shrink-0 font-bold ${methodColor(log.method)}`}>
                      {log.method}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">
                      {log.path}
                    </span>
                    <span className="shrink-0 text-[var(--color-text-dimmed)]">{log.timeMs}ms</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-text-dimmed)]">
          {t("mock.selectServer")}
        </div>
      )}
    </div>
  );
}

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET": return "text-green-500";
    case "POST": return "text-yellow-500";
    case "PUT": return "text-blue-500";
    case "PATCH": return "text-purple-500";
    case "DELETE": return "text-red-500";
    default: return "text-[var(--color-text-muted)]";
  }
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-green-500";
  if (status >= 300 && status < 400) return "text-yellow-500";
  return "text-red-500";
}
