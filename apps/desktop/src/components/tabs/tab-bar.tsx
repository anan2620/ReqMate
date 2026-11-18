import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { HttpMethod, Tab } from "@reqmate/types";
import { useTabStore } from "@/stores/tab-store";
import {
  useShortcutsStore,
  formatBindingParts,
} from "@/stores/shortcuts-store";
import {
  Plus,
  X,
  Globe,
  Zap,
  Radio,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pin,
  Save,
  Check,
  FilePlus2,
  Terminal,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "method-get",
  POST: "method-post",
  PUT: "method-put",
  PATCH: "method-patch",
  DELETE: "method-delete",
  HEAD: "method-head",
  OPTIONS: "method-options",
};

function TabBadge({ tab }: { tab: Tab }) {
  const badges: Record<string, { cls: string; label: string }> = {
    graphql: { cls: "method-graphql", label: "GQL" },
    websocket: { cls: "method-websocket", label: "WS" },
    sse: { cls: "method-sse", label: "SSE" },
    grpc: { cls: "method-grpc", label: "gRPC" },
    mqtt: { cls: "method-mqtt", label: "MQTT" },
    socketio: { cls: "method-socketio", label: "SIO" },
  };

  if (tab.protocol !== "http") {
    const badge = badges[tab.protocol];
    return (
      <span
        className={`pill !px-1.5 !py-0 !text-[9.5px] !leading-[14px] ${badge?.cls ?? ""}`}
      >
        {badge?.label ?? tab.protocol}
      </span>
    );
  }

  return (
    <span
      className={`pill !px-1.5 !py-0 !text-[9.5px] !leading-[14px] ${METHOD_COLORS[tab.method]}`}
    >
      {tab.method}
    </span>
  );
}

const MENU_WIDTH = 194;
const MENU_HEIGHT = 258;

