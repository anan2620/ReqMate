import { X } from "lucide-react";
import { useHint } from "@/hooks/use-hints";

interface HintTooltipProps {
  hintId: string;
  message: string;
  position?: "top" | "bottom";
  align?: "left" | "right";
}

export function HintTooltip({ hintId, message, position = "bottom", align = "left" }: HintTooltipProps) {
  const { visible, dismiss } = useHint(hintId);

  if (!visible) return null;

  return (
    <div
      role="note"
      className={`surface-pop animate-panel-in absolute z-40 flex w-max max-w-[260px] items-start gap-2 rounded-lg px-3 py-2 text-[11.5px] leading-relaxed text-[var(--color-text-secondary)] ${
        align === "right" ? "right-0" : "left-0"
      } ${position === "top" ? "bottom-full mb-2" : "top-full mt-2"}`}
    >
      <span className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
      <span className="flex-1">{message}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="shrink-0 rounded p-0.5 text-[var(--color-text-dimmed)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-secondary)]"
        aria-label="Dismiss hint"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
