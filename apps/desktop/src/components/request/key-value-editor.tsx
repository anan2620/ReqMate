import type { KeyValuePair } from "@reqmate/types";
import { Plus, Trash2 } from "lucide-react";

let kvCounter = 0;
const kvId = () => `kv_${Date.now()}_${++kvCounter}`;

interface KeyValueEditorProps {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({
  pairs,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: KeyValueEditorProps) {
  const update = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const updated = pairs.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    onChange(updated);
  };

  const addRow = () => {
    onChange([...pairs, { id: kvId(), key: "", value: "", enabled: true }]);
  };

  const removeRow = (index: number) => {
    if (pairs.length <= 1) {
      onChange([{ id: kvId(), key: "", value: "", enabled: true }]);
      return;
    }
    onChange(pairs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 border-b border-[var(--color-border)] px-1 pb-1.5">
        <span className="w-3.5" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dimmed)]">{keyPlaceholder}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dimmed)]">{valuePlaceholder}</span>
        <span className="w-7" />
      </div>

      {/* Rows */}
      {pairs.map((pair, index) => (
        <div
          key={pair.id}
          className="group grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_3%,transparent)]"
        >
          <input
            type="checkbox"
            checked={pair.enabled}
            onChange={(e) => update(index, "enabled", e.target.checked)}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded accent-[var(--color-accent)]"
          />
          <input
            type="text"
            value={pair.key}
            onChange={(e) => update(index, "key", e.target.value)}
            placeholder={keyPlaceholder}
            className="field-soft min-w-0 rounded-md border border-transparent bg-[color-mix(in_srgb,var(--color-elevated)_70%,transparent)] px-2.5 py-1.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-all focus:border-[var(--color-accent-line)] focus:bg-[var(--color-elevated)] focus:ring-2 focus:ring-[var(--color-accent-ring)]"
          />
          <input
            type="text"
            value={pair.value}
            onChange={(e) => update(index, "value", e.target.value)}
            placeholder={valuePlaceholder}
            className="field-soft min-w-0 rounded-md border border-transparent bg-[color-mix(in_srgb,var(--color-elevated)_70%,transparent)] px-2.5 py-1.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-all focus:border-[var(--color-accent-line)] focus:bg-[var(--color-elevated)] focus:ring-2 focus:ring-[var(--color-accent-ring)]"
          />
          <button
            onClick={() => removeRow(index)}
            className="rounded-md p-1.5 text-[var(--color-text-dimmed)] opacity-0 transition-all hover:bg-[var(--color-error)]/12 hover:text-[var(--color-error)] group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Remove row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Add row button */}
      <button
        onClick={addRow}
        className="mt-1.5 flex w-full items-center gap-1.5 rounded-md border border-dashed border-[var(--color-border-strong)] px-2.5 py-1.5 text-[11.5px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]"
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  );
}
