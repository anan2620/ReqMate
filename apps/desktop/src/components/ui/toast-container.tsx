import { useTranslation } from "react-i18next";
import { useToastStore } from "@/stores/toast-store";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const styleMap = {
  error: {
    border: "var(--color-error)",
    iconBg: "color-mix(in srgb, var(--color-error) 14%, transparent)",
    icon: "text-[var(--color-error)]",
  },
  warning: {
    border: "var(--color-warning)",
    iconBg: "color-mix(in srgb, var(--color-warning) 16%, transparent)",
    icon: "text-[var(--color-warning)]",
  },
  info: {
    border: "var(--color-accent)",
    iconBg: "var(--color-accent-soft)",
    icon: "text-[var(--color-accent-text)]",
  },
  success: {
    border: "var(--color-success)",
    iconBg: "color-mix(in srgb, var(--color-success) 14%, transparent)",
    icon: "text-[var(--color-success)]",
  },
};

export function ToastContainer() {
  const { t } = useTranslation();
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5" role="log" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        const styles = styleMap[toast.type];
        return (
          <div
            key={toast.id}
            className="surface-pop animate-panel-in flex min-w-[300px] max-w-[420px] items-start gap-3 overflow-hidden rounded-xl border-l-[3px] px-3.5 py-3"
            style={{ borderLeftColor: styles.border }}
            role="alert"
          >
            <span
              className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${styles.icon}`}
              style={{ backgroundColor: styles.iconBg }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <p className="min-w-0 flex-1 break-words pt-0.5 text-[12.5px] leading-relaxed text-[var(--color-text-primary)]">
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded p-1 text-[var(--color-text-dimmed)] opacity-70 transition-all hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-secondary)] hover:opacity-100"
              aria-label={t("common.dismiss")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
