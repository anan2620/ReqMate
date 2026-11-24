interface ToolSurfaceProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Full-surface panel for tools such as mock servers and monitors. It takes over
 * the editor area instead of sitting next to it, so the tool gets the whole
 * width without a half-empty request editor beside it.
 *
 * Closing is done from the activity bar (clicking the tool icon again), so the
 * header deliberately has no close button.
 */
export function ToolSurface({ title, description, children }: ToolSurfaceProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label={title}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="h-3 w-[3px] shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden />
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="label-caps shrink-0">{title}</span>
          {description && (
            <p className="truncate text-[10px] text-[var(--color-text-dimmed)]">{description}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
