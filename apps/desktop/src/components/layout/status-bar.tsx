import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { useEnvironmentStore } from "@/stores/environment-store";
import { useCollectionStore } from "@/stores/collection-store";
import { useMockStore } from "@/stores/mock-store";
import { useMonitorStore } from "@/stores/monitor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useConsoleStore } from "@/stores/console-store";
import { Globe, FolderOpen, Server, Activity, Columns2, Rows2, LayoutList, Terminal, ScrollText } from "lucide-react";
import type { AppSettings } from "@reqmate/types";

interface StatusBarProps {
  onToggleTerminal?: () => void;
  terminalOpen?: boolean;
}

export function StatusBar({ onToggleTerminal, terminalOpen }: StatusBarProps) {
  const { t } = useTranslation();
  // Injected at build time, so the shell still shows a version without Tauri
  const [appVersion, setAppVersion] = useState(__APP_VERSION__);
  useEffect(() => {
    getVersion()
      .then((v) => v && setAppVersion(v))
      .catch(() => {});
  }, []);
  const activeEnv = useEnvironmentStore((s) => s.activeEnvironmentName);
  const collections = useCollectionStore((s) => s.collections);
  const mockServers = useMockStore((s) => s.servers);
  const monitors = useMonitorStore((s) => s.monitors);
  const layout = useSettingsStore((s) => s.settings.layout);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const consoleEntries = useConsoleStore((s) => s.entries);
  const consoleOpen = useConsoleStore((s) => s.open);
  const toggleConsole = useConsoleStore((s) => s.toggle);
  const hasErrors = consoleEntries.some((e) => e.level === "error");

  const runningMocks = mockServers.filter((s) => s.running).length;
  const activeMonitors = monitors.filter((m) => m.enabled).length;

  const toggleLayout = () => {
    const order: AppSettings["layout"][] = ["horizontal", "vertical", "tabbed"];
    const next = order[(order.indexOf(layout) + 1) % order.length];
    updateSettings({ layout: next });
  };

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-t border-[var(--color-border)] bg-[var(--color-activity-bar)] px-2.5 text-[11.5px] text-[var(--color-text-muted)]">
      {/* Left side */}
      <div className="flex items-center gap-1">
        {activeEnv && (
          <span className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)]">
            <Globe className="h-3.5 w-3.5 opacity-80" />
            {activeEnv}
          </span>
        )}
        {collections.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)]">
            <FolderOpen className="h-3.5 w-3.5 opacity-80" />
            {collections.length} collection{collections.length !== 1 ? "s" : ""}
          </span>
        )}
        {runningMocks > 0 && (
          <span className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[var(--color-success)]">
            <Server className="h-3.5 w-3.5" />
            {runningMocks} mock{runningMocks !== 1 ? "s" : ""}
          </span>
        )}
        {activeMonitors > 0 && (
          <span className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[var(--color-success)]">
            <Activity className="h-3.5 w-3.5" />
            {activeMonitors} monitor{activeMonitors !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-0.5">
        {/* Console toggle */}
        <button
          onClick={toggleConsole}
          className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors ${
            consoleOpen
              ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              : "text-[var(--color-text-dimmed)] hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)] hover:text-[var(--color-text-secondary)]"
          }`}
          title={t("commandPalette.toggleConsole")}
        >
          <ScrollText className="h-3.5 w-3.5" />
          {consoleEntries.length > 0 && (
            <span className={`tabular text-[10px] font-semibold ${hasErrors ? "text-[var(--color-error)]" : ""}`}>
              {consoleEntries.length}
            </span>
          )}
        </button>

        {/* Terminal toggle */}
        {onToggleTerminal && (
          <button
            onClick={onToggleTerminal}
            className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors ${
              terminalOpen
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-text-dimmed)] hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)] hover:text-[var(--color-text-secondary)]"
            }`}
            title="Toggle Terminal (Ctrl+`)"
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Layout toggle */}
        <button
          onClick={toggleLayout}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[var(--color-text-dimmed)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)] hover:text-[var(--color-text-secondary)]"
          title={
            layout === "horizontal"
              ? "Switch to stacked layout"
              : layout === "vertical"
                ? "Switch to tabbed layout"
                : "Switch to side-by-side layout"
          }
        >
          {layout === "horizontal" ? (
            <Columns2 className="h-3.5 w-3.5" />
          ) : layout === "vertical" ? (
            <Rows2 className="h-3.5 w-3.5" />
          ) : (
            <LayoutList className="h-3.5 w-3.5" />
          )}
        </button>

        <span aria-hidden className="mx-1.5 h-3 w-px bg-[var(--color-border-strong)]" />
        <span className="tabular select-none text-[10.5px] text-[var(--color-text-dimmed)]">
          ReqMate v{appVersion}
        </span>
      </div>
    </div>
  );
}
