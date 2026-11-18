import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Download, Plus, ArrowRight } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { createSampleCollection } from "@/lib/tauri-api";
import { useCollectionStore } from "@/stores/collection-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useTabStore } from "@/stores/tab-store";

export function WelcomeScreen({
  onComplete,
  onOpenImport,
}: {
  onComplete: (startTour?: boolean) => void;
  onOpenImport: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { updateSettings } = useSettingsStore();

  const handleStartFresh = async () => {
    setLoading(true);
    try {
      const path = await createSampleCollection();
      await useCollectionStore.getState().openCollection(path);
      useTabStore.getState().newTab();
      await updateSettings({ onboardingComplete: true });
      onComplete(true);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to create sample collection: ${err}`),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    await updateSettings({ onboardingComplete: true });
    onComplete();
    onOpenImport();
  };

  const handleOpenFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        await useCollectionStore.getState().openCollection(selected as string);
        await updateSettings({ onboardingComplete: true });
        onComplete();
      }
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to open folder: ${err}`),
      );
    }
  };

  return (
    <div className="app-canvas flex h-screen flex-col items-center justify-center overflow-auto px-6 py-10 text-[var(--color-text-primary)]">
      <div className="w-[460px] max-w-full">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <img
            src="/app-icon.png"
            alt="ReqMate"
            className="h-10 w-10 rounded-[10px] ring-1 ring-[color-mix(in_srgb,var(--color-text-primary)_10%,transparent)]"
          />
          <span className="text-[16px] font-semibold tracking-[-0.01em]">ReqMate</span>
        </div>

        <h1 className="mt-8 text-[24px] font-semibold leading-tight tracking-[-0.02em]">
          {t("onboarding.welcome")}
        </h1>
        <p className="mt-2 max-w-[380px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          {t("onboarding.tagline")}
        </p>

        {/* Flat option list — one bordered block, hairline dividers */}
        <div className="mt-7 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
          {[
            { icon: Plus, onClick: handleStartFresh, title: t("onboarding.startScratch"), desc: t("onboarding.startScratchDesc"), primary: true },
            { icon: Download, onClick: handleImport, title: t("onboarding.importExisting"), desc: t("onboarding.importExistingDesc") },
            { icon: FolderOpen, onClick: handleOpenFolder, title: t("onboarding.openFolder"), desc: t("onboarding.openFolderDesc") },
          ].map((opt, i) => (
            <button
              key={opt.title}
              onClick={opt.onClick}
              disabled={opt.primary ? loading : false}
              className={`group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors disabled:opacity-60 ${
                i > 0 ? "border-t border-[var(--color-border)]" : ""
              } ${opt.primary ? "bg-[var(--color-accent-soft)] hover:bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)]" : "hover:bg-[var(--color-card-hover)]"}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  opt.primary
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-elevated)] text-[var(--color-text-secondary)]"
                }`}
              >
                <opt.icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                  {opt.title}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--color-text-muted)]">
                  {opt.desc}
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-dimmed)] opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>

        <button
          onClick={async () => {
            await updateSettings({ onboardingComplete: true });
            onComplete();
          }}
          className="mt-4 rounded-md px-1.5 py-1.5 text-[11.5px] text-[var(--color-text-dimmed)] transition-colors hover:text-[var(--color-text-secondary)]"
        >
          {t("common.skipForNow")}
        </button>
      </div>
    </div>
  );
}
