import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useGitStore } from "@/stores/git-store";
import { useCollectionStore } from "@/stores/collection-store";
import { Select } from "@/components/ui/select";
import {
  GitBranch,
  Plus,
  Minus,
  Check,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Loader2,
  FolderGit2,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Settings,
  Trash2,
  Pencil,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";

export function GitPanel() {
  const { t } = useTranslation();
  const { collections, openCollection } = useCollectionStore();
  const {
    collectionPath,
    status,
    log,
    loading,
    error,
    setCollection,
    loadStatus,
    stage,
    unstage,
    commit,
    push,
    pull,
    init,
    removeConfig,
    setRemote,
  } = useGitStore();

  const [commitMessage, setCommitMessage] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
  const [remoteDraft, setRemoteDraft] = useState("");
  const [savingRemote, setSavingRemote] = useState(false);
  const [autoExpanded, setAutoExpanded] = useState(false);

  // Auto-select first collection
  useEffect(() => {
    if (!collectionPath && collections.length > 0) {
      setCollection(collections[0].path);
    }
  }, [collections, collectionPath, setCollection]);

  // A repo without a remote can't be pushed — surface the config section once
  useEffect(() => {
    if (!autoExpanded && status?.isRepo && !status.remote) {
      setShowConfig(true);
      setAutoExpanded(true);
    }
  }, [status, autoExpanded]);

  // Switching collections closes any in-flight remote dialog
  useEffect(() => {
    setRemoteDialogOpen(false);
  }, [collectionPath]);

  const currentCollection = collections.find((c) => c.path === collectionPath);

  const handleSwitchFolder = async () => {
    try {
      const selected = await openFolderDialog({ directory: true, multiple: false });
      if (!selected) return;
      const path = selected as string;
      // Opening a folder that is not tracked yet makes it available in the switcher
      if (!collections.some((c) => c.path === path)) {
        await openCollection(path);
      }
      setCollection(path);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to open folder: ${err}`),
      );
    }
  };

  // No collections open
  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <FolderGit2 className="h-8 w-8 text-[var(--color-text-dimmed)]" />
        <p className="text-sm text-[var(--color-text-muted)]">{t("git.noCollections")}</p>
      </div>
    );
  }

  const stagedChanges = status?.changes.filter((c) => c.staged) ?? [];
  const unstagedChanges = status?.changes.filter((c) => !c.staged) ?? [];

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    await commit(commitMessage.trim());
    setCommitMessage("");
  };

  const handleStageAll = () => {
    const paths = unstagedChanges.map((c) => c.path);
    if (paths.length > 0) stage(paths);
  };

  const handleUnstageAll = () => {
    const paths = stagedChanges.map((c) => c.path);
    if (paths.length > 0) unstage(paths);
  };

  const handleSaveRemote = async () => {
    const url = remoteDraft.trim();
    if (!url) return;
    setSavingRemote(true);
    try {
      await setRemote(url);
      setRemoteDialogOpen(false);
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showSuccess(t("git.remoteSaved")),
      );
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(String(err)),
      );
    } finally {
      setSavingRemote(false);
    }
  };

  const handleRemoveConfig = async () => {
    setConfirmRemove(false);
    try {
      await removeConfig();
      setShowConfig(false);
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showSuccess(t("git.configRemoved")),
      );
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(String(err)),
      );
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Collection switcher — always available so any open collection can be reached */}
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Select
            value={collectionPath ?? ""}
            onChange={setCollection}
            options={collections.map((c) => ({ value: c.path, label: c.name }))}
            placeholder={t("git.selectCollection")}
            aria-label={t("git.collection")}
          />
        </div>
        <button
          onClick={handleSwitchFolder}
          className="shrink-0 rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-primary)]"
          title={t("git.openFolder")}
          aria-label={t("git.openFolder")}
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => loadStatus()}
          disabled={loading}
          className="shrink-0 rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          title={t("git.refresh")}
          aria-label={t("git.refresh")}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Not a git repo */}
      {status && !status.isRepo ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-6 text-center">
          <FolderGit2 className="h-8 w-8 text-[var(--color-text-dimmed)]" />
          <p className="text-sm text-[var(--color-text-muted)]">{t("git.notARepo")}</p>
          <button
            onClick={() => init()}
            disabled={loading}
            className="btn-accent flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
          >
            <GitBranch className="h-3.5 w-3.5" />
            {t("git.initRepo")}
          </button>
        </div>
      ) : status ? (
        <>
          {/* Branch & status */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-orange-400" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
                {status.branch || "main"}
              </span>
            </div>
            {(status.ahead ?? 0) > 0 || (status.behind ?? 0) > 0 ? (
              <div className="mt-1 flex gap-3 text-[10px] text-[var(--color-text-muted)]">
                {(status.ahead ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5">
                    <ArrowUp className="h-2.5 w-2.5" />{" "}
                    {t("git.ahead", { count: status.ahead ?? 0 })}
                  </span>
                )}
                {(status.behind ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5">
                    <ArrowDown className="h-2.5 w-2.5" />{" "}
                    {t("git.behind", { count: status.behind ?? 0 })}
                  </span>
                )}
              </div>
            ) : null}

            {/* Push / Pull buttons */}
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => pull()}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] disabled:opacity-50"
              >
                <ArrowDown className="h-3 w-3" /> {t("git.pull")}
              </button>
              <button
                onClick={() => push()}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] disabled:opacity-50"
              >
                <ArrowUp className="h-3 w-3" /> {t("git.push")}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
          )}

          {/* Staged changes */}
          {stagedChanges.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase text-green-400">
                  {t("git.staged", { count: stagedChanges.length })}
                </span>
                <button
                  onClick={handleUnstageAll}
                  className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  {t("git.unstageAll")}
                </button>
              </div>
              {stagedChanges.map((change) => (
                <div
                  key={change.path}
                  className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-1.5"
                >
                  <StatusIcon status={change.status} />
                  <span className="flex-1 truncate text-xs text-[var(--color-text-primary)]">
                    {change.path}
                  </span>
                  <button
                    onClick={() => unstage([change.path])}
                    className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-red-400"
                    title={t("git.unstage")}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Unstaged changes */}
          {unstagedChanges.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                  {t("git.changes", { count: unstagedChanges.length })}
                </span>
                <button
                  onClick={handleStageAll}
                  className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  {t("git.stageAll")}
                </button>
              </div>
              {unstagedChanges.map((change) => (
                <div
                  key={change.path}
                  className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-1.5"
                >
                  <StatusIcon status={change.status} />
                  <span className="flex-1 truncate text-xs text-[var(--color-text-primary)]">
                    {change.path}
                  </span>
                  <button
                    onClick={() => stage([change.path])}
                    className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-green-400"
                    title={t("git.stage")}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Clean state */}
          {status.isClean && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-4 text-center">
              <Check className="mx-auto h-5 w-5 text-green-500" />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t("git.clean")}</p>
            </div>
          )}

          {/* Commit box */}
          {stagedChanges.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] p-2">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder={t("git.commitPlaceholder")}
                className="w-full resize-none rounded bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleCommit();
                  }
                }}
              />
              <button
                onClick={handleCommit}
                disabled={loading || !commitMessage.trim()}
                className="btn-accent mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {t("git.commit", { count: stagedChanges.length })}
              </button>
            </div>
          )}

          {/* Log */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]">
            <button
              onClick={() => setShowLog(!showLog)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              {showLog ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Clock className="h-3 w-3" />
              {t("git.history", { count: log.length })}
            </button>
            {showLog && (
              <div className="max-h-48 overflow-auto">
                {log.map((entry) => (
                  <div key={entry.hash} className="border-t border-[var(--color-border)] px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] text-orange-400">{entry.hash}</code>
                      <span className="flex-1 truncate text-xs text-[var(--color-text-primary)]">
                        {entry.message}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--color-text-dimmed)]">
                      {entry.author} · {entry.date}
                    </div>
                  </div>
                ))}
                {log.length === 0 && (
                  <div className="border-t border-[var(--color-border)] px-3 py-3 text-center text-xs text-[var(--color-text-dimmed)]">
                    {t("git.noCommits")}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Git config of the current collection */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              {showConfig ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Settings className="h-3 w-3" />
              {t("git.config")}
            </button>
            {showConfig && (
              <div className="space-y-2 border-t border-[var(--color-border)] px-3 py-2">
                <ConfigRow label={t("git.repository")} value={collectionPath ?? ""} mono />
                {/* Remote URL — edited in a dialog, the sidebar is too narrow inline */}
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-16 shrink-0 text-[var(--color-text-dimmed)]">
                    {t("git.remote")}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate font-mono ${
                      status.remote
                        ? "text-[var(--color-text-secondary)]"
                        : "italic text-[var(--color-text-dimmed)]"
                    }`}
                    title={status.remote ?? undefined}
                  >
                    {status.remote || t("git.noRemote")}
                  </span>
                  <button
                    onClick={() => {
                      setRemoteDraft(status.remote ?? "");
                      setRemoteDialogOpen(true);
                    }}
                    className="shrink-0 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    title={t("git.setRemote")}
                    aria-label={t("git.setRemote")}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
                <ConfigRow label={t("git.branchLabel")} value={status.branch || "main"} />
                <button
                  onClick={() => setConfirmRemove(true)}
                  disabled={loading}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--color-error)]/40 px-2 py-1.5 text-xs font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("git.removeConfig")}
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-3 py-6 text-center text-xs text-[var(--color-text-dimmed)]">
          {error ? (
            <>
              <p className="text-[var(--color-error)]">{error}</p>
              <button
                onClick={() => loadStatus()}
                className="rounded border border-[var(--color-border)] px-3 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)]"
              >
                {t("git.refresh")}
              </button>
            </>
          ) : (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("common.loading")}
            </span>
          )}
        </div>
      )}

      {/* Remove Git config confirmation */}
      <Dialog.Root open={confirmRemove} onOpenChange={setConfirmRemove}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--color-overlay)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 elev-pop">
            <Dialog.Title className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
              {t("git.removeConfig")}
            </Dialog.Title>
            <p className="mb-5 text-sm text-[var(--color-text-secondary)]">
              {t("git.removeConfigConfirm", {
                name: currentCollection?.name ?? collectionPath ?? "",
              })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemove(false)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleRemoveConfig}
                className="btn-danger rounded-md px-4 py-1.5 text-sm font-medium"
              >
                {t("common.delete")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Remote URL dialog — the sidebar inline field was far too narrow */}
      <Dialog.Root open={remoteDialogOpen} onOpenChange={setRemoteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--color-overlay)]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 elev-pop">
            <Dialog.Title className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">
              {t("git.setRemote")}
            </Dialog.Title>
            <Dialog.Description className="mb-3 text-xs text-[var(--color-text-muted)]">
              {t("git.remoteDialogDesc")}
            </Dialog.Description>
            <input
              autoFocus
              value={remoteDraft}
              onChange={(e) => setRemoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSaveRemote();
                }
              }}
              placeholder="https://github.com/user/repo.git"
              spellCheck={false}
              className="mb-4 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 font-mono text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRemoteDialogOpen(false)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSaveRemote}
                disabled={savingRemote || !remoteDraft.trim()}
                className="btn-accent flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {savingRemote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("common.save")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function ConfigRow({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 text-[11px]">
      <span className="w-16 shrink-0 text-[var(--color-text-dimmed)]">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate ${mono ? "font-mono" : ""} ${
          muted ? "italic text-[var(--color-text-dimmed)]" : "text-[var(--color-text-secondary)]"
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const colors: Record<string, string> = {
    modified: "text-amber-400",
    added: "text-green-400",
    deleted: "text-red-400",
    renamed: "text-blue-400",
    untracked: "text-gray-400",
  };
  const labels: Record<string, string> = {
    modified: "M",
    added: "A",
    deleted: "D",
    renamed: "R",
    untracked: "?",
  };
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold ${colors[status] ?? "text-gray-400"}`}
    >
      {labels[status] ?? "?"}
    </span>
  );
}
