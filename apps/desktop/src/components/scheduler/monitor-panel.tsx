import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui/select";
import { useMonitorStore } from "@/stores/monitor-store";
import { useCollectionStore } from "@/stores/collection-store";
import {
  createMonitor,
  deleteMonitor,
  toggleMonitor,
  listMonitors,
  getMonitorResults,
} from "@/lib/tauri-api";
import { listen } from "@tauri-apps/api/event";
import type { MonitorResult } from "@reqmate/types";
import { Plus, Trash2, Play, Pause, Loader2 } from "lucide-react";

const CRON_PRESETS = [
  { label: "Every minute", value: "0 * * * * *" },
  { label: "Every 5 minutes", value: "0 */5 * * * *" },
  { label: "Every 15 minutes", value: "0 */15 * * * *" },
  { label: "Every hour", value: "0 0 * * * *" },
  { label: "Every 6 hours", value: "0 0 */6 * * *" },
  { label: "Daily at midnight", value: "0 0 0 * * *" },
];

export function MonitorPanel() {
  const { t } = useTranslation();
  const {
    monitors,
    results,
    selectedMonitorId,
    setMonitors,
    addMonitor,
    removeMonitor,
    updateMonitor,
    selectMonitor,
    setResults,
    addResult,
  } = useMonitorStore();
  const collections = useCollectionStore((s) => s.collections);

  const [name, setName] = useState("");
  const [collectionPath, setCollectionPath] = useState("");
  const [cronExpression, setCronExpression] = useState("0 */5 * * * *");
  const [environmentName, setEnvironmentName] = useState("");
  const [notifyOnFailure, setNotifyOnFailure] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load monitors on mount
  useEffect(() => {
    listMonitors().then(setMonitors).catch(() => {});
  }, [setMonitors]);

  // Default collection
  useEffect(() => {
    if (!collectionPath && collections.length > 0) {
      setCollectionPath(collections[0].path);
    }
  }, [collections, collectionPath]);

  // Keep one monitor selected so its history is visible straight away
  useEffect(() => {
    if (monitors.length === 0) {
      if (selectedMonitorId) selectMonitor(null);
    } else if (!selectedMonitorId || !monitors.some((m) => m.id === selectedMonitorId)) {
      selectMonitor(monitors[0].id);
    }
  }, [monitors, selectedMonitorId, selectMonitor]);

  // Listen for monitor result events
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    for (const monitor of monitors) {
      listen<MonitorResult>(`monitor:result:${monitor.id}`, (event) => {
        addResult(monitor.id, event.payload);
        // Refresh monitor list to get updated status
        listMonitors().then(setMonitors).catch(() => {});
      }).then((unlisten) => unlisteners.push(unlisten));
    }

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [monitors, addResult, setMonitors]);

  // Load results when selecting a monitor
  useEffect(() => {
    if (selectedMonitorId) {
      getMonitorResults(selectedMonitorId)
        .then((r) => setResults(selectedMonitorId, r))
        .catch(() => {});
    }
  }, [selectedMonitorId, setResults]);

  const handleCreate = async () => {
    if (!name || !collectionPath) return;
    setCreating(true);
    setError(null);
    try {
      const status = await createMonitor({
        name,
        collectionPath,
        cronExpression,
        environmentName: environmentName || undefined,
        notifyOnFailure,
        webhookUrl: webhookUrl || undefined,
      });
      addMonitor(status);
      selectMonitor(status.id);
      setName("");
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMonitor(id);
      removeMonitor(id);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const updated = await toggleMonitor(id);
      updateMonitor(updated);
    } catch (err) {
      setError(String(err));
    }
  };

  const selectedResults = selectedMonitorId ? (results[selectedMonitorId] ?? []) : [];
  const selectedMonitor = monitors.find((m) => m.id === selectedMonitorId);

  return (
    <div className="flex min-h-0 flex-1">
      {/* Left: new monitor + monitor list */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-[var(--color-border)]">
        <div className="shrink-0 space-y-2 border-b border-[var(--color-border)] p-3">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-dimmed)]">
            {t("monitor.create")}
          </span>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("monitor.namePlaceholder")}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <Select
            value={collectionPath}
            onChange={setCollectionPath}
            options={collections.map((c) => ({ value: c.path, label: c.name }))}
            placeholder={t("monitor.selectCollection", "Select a collection")}
            aria-label={t("monitor.collection")}
          />
          <div>
            <label className="mb-0.5 block text-[10px] text-[var(--color-text-muted)]">
              {t("monitor.schedule")}
            </label>
            <Select
              value={cronExpression}
              onChange={setCronExpression}
              options={CRON_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
              aria-label={t("monitor.schedule")}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={environmentName}
              onChange={(e) => setEnvironmentName(e.target.value)}
              placeholder={t("monitor.environmentOptional")}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder={t("monitor.webhookOptional")}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={notifyOnFailure}
              onChange={(e) => setNotifyOnFailure(e.target.checked)}
            />
            {t("monitor.notifyOnFailure")}
          </label>
          <button
            onClick={handleCreate}
            disabled={creating || !name || !collectionPath}
            className="btn-accent flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {t("monitor.newMonitor")}
          </button>
          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-dimmed)]">
            {t("monitor.title")} ({monitors.length})
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {monitors.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[var(--color-text-dimmed)]">
              {t("monitor.noneConfigured")}
            </p>
          ) : (
            monitors.map((m) => (
              <div
                key={m.id}
                onClick={() => selectMonitor(m.id)}
                className={`flex cursor-pointer items-center justify-between border-b border-[var(--color-border)] px-3 py-2 transition-colors ${
                  selectedMonitorId === m.id
                    ? "bg-[var(--color-elevated)]"
                    : "hover:bg-[var(--color-elevated)]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        m.lastStatus === "pass"
                          ? "bg-[var(--color-success)]"
                          : m.lastStatus === "fail"
                            ? "bg-[var(--color-error)]"
                            : "bg-[var(--color-text-dimmed)]"
                      }`}
                    />
                    <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">
                      {m.name}
                    </p>
                  </div>
                  <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                    {t("monitor.runs", { count: m.runCount })} ·{" "}
                    {m.enabled ? t("monitor.enabled") : t("monitor.disabled")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(m.id);
                    }}
                    className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                    title={m.enabled ? t("monitor.disabled") : t("monitor.enabled")}
                  >
                    {m.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(m.id);
                    }}
                    className="rounded p-1 text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: results of the selected monitor */}
      {selectedMonitor ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-2">
            <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {selectedMonitor.name}
            </p>
            <p className="truncate text-[11px] text-[var(--color-text-muted)]">
              {selectedMonitor.cronExpression} ·{" "}
              {selectedMonitor.enabled ? t("monitor.enabled") : t("monitor.disabled")}
              {selectedMonitor.lastRun &&
                ` · ${t("monitor.lastRun")} ${new Date(selectedMonitor.lastRun).toLocaleString()}`}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {selectedResults.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-[var(--color-text-dimmed)]">
                {t("monitor.noResults")}
              </p>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[var(--color-card)]">
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-dimmed)]">
                    <th className="px-4 py-1.5 font-medium">{t("monitor.time")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("monitor.status")}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t("monitor.requests")}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t("monitor.passed")}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t("monitor.failed")}</th>
                    <th className="px-4 py-1.5 text-right font-medium">{t("monitor.duration")}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResults.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-elevated)]"
                    >
                      <td className="px-4 py-1.5 text-[var(--color-text-secondary)]">
                        {new Date(r.timestamp).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            r.status === "pass"
                              ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                              : "bg-[var(--color-error)]/15 text-[var(--color-error)]"
                          }`}
                        >
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-[var(--color-text-primary)]">
                        {r.totalRequests}
                      </td>
                      <td className="px-2 py-1.5 text-right text-green-500">{r.totalPassed}</td>
                      <td className="px-2 py-1.5 text-right text-red-500">{r.totalFailed}</td>
                      <td className="px-4 py-1.5 text-right text-[var(--color-text-muted)]">
                        {r.totalTimeMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-text-dimmed)]">
          {t("monitor.selectToView")}
        </div>
      )}
    </div>
  );
}
