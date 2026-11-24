import { useTranslation } from "react-i18next";
import {
  FolderOpen,
  Globe,
  Clock,
  Settings,
  Terminal,
  Server,
  FileText,
  Activity,
  MessageSquare,
  Shield,
  GitBranch,
  ClipboardList,
} from "lucide-react";

export type ActivityView = "collections" | "environments" | "history" | "git" | "mock" | "monitor" | "docs" | "proxy" | "audit";

interface ActivityBarProps {
  activeView: ActivityView;
  /** Tool surface currently replacing the editor area, if any */
  surface?: "mock" | "monitor" | null;
  onViewChange: (view: ActivityView) => void;
  onOpenSettings: () => void;
  onOpenAi: () => void;
  onToggleTerminal: () => void;
}

const TOP_ITEMS: { id: ActivityView; icon: typeof FolderOpen; labelKey: string }[] = [
  { id: "collections", icon: FolderOpen, labelKey: "sidebar.collections" },
  { id: "environments", icon: Globe, labelKey: "sidebar.environments" },
  { id: "history", icon: Clock, labelKey: "history.title" },
  { id: "git", icon: GitBranch, labelKey: "git.title" },
];

const BOTTOM_ITEMS: { id: ActivityView; icon: typeof Server; labelKey: string }[] = [
  { id: "mock", icon: Server, labelKey: "mock.title" },
  { id: "monitor", icon: Activity, labelKey: "monitor.title" },
  { id: "docs", icon: FileText, labelKey: "docs.title" },
  { id: "proxy", icon: Shield, labelKey: "proxy.title" },
  { id: "audit", icon: ClipboardList, labelKey: "audit.title" },
];

export function ActivityBar({
  activeView,
  surface,
  onViewChange,
  onOpenSettings,
  onOpenAi,
  onToggleTerminal,
}: ActivityBarProps) {
  const { t } = useTranslation();
  // Mock/health are full-surface tools: while one owns the work area it is the
  // only highlighted entry, and the sidebar view it replaced stays dark.
  const isActive = (id: ActivityView) => {
    if (surface) return id === surface;
    if (id === "mock" || id === "monitor") return false;
    return activeView === id;
  };

  return (
    <div className="relative flex w-[54px] shrink-0 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-activity-bar)] pb-3 pt-3.5">
      {/* Logo */}
      <button
        onClick={() => onViewChange("collections")}
        title="ReqMate"
        className="group relative mb-5 flex h-9 w-9 items-center justify-center rounded-[10px] transition-transform duration-200 active:scale-95"
      >
        <img
          src="/app-icon.png"
          alt="ReqMate"
          className="h-9 w-9 rounded-[10px] ring-1 ring-[color-mix(in_srgb,var(--color-text-primary)_10%,transparent)]"
        />
      </button>

      {/* Top nav items */}
      <div className="flex flex-col items-center gap-1">
        {TOP_ITEMS.map((item) => (
          <ActivityBarButton
            key={item.id}
            icon={item.icon}
            label={t(item.labelKey)}
            active={isActive(item.id)}
            onClick={() => onViewChange(item.id)}
          />
        ))}
      </div>

      <div className="my-3 h-px w-6 bg-[var(--color-border)]" />

      {/* Bottom nav items */}
      <div className="flex flex-col items-center gap-1">
        {BOTTOM_ITEMS.map((item) => (
          <ActivityBarButton
            key={item.id}
            icon={item.icon}
            label={t(item.labelKey)}
            active={isActive(item.id)}
            onClick={() => onViewChange(item.id)}
          />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1">
        <ActivityBarButton icon={MessageSquare} label={`${t("ai.title")} (Ctrl+Shift+A)`} onClick={onOpenAi} />
        <ActivityBarButton icon={Terminal} label={`${t("console.terminal")} (Ctrl+\`)`} onClick={onToggleTerminal} />
        <ActivityBarButton icon={Settings} label={`${t("settings.title")} (Ctrl+,)`} onClick={onOpenSettings} />
      </div>
    </div>
  );
}

function ActivityBarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof FolderOpen;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors duration-150 ${
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]"
          : "text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)] hover:text-[var(--color-text-secondary)]"
      }`}
    >
      {/* Active indicator rail */}
      <span
        aria-hidden
        className={`absolute -left-[7px] top-1/2 w-[2px] -translate-y-1/2 bg-[var(--color-accent)] transition-all duration-200 ${
          active ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
      />
      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.6} />
    </button>
  );
}