function SortableTab({
  tab,
  isActive,
  onActivate,
  onClose,
  onDetach,
  onCloseOthers,
  onCloseAll,
  onTogglePin,
  onDuplicate,
}: {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onDetach: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onTogglePin: () => void;
  onDuplicate: () => void;
}) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = (e: Event) => {
      if (
        e instanceof MouseEvent &&
        menuRef.current?.contains(e.target as Node)
      )
        return;
      setContextMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", dismiss);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8),
      y: Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - 8),
    });
  };

  const menuItems: Array<{ label: string; action: () => void } | null> = [
    {
      label: tab.pinned ? t("tabs.unpinTab") : t("tabs.pinTab"),
      action: onTogglePin,
    },
    { label: t("tabs.duplicateTab"), action: onDuplicate },
    null,
    { label: t("tabs.close"), action: onClose },
    { label: t("tabs.closeOthers"), action: onCloseOthers },
    { label: t("tabs.closeAll"), action: onCloseAll },
    null,
    { label: t("tabs.moveToNewWindow"), action: onDetach },
  ];

  return (
    <>
      <button
        ref={setNodeRef}
        style={style}
        data-tab-id={tab.id}
        {...attributes}
        {...listeners}
        onClick={onActivate}
        onMouseDown={(e) => {
          if (e.button === 1 && !tab.pinned) {
            e.preventDefault();
            onClose();
          }
        }}
        onContextMenu={handleContextMenu}
        className={`group relative flex h-full shrink-0 select-none items-center gap-2 rounded-t-[4px] border-x border-b-0 border-t-2 border-transparent pl-2.5 text-[12.5px] transition-[background-color,color,box-shadow] duration-150 ${
          tab.pinned ? "pr-2.5" : "pr-7"
        } ${
          isActive
            ? "tab-item-active font-medium text-[var(--color-text-primary)]"
            : "text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--color-text-primary)_5%,transparent)] hover:text-[var(--color-text-secondary)]"
        }`}
      >
        {tab.pinned && (
          <Pin className="h-3 w-3 shrink-0 rotate-45 text-[var(--color-accent-text)]" />
        )}
        <TabBadge tab={tab} />
        <span className="max-w-[168px] truncate leading-none">{tab.name}</span>

        {/* Trailing affordance — dirty dot swaps to a close button on hover */}
        {!tab.pinned && (
          <span className="absolute right-1.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center">
            {tab.isDirty && (
              <span className="h-[6px] w-[6px] rounded-full bg-[var(--color-accent)] transition-opacity duration-150 group-hover:opacity-0" />
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label={t("tabs.close")}
              className={`absolute inset-0 flex items-center justify-center rounded-[5px] text-[var(--color-text-muted)] transition-all duration-150 hover:bg-[color-mix(in_srgb,var(--color-text-primary)_10%,transparent)] hover:text-[var(--color-text-primary)] ${
                isActive && !tab.isDirty
                  ? "opacity-50 group-hover:opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <X className="h-3 w-3" />
            </span>
          </span>
        )}
      </button>

      {/* Rendered in a portal so the scrolling tab strip can't clip or mask it */}
      {contextMenu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onContextMenu={(e) => e.preventDefault()}
            className="surface-pop animate-panel-in fixed z-[90] min-w-[194px] overflow-hidden rounded-lg py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {menuItems.map((item, i) =>
              item === null ? (
                <div
                  key={i}
                  className="my-1 border-t border-[var(--color-border-strong)]/60"
                />
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    item.action();
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center px-3 py-[7px] text-left text-[12.5px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-text-primary)]"
                >
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Save split-button: the main half saves in place (or opens Save As for a
 * request that has no file yet), the chevron exposes "Save as…".
 */
function SaveControl({ tab }: { tab: Tab | undefined }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Flash a "saved" confirmation for a moment after a successful write, so a
  // save that changes nothing visible still gives clear feedback.
  const savePulse = useTabStore((s) => s.savePulse);
  const tabId = tab?.id;
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!savePulse || savePulse.tabId !== tabId) return;
    setJustSaved(true);
    const timer = setTimeout(() => setJustSaved(false), 1800);
    return () => clearTimeout(timer);
  }, [savePulse, tabId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!tab) return null;

  const openSaveAs = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("reqmate:open-save-as"));
  };

  const handleSave = () => {
    setOpen(false);
    if (tab.filePath) {
      useTabStore.getState().save();
    } else {
      window.dispatchEvent(new CustomEvent("reqmate:open-save-as"));
    }
  };

  const saveHint = formatBindingParts(
    useShortcutsStore.getState().getBinding("save"),
  ).join("");
  const saveAsHint = formatBindingParts(
    useShortcutsStore.getState().getBinding("saveAs"),
  ).join("");

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <button
        onClick={handleSave}
        title={`${t("common.save")} (${saveHint})`}
        aria-live="polite"
        className={`flex h-7 shrink-0 items-center gap-1.5 rounded-l-md border border-r-0 border-[var(--color-border-strong)] bg-[var(--color-card)] pl-2.5 pr-2 text-xs font-medium transition-colors hover:bg-[var(--color-card-hover)] ${
          justSaved
            ? "text-[var(--color-success)]"
            : tab.isDirty
              ? "text-[var(--color-text-primary)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        {justSaved ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {justSaved ? t("common.saved") : t("common.save")}
        {tab.isDirty && !justSaved && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
        )}
      </button>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("tabs.saveOptions")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-6 shrink-0 items-center justify-center rounded-r-md border border-[var(--color-border-strong)] bg-[var(--color-card)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
      >
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          role="menu"
          className="surface-pop animate-panel-in absolute right-0 top-full z-50 mt-1.5 min-w-[132px] overflow-hidden rounded-md py-1"
        >
          <button
            role="menuitem"
            onClick={openSaveAs}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-text-primary)]"
          >
            <FilePlus2 className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t("tabs.saveAs")}</span>
            <span className="tabular shrink-0 text-[10.5px] text-[var(--color-text-dimmed)]">
              {saveAsHint}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function NewTabDropdown() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const {
    newTab,
    newGraphQLTab,
    newWebSocketTab,
    newSSETab,
    newGrpcTab,
    newMqttTab,
    newSocketIoTab,
  } = useTabStore();

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const items = [
    { label: t("tabs.httpRequest"), icon: Globe, action: newTab },
    {
      label: "GraphQL",
      icon: Globe,
      action: newGraphQLTab,
      color: "text-violet-400",
    },
    {
      label: "WebSocket",
      icon: Zap,
      action: newWebSocketTab,
      color: "text-cyan-400",
    },
    { label: "SSE", icon: Radio, action: newSSETab, color: "text-orange-400" },
    {
      label: "gRPC",
      icon: Globe,
      action: newGrpcTab,
      color: "text-emerald-400",
    },
    {
      label: "MQTT",
      icon: Radio,
      action: newMqttTab,
      color: "text-purple-400",
    },
    {
      label: "Socket.IO",
      icon: Zap,
      action: newSocketIoTab,
      color: "text-pink-400",
    },
  ];

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen(!open)}
        className="ml-1 flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--color-accent-text)] transition-colors hover:bg-[var(--color-accent-soft)]"
        title="New Tab"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
        <span>{t("sidebar.new")}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <div className="surface-pop animate-panel-in absolute right-0 top-full z-50 mt-2 min-w-[186px] overflow-hidden rounded-lg py-1.5">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.action();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-accent-soft)]"
            >
              <item.icon
                className={`h-4 w-4 ${item.color ?? "text-[var(--color-text-muted)]"}`}
              />
              {item.label}
            </button>
          ))}
          <div className="my-1 border-t border-[var(--color-border)]" />
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("reqmate:open-curl-import"));
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-accent-soft)]"
          >
            <Terminal className="h-4 w-4 text-[var(--color-text-muted)]" />
            {t("tabs.importCurl")}
          </button>
        </div>
      )}
    </div>
  );
}

