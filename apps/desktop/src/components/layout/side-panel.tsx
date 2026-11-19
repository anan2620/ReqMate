import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionStore } from "@/stores/collection-store";
import { CollectionTree } from "@/components/collection/collection-tree";
import { nodeMatchesSearch } from "@/lib/collection-search";
import { EnvironmentSelector } from "@/components/environment/environment-selector";
import { HistoryPanel } from "@/components/history/history-panel";
import { FolderOpen, FolderPlus, Plus, Search, Trash2, X, Upload, FolderX, ChevronDown, ChevronRight, Folder, Globe, Pencil, Settings } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { createCollection, saveEnvironment } from "@/lib/tauri-api";
import { useEnvironmentStore } from "@/stores/environment-store";
import { useSettingsStore } from "@/stores/settings-store";
import type { EnvironmentData, CollectionNode } from "@reqmate/types";
import * as Dialog from "@radix-ui/react-dialog";
import type { ActivityView } from "./activity-bar";
import { ProxySidePanel as ProxySidePanelView } from "@/components/proxy/proxy-panel";
import { GitPanel as GitPanelView } from "@/components/git/git-panel";
import { AuditPanel } from "@/components/audit/audit-panel";
import { Select } from "@/components/ui/select";
import { DocsPanel } from "@/components/docs/docs-panel";

interface SidePanelProps {
  activeView: ActivityView;
  envSelectorRef?: React.RefObject<HTMLButtonElement | null>;
  onOpenMock?: () => void;
  onOpenMonitor?: () => void;
  onOpenImport?: () => void;
}

export function SidePanel({
  activeView,
  envSelectorRef,
  onOpenMock,
  onOpenMonitor,
  onOpenImport,
}: SidePanelProps) {
  const { t } = useTranslation();
  const titles: Record<ActivityView, string> = {
    collections: t("sidebar.collections"),
    environments: t("sidebar.environments"),
    history: t("history.title"),
    mock: t("mock.title"),
    monitor: t("monitor.title"),
    docs: t("docs.title"),
    proxy: t("proxy.title"),
    git: t("git.title"),
    audit: t("audit.title"),
  };

  const sidebarWidth = useSettingsStore((s) => s.settings.sidebarWidth);

  return (
    <div
      className="chrome-surface flex shrink-0 flex-col border-r border-[var(--color-border)]"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Panel header */}
      <div className="flex h-9 shrink-0 items-center gap-2 px-3">
        <span className="h-3 w-[3px] rounded-full bg-[var(--color-accent)]" aria-hidden />
        <span className="label-caps">{titles[activeView]}</span>
      </div>

      {/* Panel content */}
      <div
        className={
          activeView === "collections" || activeView === "docs"
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "flex-1 overflow-y-auto"
        }
      >
        {activeView === "collections" && <CollectionsPanel onOpenImport={onOpenImport} />}
        {activeView === "environments" && <EnvironmentsPanel envSelectorRef={envSelectorRef} />}
        {activeView === "history" && <HistoryPanel />}
        {activeView === "mock" && <ToolPanel description={t("mock.createDesc")} actionLabel={t("mock.newMockServer")} onAction={onOpenMock} />}
        {activeView === "monitor" && <ToolPanel description={t("monitor.createDesc")} actionLabel={t("monitor.newMonitor")} onAction={onOpenMonitor} />}
        {activeView === "docs" && <DocsPanel />}
        {activeView === "proxy" && <ProxySidePanelView />}
        {activeView === "git" && <GitPanelView />}
        {activeView === "audit" && <AuditPanel />}
      </div>
    </div>
  );
}

