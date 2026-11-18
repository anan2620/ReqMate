import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";

/** Editor for `:param` style path variables embedded in the URL. */
export function PathVariablesEditor({
  url,
  pathVars,
  values,
  onChange,
  onUrlChange,
}: {
  url: string;
  pathVars: string[];
  values: Record<string, string>;
  onChange: (pathVariables: Record<string, string>) => void;
  onUrlChange: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [newVarName, setNewVarName] = useState("");

  const handleChange = (paramName: string, value: string) => {
    onChange({ ...values, [paramName]: value });
  };

  const handleAdd = () => {
    const name = newVarName.trim();
    if (!name || pathVars.includes(name)) return;
    const separator = url.endsWith("/") ? "" : "/";
    onUrlChange(`${url}${separator}:${name}`);
    setNewVarName("");
  };

  const handleRemove = (param: string) => {
    // Remove :param from the URL
    const updated = url
      .replace(new RegExp(`/:${param}(?=/|$)`), "")
      .replace(new RegExp(`:${param}(?=/|$)`), "");
    onUrlChange(updated || "/");
    const next = { ...values };
    delete next[param];
    onChange(next);
  };

  if (pathVars.length === 0 && !newVarName) return null;

  return (
    <div className="space-y-1">
      {/* Header row — matches KeyValueEditor layout */}
      <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-1 text-xs text-[var(--color-text-muted)]">
        <span>{t("request.pathVariables")}</span>
        <span>{t("request.value")}</span>
        <span className="w-7" />
      </div>

      {/* Rows */}
      {pathVars.map((param) => (
        <div key={param} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-1">
          <div className="flex items-center rounded bg-[var(--color-elevated)] px-2 py-1 text-sm font-medium text-purple-400">
            :{param}
          </div>
          <input
            type="text"
            value={values[param] ?? ""}
            onChange={(e) => handleChange(param, e.target.value)}
            placeholder={t("request.value")}
            className="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
          />
          <button
            onClick={() => handleRemove(param)}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Add row — only show when no path vars exist yet or user started typing */}
      {(pathVars.length === 0 || newVarName) && (
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-1">
          <input
            type="text"
            value={newVarName}
            onChange={(e) => setNewVarName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder={t("request.variableName")}
            className="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
          />
          <div />
          <button
            onClick={handleAdd}
            disabled={!newVarName.trim() || pathVars.includes(newVarName.trim())}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
