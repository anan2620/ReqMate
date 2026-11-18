/**
 * Request / Response switcher used by the tabbed panel layout.
 *
 * Mirrors the switcher in the HTTP protocol view so the tabbed layout looks the
 * same in every request type (HTTP, GraphQL, gRPC).
 */
export function PanelTabSwitch({
  value,
  onChange,
}: {
  value: "request" | "response";
  onChange: (value: "request" | "response") => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2">
      {(["request", "response"] as const).map((panel) => {
        const active = value === panel;
        return (
          <button
            key={panel}
            onClick={() => onChange(panel)}
            aria-pressed={active}
            className={`relative px-3 py-[9px] text-[12.5px] capitalize transition-colors ${
              active
                ? "font-medium text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {panel}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-[2px] bg-[var(--color-accent)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