function PanelAction({
  icon: Icon,
  label,
  title,
  onClick,
  primary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[4px] px-1.5 py-[5px] text-[11.5px] font-medium transition-colors ${
        primary
          ? "text-[var(--color-accent-text)] hover:bg-[var(--color-accent-soft)]"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function CollectionsPanel({ onOpenImport }: { onOpenImport?: () => void }) {
  const { t } = useTranslation();
  const { collections, openCollection, closeCollection } = useCollectionStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [collectionMenu, setCollectionMenu] = useState<{ x: number; y: number; path: string; name: string } | null>(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<{ path: string; name: string } | null>(null);
  const [defaultsPath, setDefaultsPath] = useState<string | null>(null);
  const defaultCollectionPath = useSettingsStore(
    (s) => s.settings.defaultCollectionPath,
  );

  const trimmedQuery = searchQuery.trim();
  const visibleCollections = trimmedQuery
    ? collections.filter((c) => nodeMatchesSearch(c, trimmedQuery))
    : collections;

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: defaultCollectionPath?.trim() || undefined,
      });
      if (selected) {
        await openCollection(selected as string);
      }
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to open folder: ${err}`),
      );
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Pinned actions — stay put while the collection list scrolls */}
      <div className="shrink-0 space-y-2 border-b border-[var(--color-border)] px-2.5 pb-2">
        <div className="flex items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] p-0.5">
          <PanelAction
            icon={FolderPlus}
            label={t("sidebar.new")}
            title={t("sidebar.newCollection")}
            onClick={() => setNewCollectionOpen(true)}
            primary
          />
          <PanelAction
            icon={FolderOpen}
            label={t("sidebar.open")}
            title={t("sidebar.openFolder")}
            onClick={handleOpenFolder}
          />
          {onOpenImport && (
            <PanelAction
              icon={Upload}
              label={t("sidebar.import")}
              title={t("sidebar.importCollection")}
              onClick={onOpenImport}
            />
          )}
        </div>

        {/* Search */}
        {collections.length > 0 && (
          <div className="ring-focus relative flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-card)] transition-colors">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-dimmed)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("sidebar.search")}
              className="w-full bg-transparent py-1.5 pl-8 pr-7 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-dimmed)] hover:text-[var(--color-text-secondary)]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-2">
        {collections.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <FolderOpen className="h-5 w-5 text-[var(--color-accent-text)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("sidebar.noCollections")}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                {t("sidebar.noCollectionsDesc")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {trimmedQuery && visibleCollections.length === 0 && (
              <div className="flex flex-col items-center gap-1 px-2 py-8 text-center">
                <Search className="h-4 w-4 text-[var(--color-text-dimmed)]" />
                <p className="text-xs text-[var(--color-text-muted)]">{t("sidebar.noResults")}</p>
              </div>
            )}
            {visibleCollections.map((collection) => (
              <CollectionHeader
                key={collection.path}
                collection={collection}
                searchQuery={searchQuery}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCollectionMenu({ x: e.clientX, y: e.clientY, path: collection.path, name: collection.name });
                }}
                onDelete={() => setDeleteCollectionTarget({ path: collection.path, name: collection.name })}
                onClose={() => closeCollection(collection.path)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Collection context menu */}
      {collectionMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCollectionMenu(null)} />
          <div
            className="surface-pop fixed z-50 min-w-[160px] rounded-md py-1"
            style={{ left: collectionMenu.x, top: collectionMenu.y }}
          >
            <button
              onClick={() => {
                setDefaultsPath(collectionMenu.path);
                setCollectionMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-[var(--color-text-primary)] hover:bg-[var(--color-accent-soft)]"
            >
              <Settings className="h-3.5 w-3.5" />
              {t("sidebar.collectionDefaults")}
            </button>
            <button
              onClick={() => {
                closeCollection(collectionMenu.path);
                setCollectionMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-[var(--color-text-primary)] hover:bg-[var(--color-accent-soft)]"
            >
              <FolderX className="h-3.5 w-3.5" />
              {t("sidebar.closeCollection")}
            </button>
            <button
              onClick={() => {
                setDeleteCollectionTarget({ path: collectionMenu.path, name: collectionMenu.name });
                setCollectionMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("sidebar.deleteCollection")}
            </button>
          </div>
        </>
      )}

      <NewCollectionDialog
        open={newCollectionOpen}
        onOpenChange={setNewCollectionOpen}
        onCreated={openCollection}
      />

      {/* Delete collection confirmation */}
      <Dialog.Root open={!!deleteCollectionTarget} onOpenChange={(v) => { if (!v) setDeleteCollectionTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--color-overlay)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 elev-pop">
            <Dialog.Title className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
              {t("confirmDelete.title")}
            </Dialog.Title>
            <p className="mb-5 text-sm text-[var(--color-text-secondary)]">
              {t("confirmDelete.collection", { name: deleteCollectionTarget?.name ?? "" })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteCollectionTarget(null)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={async () => {
                  if (!deleteCollectionTarget) return;
                  const { path, name } = deleteCollectionTarget;
                  setDeleteCollectionTarget(null);
                  try {
                    await useCollectionStore.getState().deleteCollection(path, name);
                  } catch (err) {
                    import("@/stores/toast-store").then(({ useToastStore }) =>
                      useToastStore.getState().showError(`Failed to delete collection: ${err}`),
                    );
                  }
                }}
                className="btn-danger rounded-md px-4 py-1.5 text-sm font-medium"
              >
                {t("common.delete")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Collection Defaults Dialog */}
      {defaultsPath && (
        <CollectionDefaultsDialog
          collectionPath={defaultsPath}
          onClose={() => setDefaultsPath(null)}
        />
      )}
    </div>
  );
}

function CollectionDefaultsDialog({
  collectionPath,
  onClose,
}: {
  collectionPath: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [authType, setAuthType] = useState<string>("none");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKeyKey, setApiKeyKey] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/lib/tauri-api").then(({ getCollectionDefaults }) => {
      getCollectionDefaults(collectionPath).then((defaults) => {
        if (defaults.auth) {
          const auth = defaults.auth as Record<string, unknown>;
          const type = (auth.type as string) ?? "none";
          setAuthType(type);
          if (type === "bearer") setToken((auth.token as string) ?? "");
          if (type === "basic") {
            setUsername((auth.username as string) ?? "");
            setPassword((auth.password as string) ?? "");
          }
          if (type === "api-key") {
            setApiKeyKey((auth.key as string) ?? "");
            setApiKeyValue((auth.value as string) ?? "");
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, [collectionPath]);

  const handleSave = async () => {
    let auth: Record<string, unknown> = { type: "none" };
    if (authType === "bearer") auth = { type: "bearer", token };
    else if (authType === "basic") auth = { type: "basic", username, password };
    else if (authType === "api-key") auth = { type: "api-key", key: apiKeyKey, value: apiKeyValue, addTo: "header" };

    const { getCollectionDefaults, updateCollectionDefaults } = await import("@/lib/tauri-api");
    const current = await getCollectionDefaults(collectionPath);
    await updateCollectionDefaults(collectionPath, { ...current, auth: auth as import("@reqmate/types").AuthConfig });
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 elev-pop focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("sidebar.collectionDefaults")}
          </Dialog.Title>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {t("sidebar.collectionDefaultsDesc")}
          </p>

          {loading ? (
            <div className="py-8 text-center text-sm text-[var(--color-text-dimmed)]">{t("common.loading")}</div>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                  {t("auth.type")}
                </label>
                <Select
                  size="md"
                  value={authType}
                  onChange={setAuthType}
                  options={[
                    { value: "none", label: t("auth.none") },
                    { value: "bearer", label: t("auth.bearer") },
                    { value: "basic", label: t("auth.basic") },
                    { value: "api-key", label: t("auth.apiKey") },
                  ]}
                  aria-label={t("auth.type")}
                />
              </div>

              {authType === "bearer" && (
                <input type="text" value={token} onChange={(e) => setToken(e.target.value)} placeholder={t("auth.token")}
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none" />
              )}
              {authType === "basic" && (
                <div className="space-y-2">
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.username")}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.password")}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none" />
                </div>
              )}
              {authType === "api-key" && (
                <div className="space-y-2">
                  <input type="text" value={apiKeyKey} onChange={(e) => setApiKeyKey(e.target.value)} placeholder={t("auth.apiKeyHeader")}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none" />
                  <input type="text" value={apiKeyValue} onChange={(e) => setApiKeyValue(e.target.value)} placeholder={t("common.value")}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]">
                  {t("common.cancel")}
                </button>
                <button onClick={handleSave} className="btn-accent rounded-md px-4 py-1.5 text-sm font-medium">
                  {t("common.save")}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CollectionHeader({
  collection,
  searchQuery,
  onContextMenu,
  onDelete,
  onClose,
}: {
  collection: CollectionNode;
  searchQuery: string;
  onContextMenu: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { expandedPaths, toggleExpand, renameItem } = useCollectionStore();
  // While searching the collection opens automatically so hits are never hidden
  // behind a collapsed row; the click-to-toggle state is kept for normal use.
  const searching = searchQuery.trim().length > 0;
  const isExpanded = searching || expandedPaths.has(collection.path);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const handleRename = () => {
    setRenameValue(collection.name);
    setRenaming(true);
  };

  const submitRename = async () => {
    setRenaming(false);
    if (!renameValue.trim() || renameValue === collection.name) return;
    try {
      await renameItem(collection.path, renameValue.trim(), collection.path);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to rename: ${err}`),
      );
    }
  };

  return (
    <div>
      <button
        onClick={() => {
          // Collapsing during a search would hide the hits we just revealed.
          if (!searching) toggleExpand(collection.path);
        }}
        onContextMenu={onContextMenu}
        className="group flex w-full items-center gap-1.5 rounded-md px-2 py-[5px] text-left text-[12.5px] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)]"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        )}
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="min-w-0 flex-1 rounded bg-[var(--color-elevated)] px-1 text-sm text-[var(--color-text-primary)] outline-none ring-1 ring-[var(--color-accent)]"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate text-[var(--color-text-primary)]">{collection.name}</span>
        )}
        {!renaming && (
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); handleRename(); }}
              className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
              title={t("common.rename")}
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-red-500/20 hover:text-red-400"
              title={t("common.delete")}
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
              title={t("common.close")}
            >
              <FolderX className="h-3 w-3" />
            </button>
          </span>
        )}
      </button>
      {isExpanded && (
        <CollectionTree
          nodes={
            collection.type === "collection"
              ? collection.children
              : [collection]
          }
          collectionPath={collection.path}
          collectionName={collection.name}
          searchQuery={searchQuery}
        />
      )}
    </div>
  );
}

