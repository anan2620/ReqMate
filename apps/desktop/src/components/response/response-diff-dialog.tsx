import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowLeftRight } from "lucide-react";
import { useDiffStore, type SavedSnapshot } from "@/stores/diff-store";
import { computeLineDiff, type DiffLine } from "@/lib/diff";
import { Select } from "@/components/ui/select";

function tryFormat(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function ResponseDiffDialog() {
  const { isOpen, close, leftResponse, rightResponse, snapshots, setLeft, setRight } = useDiffStore();
  const [diffMode, setDiffMode] = useState<"body" | "headers">("body");

  const diffLines = useMemo(() => {
    if (!leftResponse || !rightResponse) return [];
    if (diffMode === "body") {
      return computeLineDiff(tryFormat(leftResponse.body), tryFormat(rightResponse.body));
    }
    // Headers diff
    const leftHeaders = leftResponse.headers.map((h) => `${h.key}: ${h.value}`).join("\n");
    const rightHeaders = rightResponse.headers.map((h) => `${h.key}: ${h.value}`).join("\n");
    return computeLineDiff(leftHeaders, rightHeaders);
  }, [leftResponse, rightResponse, diffMode]);

  const hasChanges = diffLines.some((l) => l.type !== "equal");

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-overlay)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[1000px] max-h-[80vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] elev-pop focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <Dialog.Title className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <ArrowLeftRight className="h-4 w-4" />
              Compare Responses
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDiffMode("body")}
                className={`rounded px-2 py-1 text-xs ${diffMode === "body" ? "bg-blue-500/20 text-blue-400" : "text-[var(--color-text-muted)]"}`}
              >
                Body
              </button>
              <button
                onClick={() => setDiffMode("headers")}
                className={`rounded px-2 py-1 text-xs ${diffMode === "headers" ? "bg-blue-500/20 text-blue-400" : "text-[var(--color-text-muted)]"}`}
              >
                Headers
              </button>
              <Dialog.Close className="rounded p-1 hover:bg-[var(--color-elevated)]">
                <X className="h-4 w-4 text-[var(--color-text-muted)]" />
              </Dialog.Close>
            </div>
          </div>

          {/* Snapshot selectors */}
          <div className="flex gap-4 border-b border-[var(--color-border)] px-4 py-2">
            <SnapshotSelector label="Left" snapshots={snapshots} onSelect={(s) => setLeft(s.response)} />
            <SnapshotSelector label="Right" snapshots={snapshots} onSelect={(s) => setRight(s.response)} />
          </div>

          {/* Diff content */}
          <div className="max-h-[55vh] overflow-auto">
            {!leftResponse || !rightResponse ? (
              <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-dimmed)]">
                Save responses using "Save for Diff", then select them above to compare.
              </div>
            ) : !hasChanges ? (
              <div className="flex items-center justify-center py-12 text-sm text-green-500">
                Responses are identical.
              </div>
            ) : (
              <div className="font-mono text-xs">
                {diffLines.map((line, i) => (
                  <DiffLineRow key={i} line={line} />
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const bg =
    line.type === "add"
      ? "bg-green-500/10"
      : line.type === "remove"
        ? "bg-red-500/10"
        : "";
  const textColor =
    line.type === "add"
      ? "text-green-400"
      : line.type === "remove"
        ? "text-red-400"
        : "text-[var(--color-text-primary)]";
  const prefix =
    line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

  return (
    <div className={`flex ${bg}`}>
      <span className="w-10 shrink-0 px-2 text-right text-[var(--color-text-dimmed)]">
        {line.leftNum ?? ""}
      </span>
      <span className="w-10 shrink-0 px-2 text-right text-[var(--color-text-dimmed)]">
        {line.rightNum ?? ""}
      </span>
      <span className={`w-4 shrink-0 text-center ${textColor}`}>{prefix}</span>
      <span className={`flex-1 whitespace-pre-wrap break-all px-2 ${textColor}`}>
        {line.content}
      </span>
    </div>
  );
}

function SnapshotSelector({
  label,
  snapshots,
  onSelect,
}: {
  label: string;
  snapshots: SavedSnapshot[];
  onSelect: (snapshot: SavedSnapshot) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-1 items-center gap-2">
      <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}:</span>
      <div className="flex-1">
        <Select
          value={value}
          onChange={(v) => {
            setValue(v);
            const snapshot = snapshots[parseInt(v)];
            if (snapshot) onSelect(snapshot);
          }}
          options={snapshots.map((s, i) => ({
            value: String(i),
            label: `${s.label} (${new Date(s.savedAt).toLocaleTimeString()})`,
          }))}
          placeholder="Select snapshot..."
          aria-label={label}
        />
      </div>
    </div>
  );
}
