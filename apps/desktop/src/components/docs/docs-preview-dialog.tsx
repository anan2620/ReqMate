import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { previewDocsMulti, generateDocsMulti } from "@/lib/tauri-api";
import type { DocsTarget } from "@/stores/docs-store";
import { useToastStore } from "@/stores/toast-store";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { X, Download, FileText } from "lucide-react";

interface DocsPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: DocsTarget[];
}

export function DocsPreviewDialog({ open, onOpenChange, targets }: DocsPreviewDialogProps) {
  const { t } = useTranslation();
  const [html, setHtml] = useState("");
  // The preview has to be a real document URL: with `srcDoc` the frame is
  // "about:srcdoc", so in-page TOC anchors navigate the parent window and the
  // preview turns blank. A blob URL keeps fragment navigation inside the frame.
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"html" | "markdown" | null>(null);

  const paths = targets.map((x) => x.path);
  // `targets` is rebuilt on every store read — key the effect on the paths
  const pathsKey = paths.join("|");

  useEffect(() => {
    if (!open || paths.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    previewDocsMulti(paths)
      .then((content) => {
        if (!cancelled) setHtml(content);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pathsKey]);

  useEffect(() => {
    if (!html) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);

  const handleExport = async (format: "html" | "markdown") => {
    const ext = format === "html" ? "html" : "md";
    const base =
      targets.length === 1
        ? `${targets[0].name}-docs`
        : `api-docs-${targets.length}-collections`;
    setExporting(format);
    try {
      const content = await generateDocsMulti(paths, format);
      const filePath = await save({
        defaultPath: `${base}.${ext}`,
        filters: [
          {
            name: format === "html" ? "HTML Files" : "Markdown Files",
            extensions: [ext],
          },
        ],
      });
      if (!filePath) return;
      await writeTextFile(filePath, content);
      useToastStore.getState().showSuccess(t("docs.exported", { path: filePath }));
    } catch (err) {
      setError(String(err));
      useToastStore.getState().showError(t("docs.exportFailed", { reason: String(err) }));
    } finally {
      setExporting(null);
    }
  };

  if (!open) return null;

  const title =
    targets.length === 1
      ? `${t("docs.title")} — ${targets[0].name}`
      : `${t("docs.title")} — ${t("docs.selectedCount", { n: targets.length })}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]">
      <div className="flex h-[80vh] w-[860px] flex-col overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-card)] elev-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <span className="truncate">{title}</span>
          </h2>
          <div className="flex items-center gap-1.5">
            {(["html", "markdown"] as const).map((format) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                disabled={exporting !== null}
                className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                {format === "html" ? t("docs.html") : t("docs.markdown")}
              </button>
            ))}
            <button
              onClick={() => onOpenChange(false)}
              aria-label={t("common.close")}
              className="ml-0.5 rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--color-surface)]">
          {loading || (!error && !previewUrl) ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
              {t("docs.generating")}
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--color-error)]">
              {error}
            </div>
          ) : (
            <iframe
              src={previewUrl}
              className="h-full w-full border-none"
              sandbox="allow-same-origin"
              title="API Documentation Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