function NewCollectionDialog({
  open: isOpen,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (path: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const defaultCollectionPath = useSettingsStore(
    (s) => s.settings.defaultCollectionPath,
  );
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Location is no longer picked per collection — it comes from Settings.
  const parentDir = defaultCollectionPath?.trim() ?? "";

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName("");
      setError("");
    }
    onOpenChange(v);
  };

  const openPathSettings = () => {
    onOpenChange(false);
    window.dispatchEvent(
      new CustomEvent("reqmate:open-settings", { detail: { section: "saving" } }),
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const path = await createCollection(parentDir, name.trim());
      await onCreated(path);
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  const canCreate = !!name.trim() && !creating;

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-overlay)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] elev-pop">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <Dialog.Title className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("sidebar.newCollection")}
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)]">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                {t("sidebar.collectionName")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("sidebar.collectionNamePlaceholder")}
                autoFocus
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canCreate) handleCreate();
                }}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {t("sidebar.location")}
                </span>
                <button
                  type="button"
                  onClick={openPathSettings}
                  className="shrink-0 text-[11px] text-[var(--color-accent-text)] hover:underline"
                >
                  {t("sidebar.changeLocation")}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2">
                <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                {parentDir ? (
                  <span
                    className="truncate text-sm text-[var(--color-text-secondary)]"
                    title={parentDir}
                  >
                    {parentDir}
                  </span>
                ) : (
                  <span className="truncate text-sm italic text-[var(--color-text-dimmed)]">
                    {t("sidebar.defaultLocationFallback")}
                  </span>
                )}
              </div>
              {name.trim() && (
                <p className="truncate text-[11px] text-[var(--color-text-dimmed)]">
                  {t("sidebar.willCreate", {
                    path: parentDir
                      ? `${parentDir}/${name.trim().toLowerCase().replace(/\s+/g, "-")}`
                      : name.trim().toLowerCase().replace(/\s+/g, "-"),
                  })}
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
            <Dialog.Close className="rounded px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)]">
              {t("common.cancel")}
            </Dialog.Close>
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="rounded bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {creating ? t("sidebar.creating") : t("common.create")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EnvironmentsPanel({
  envSelectorRef,
}: {
  envSelectorRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation();
  const { environments, activeEnvironmentName, setActiveEnvironment, loadEnvironments } =
    useEnvironmentStore();
  const { collections } = useCollectionStore();
  const [editingEnv, setEditingEnv] = useState<EnvironmentData | null>(null);
  const [newEnvOpen, setNewEnvOpen] = useState(false);

  const collectionPath =
    collections.find((c) => c.type === "collection")?.path ?? null;

  // Load environments when panel mounts with a collection
  useEffect(() => {
    if (collectionPath) {
      loadEnvironments(collectionPath);
    }
  }, [collectionPath, loadEnvironments]);

  const handleSave = async (env: EnvironmentData) => {
    if (!collectionPath) return;
    try {
      await saveEnvironment(collectionPath, env);
      await loadEnvironments(collectionPath);
      setEditingEnv(null);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to save environment: ${err}`),
      );
    }
  };

  const handleImportEnv = async () => {
    if (!collectionPath) return;
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        filters: [{ name: "Postman Environment", extensions: ["json"] }],
        multiple: true,
      });
      if (!selected) return;
      const files = Array.isArray(selected) ? selected : [selected];
      const { importEnvironment } = await import("@/lib/tauri-api");
      let imported = 0;
      for (const file of files) {
        try {
          await importEnvironment(file, collectionPath);
          imported++;
        } catch (err) {
          import("@/stores/toast-store").then(({ useToastStore }) =>
            useToastStore.getState().showWarning(`Skipped ${file.split("/").pop()}: ${err}`),
          );
        }
      }
      if (imported > 0) {
        await loadEnvironments(collectionPath);
        import("@/stores/toast-store").then(({ useToastStore }) =>
          useToastStore.getState().showSuccess(`Imported ${imported} environment${imported > 1 ? "s" : ""}`),
        );
      }
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to import: ${err}`),
      );
    }
  };

  const handleCreateNew = async (name: string) => {
    if (!collectionPath) return;
    const env: EnvironmentData = { name, variables: {}, secrets: [] };
    try {
      await saveEnvironment(collectionPath, env);
      await loadEnvironments(collectionPath);
      setActiveEnvironment(name);
      setNewEnvOpen(false);
      // Open editor for the new environment
      setEditingEnv(env);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to create environment: ${err}`),
      );
    }
  };

  if (!collectionPath) {
    const handleOpenFolder = async () => {
      try {
        const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
        const selected = await openDialog({ directory: true, multiple: false });
        if (selected) {
          await useCollectionStore.getState().openCollection(selected as string);
        }
      } catch (err) {
        import("@/stores/toast-store").then(({ useToastStore }) =>
          useToastStore.getState().showError(`Failed to open folder: ${err}`),
        );
      }
    };

    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/10">
          <Globe className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("sidebar.noCollections")}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-dimmed)]">
            {t("sidebar.openCollectionFirst")}
          </p>
        </div>
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {t("sidebar.openCollection")}
        </button>
      </div>
    );
  }

  // Editing an environment — show variable editor
  if (editingEnv) {
    return (
      <EnvironmentEditor
        env={editingEnv}
        onSave={handleSave}
        onBack={() => setEditingEnv(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {/* Environment selector */}
      <EnvironmentSelector ref={envSelectorRef} />

      {/* Environment list with edit buttons */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-dimmed)]">
            {t("sidebar.environments")}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleImportEnv}
              className="rounded p-1 text-[var(--color-text-dimmed)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-secondary)]"
              title={t("sidebar.importEnvironment")}
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              onClick={() => setNewEnvOpen(true)}
              className="rounded p-1 text-[var(--color-text-dimmed)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-secondary)]"
              title={t("sidebar.newEnvironment")}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {environments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-xs text-[var(--color-text-dimmed)]">
              {t("sidebar.noEnvironmentsYet")}
            </p>
            <button
              onClick={() => setNewEnvOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("sidebar.newEnvironment")}
            </button>
          </div>
        ) : (
          environments.map((env) => (
            <button
              key={env.name}
              onClick={() => setEditingEnv(env)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                activeEnvironmentName === env.name
                  ? "bg-[var(--color-accent)]/10 text-[var(--color-accent-text)]"
                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)]"
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="truncate">{env.name}</span>
                {env.scope === "personal" && (
                  <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-bold text-amber-400">
                    {t("sidebar.scopeLocal")}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-[var(--color-text-dimmed)]">
                {Object.keys(env.variables).length} vars
              </span>
            </button>
          ))
        )}
      </div>

      {/* New environment dialog */}
      <NewEnvironmentDialog
        open={newEnvOpen}
        onOpenChange={setNewEnvOpen}
        onCreate={handleCreateNew}
      />
    </div>
  );
}

function EnvironmentEditor({
  env,
  onSave,
  onBack,
}: {
  env: EnvironmentData;
  onSave: (env: EnvironmentData) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(env.name);
  const [variables, setVariables] = useState<{ key: string; value: string }[]>(
    () => {
      const entries = Object.entries(env.variables).map(([key, value]) => ({ key, value }));
      if (entries.length === 0) entries.push({ key: "", value: "" });
      return entries;
    },
  );

  const [scope, setScope] = useState<"shared" | "personal">(env.scope ?? "shared");

  const handleSave = () => {
    const vars: Record<string, string> = {};
    for (const v of variables) {
      if (v.key.trim()) vars[v.key.trim()] = v.value;
    }
    onSave({ ...env, name: name.trim() || env.name, variables: vars, scope });
  };

  const updateVar = (index: number, field: "key" | "value", val: string) => {
    setVariables((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: val } : v)));
  };

  const addVar = () => {
    setVariables((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeVar = (index: number) => {
    setVariables((prev) => {
      if (prev.length <= 1) return [{ key: "", value: "" }];
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 truncate rounded bg-transparent px-1 text-sm font-medium text-[var(--color-text-primary)] outline-none focus:border border-[var(--color-border)] bg-[var(--color-card)] "
        />
        <button
          onClick={handleSave}
          className="shrink-0 rounded bg-[var(--color-accent)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
        >
          {t("common.save")}
        </button>
      </div>

      {/* Scope toggle */}
      <div className="flex items-center gap-2 rounded bg-[var(--color-elevated)] px-2 py-1.5">
        <span className="text-[10px] text-[var(--color-text-dimmed)]">Scope:</span>
        <button
          onClick={() => setScope("shared")}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
            scope === "shared"
              ? "bg-blue-500/20 text-blue-400"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          {t("sidebar.scopeShared")}
        </button>
        <button
          onClick={() => setScope("personal")}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
            scope === "personal"
              ? "bg-amber-500/20 text-amber-400"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          {t("sidebar.scopePersonal")}
        </button>
      </div>

      {/* Variables */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-dimmed)]">
            {t("environment.variables")}
          </span>
        </div>

        {variables.map((v, i) => (
          <div key={i} className="flex gap-1">
            <input
              type="text"
              value={v.key}
              onChange={(e) => updateVar(i, "key", e.target.value)}
              placeholder={t("request.key")}
              className="min-w-0 flex-1 basis-0 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
            />
            <input
              type="text"
              value={v.value}
              onChange={(e) => updateVar(i, "value", e.target.value)}
              placeholder={t("request.value")}
              className="min-w-0 flex-1 basis-0 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
            />
            <button
              onClick={() => removeVar(i)}
              className="shrink-0 rounded p-1 text-[var(--color-text-dimmed)] hover:bg-[var(--color-elevated)] hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          onClick={addVar}
          className="flex items-center gap-1 text-xs text-[var(--color-text-dimmed)] hover:text-[var(--color-text-secondary)]"
        >
          <Plus className="h-3 w-3" /> {t("sidebar.addVariable")}
        </button>
      </div>
    </div>
  );
}

function NewEnvironmentDialog({
  open: isOpen,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (v) setName("");
    onOpenChange(v);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-overlay)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] elev-pop">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <Dialog.Title className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("sidebar.newEnvironment")}
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)]">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="p-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("sidebar.environmentNamePlaceholder")}
              autoFocus
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) onCreate(name.trim());
              }}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
            <Dialog.Close className="rounded px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)]">
              {t("common.cancel")}
            </Dialog.Close>
            <button
              onClick={() => name.trim() && onCreate(name.trim())}
              disabled={!name.trim()}
              className="rounded bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {t("common.create")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ToolPanel({
  description,
  actionLabel,
  onAction,
}: {
  description: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      <button
        onClick={onAction}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white transition-all hover:brightness-110 active:scale-[0.98]"
      >
        {actionLabel}
      </button>
    </div>
  );
}