export function TabBar() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    reorderTabs,
    detachTab,
    togglePin,
    duplicateTab,
  } = useTabStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Sort: pinned tabs first, preserving order within each group
  const sortedTabs = [...tabs].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, tabs.length]);

  // Keep the active tab reachable even when the strip overflows. Runs on every
  // tab mutation (rename, add, close) because widths change without a scroll event.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const c = scrollerRef.current;
      const el = c?.querySelector<HTMLElement>(
        `[data-tab-id="${activeTabId}"]`,
      );
      if (c && el) {
        const left = el.offsetLeft;
        const right = left + el.offsetWidth;
        if (left < c.scrollLeft + 8) c.scrollLeft = Math.max(0, left - 8);
        else if (right > c.scrollLeft + c.clientWidth - 8)
          c.scrollLeft = right - c.clientWidth + 8;
      }
      updateScrollState();
    });
    return () => cancelAnimationFrame(id);
  }, [tabs, activeTabId, updateScrollState]);

  const scrollTabs = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(160, el.clientWidth * 0.7),
      behavior: "smooth",
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = tabs.findIndex((t) => t.id === active.id);
    const toIndex = tabs.findIndex((t) => t.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderTabs(fromIndex, toIndex);
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div
      data-tour="tabs"
      className="flex h-9 shrink-0 items-stretch gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] pl-2 pr-2"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedTabs.map((t) => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
            {canScrollLeft && (
              <button
                onClick={() => scrollTabs(-1)}
                aria-label="Scroll tabs left"
                className="flex w-6 shrink-0 items-center justify-center self-stretch rounded-md text-[var(--color-text-dimmed)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)] hover:text-[var(--color-text-primary)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div
              ref={scrollerRef}
              onWheel={(e) => {
                const el = e.currentTarget;
                if (el.scrollWidth <= el.clientWidth) return;
                if (Math.abs(e.deltaY) > Math.abs(e.deltaX))
                  el.scrollLeft += e.deltaY;
              }}
              className={`no-scrollbar flex min-w-0 shrink items-stretch gap-[3px] overflow-x-auto ${
                canScrollLeft && canScrollRight
                  ? "tabs-fade-lr"
                  : canScrollLeft
                    ? "tabs-fade-l"
                    : canScrollRight
                      ? "tabs-fade-r"
                      : ""
              }`}
            >
              {sortedTabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onActivate={() => setActiveTab(tab.id)}
                  onClose={() => closeTab(tab.id)}
                  onDetach={() => detachTab(tab.id)}
                  onCloseOthers={() => closeOtherTabs(tab.id)}
                  onCloseAll={() => closeAllTabs()}
                  onTogglePin={() => togglePin(tab.id)}
                  onDuplicate={() => duplicateTab(tab.id)}
                />
              ))}
            </div>

            {canScrollRight && (
              <button
                onClick={() => scrollTabs(1)}
                aria-label="Scroll tabs right"
                className="flex w-6 shrink-0 items-center justify-center self-stretch rounded-md text-[var(--color-text-dimmed)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)] hover:text-[var(--color-text-primary)]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {/* Sits right after the last tab; the strip shrinks before this does,
                so it stays pinned at the right edge once tabs overflow. */}
            <button
              onClick={() => useTabStore.getState().newTab()}
              className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_7%,transparent)] hover:text-[var(--color-text-primary)]"
              title="New Tab (Ctrl+T)"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-1.5">
        <SaveControl tab={activeTab} />
        <NewTabDropdown />
      </div>
    </div>
  );
}
