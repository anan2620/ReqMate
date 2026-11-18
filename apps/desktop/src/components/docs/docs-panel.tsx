import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderClosed, FileText } from "lucide-react";
import { useCollectionStore } from "@/stores/collection-store";
import { useDocsStore } from "@/stores/docs-store";

/**
 * Docs side panel: pick which collections to include, then generate one
 * combined document. Selecting everything up front matches the common case
 * (a workspace with a couple of collections), while still allowing a single
 * collection to be documented on its own.
 */
export function DocsPanel() {
  const { t } = useTranslation();
  const collections = useCollectionStore((s) => s.collections);
  const openDocs = useDocsStore((s) => s.openDocs);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const knownRef = useRef<Set<string>>(new Set());

  // Newly opened collections join the selection; closed ones drop out.
  useEffect(() => {
    const valid = new Set(collections.map((c) => c.path));
    const added = [...valid].filter((p) => !knownRef.current.has(p));
    knownRef.current = valid;
    setSelected((prev) => {
      const next = new Set([...prev].filter((p) => valid.has(p)));
      added.forEach((p) => next.add(p));
      return next;
    });
  }, [collections]);

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const generate = () => {
    const targets = collections
      .filter((c) => selected.has(c.path))
      .map((c) => ({ path: c.path, name: c.name }));
    if (targets.length > 0) openDocs(targets);
  };

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <FileText className="h-7 w-7 text-[var(--color-text-dimmed)]" strokeWidth={1.6} />
        <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          {t("docs.noCollections")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="px-3 pb-2.5 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
        {t("docs.generateDesc")}
      </p>

      <div className="flex items-center justify-between px-3 pb-1.5">
        <span className="label-caps">{t("docs.pickCollections")}</span>
        <div className="flex items-center gap-2 text-[11px]">
          <button
            onClick={() => setSelected(new Set(collections.map((c) => c.path)))}
            className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent-text)]"
          >
            {t("docs.selectAll")}
          </button>
          <span className="h-2.5 w-px bg-[var(--color-border-strong)]" />
          <button
            onClick={() => setSelected(new Set())}
            className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent-text)]"
          >
            {t("docs.clearAll")}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {collections.map((c) => {
          const checked = selected.has(c.path);
          return (
            <label
              key={c.path}
              className={`mb-0.5 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--color-card)] ${
                checked ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(c.path)}
                className="h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
              />
              <FolderClosed
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-dimmed)]"
                strokeWidth={1.8}
              />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
            </label>
          );
        })}
      </div>

      <div className="border-t border-[var(--color-border)] px-2.5 py-2">
        <button
          onClick={generate}
          disabled={selected.size === 0}
          className="btn-accent w-full rounded-md py-1.5 text-[12.5px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("docs.generateFor", { n: selected.size })}
        </button>
      </div>
    </div>
  );
}
