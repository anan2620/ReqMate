import { useCallback, useRef } from "react";

interface PanelDividerProps {
  direction: "horizontal" | "vertical";
  panelRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onResizeEnd: (ratio: number) => void;
  onDoubleClick: () => void;
}

/**
 * Draggable divider that resizes panels by directly mutating DOM styles
 * during drag for maximum smoothness (no React re-renders until mouse up).
 */
export function PanelDivider({ direction, panelRef, containerRef, onResizeEnd, onDoubleClick }: PanelDividerProps) {
  const lastRatio = useRef(0.5);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      const container = containerRef.current;
      const panel = panelRef.current;
      if (!container || !panel) return;

      const rect = container.getBoundingClientRect();
      const isH = direction === "horizontal";

      const onMouseMove = (ev: MouseEvent) => {
        let ratio: number;
        if (isH) {
          ratio = (ev.clientX - rect.left) / rect.width;
        } else {
          ratio = (ev.clientY - rect.top) / rect.height;
        }
        ratio = Math.min(0.8, Math.max(0.2, ratio));
        lastRatio.current = ratio;
        // Direct DOM mutation — no React re-render, instant feedback
        if (isH) {
          panel.style.width = `${ratio * 100}%`;
        } else {
          panel.style.height = `${ratio * 100}%`;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd(lastRatio.current);
      };

      document.body.style.cursor = isH ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [direction, panelRef, containerRef, onResizeEnd],
  );

  const isHorizontal = direction === "horizontal";

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      className={`group relative shrink-0 ${
        isHorizontal
          ? "w-1.5 cursor-col-resize"
          : "h-1.5 cursor-row-resize"
      }`}
    >
      {/* Visible line */}
      <div
        className={`absolute bg-[color-mix(in_srgb,var(--color-border-strong)_70%,transparent)] transition-all duration-150 group-hover:bg-[var(--color-accent)] group-hover: group-active:bg-[var(--color-accent)] ${
          isHorizontal
            ? "inset-y-0 left-1/2 w-px -translate-x-1/2 group-hover:w-[2px]"
            : "inset-x-0 top-1/2 h-px -translate-y-1/2 group-hover:h-[2px]"
        }`}
      />
      {/* Wider invisible hit target */}
      <div
        className={`absolute ${
          isHorizontal
            ? "inset-y-0 -left-1.5 w-5"
            : "inset-x-0 -top-1.5 h-5"
        }`}
      />
    </div>
  );
}
