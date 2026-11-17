import { useTranslation } from "react-i18next";
import { FileUp, Plus, Trash2 } from "lucide-react";
import type { KeyValuePair } from "@reqmate/types";

let formKvCounter = 0;
const formKvId = () => `kv_fd_${Date.now()}_${++formKvCounter}`;

/** form-data editor with per-field file embedding. */
export function FormDataEditor({
  pairs,
  onChange,
}: {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
}) {
  const { t } = useTranslation();
  const update = (index: number, field: string, value: string | boolean) => {
    const updated = pairs.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    onChange(updated);
  };

  const addRow = () => {
    onChange([...pairs, { id: formKvId(), key: "", value: "", enabled: true }]);
  };

  const removeRow = (index: number) => {
    if (pairs.length <= 1) {
      onChange([{ id: formKvId(), key: "", value: "", enabled: true }]);
      return;
    }
    onChange(pairs.filter((_, i) => i !== index));
  };

  const pickFile = async (index: number) => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false });
      if (selected) {
        const path = typeof selected === "string" ? selected : selected;
        const updated = pairs.map((p, i) =>
          i === index ? { ...p, value: path as string, valueType: "file" as const } : p,
        );
        onChange(updated);
      }
    } catch {
      // dialog cancelled
    }
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2 px-1 text-xs text-[var(--color-text-muted)]">
        <span className="w-5" />
        <span>{t("request.field")}</span>
        <span>{t("request.value")}</span>
        <span className="w-7" />
        <span className="w-7" />
      </div>

      {pairs.map((pair, index) => (
        <div
          key={pair.id}
          className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2 px-1"
        >
          <input
            type="checkbox"
            checked={pair.enabled}
            onChange={(e) => update(index, "enabled", e.target.checked)}
            className="h-4 w-4 accent-blue-500"
          />
          <input
            type="text"
            value={pair.key}
            onChange={(e) => update(index, "key", e.target.value)}
            placeholder={t("request.field")}
            className="rounded bg-[var(--color-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={pair.value}
              onChange={(e) => {
                const updated = pairs.map((p, i) =>
                  i === index ? { ...p, value: e.target.value, valueType: undefined } : p,
                );
                onChange(updated);
              }}
              placeholder={pair.valueType === "file" ? t("request.filePath") : t("request.value")}
              className={`min-w-0 flex-1 rounded bg-[var(--color-elevated)] px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${
                pair.valueType === "file"
                  ? "text-violet-400 placeholder-violet-400/50"
                  : "text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)]"
              }`}
            />
            <button
              onClick={() => pickFile(index)}
              className={`shrink-0 rounded p-1 transition-colors ${
                pair.valueType === "file"
                  ? "bg-violet-500/20 text-violet-400"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
              }`}
              title={t("request.embedFileContent")}
            >
              <FileUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => removeRow(index)}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={addRow}
        className="flex items-center gap-1 px-1 pt-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}
