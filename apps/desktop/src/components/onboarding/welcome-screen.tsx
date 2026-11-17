import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Download, Plus } from "lucide-react";
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
    <div className="app-canvas relative flex h-screen flex-col items-center justify-center overflow-hidden text-[var(--color-text-primary)]">
      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(45% 40% at 50% 8%, var(--color-accent-soft), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in srgb, var(--color-text-primary) 5%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-text-primary) 5%, transparent) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(60% 50% at 50% 35%, black, transparent 78%)",
          WebkitMaskImage: "radial-gradient(60% 50% at 50% 35%, black, transparent 78%)",
        }}
      />

      <div className="relative flex w-[440px] max-w-[88vw] flex-col items-center gap-9">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-5 rounded-[30px] opacity-70 blur-2xl"
              style={{ background: "var(--color-accent-ring)" }}
            />
            <img
              src="/app-icon.png"
              alt="ReqMate"
              className="relative h-[68px] w-[68px] rounded-[20px] elev-lg ring-1 ring-[color-mix(in_srgb,var(--color-text-primary)_12%,transparent)]"
            />
          </div>
          <div className="text-center">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">
              {t("onboarding.welcome")}
            </h1>
            <p className="mx-auto mt-2 max-w-[340px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              {t("onboarding.tagline")}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2.5">
          {[
            { icon: Plus, onClick: handleStartFresh, title: t("onboarding.startScratch"), desc: t("onboarding.startScratchDesc"), primary: true },
            { icon: Download, onClick: handleImport, title: t("onboarding.importExisting"), desc: t("onboarding.importExistingDesc") },
            { icon: FolderOpen, onClick: handleOpenFolder, title: t("onboarding.openFolder"), desc: t("onboarding.openFolderDesc") },
          ].map((opt) => (
            <button
              key={opt.title}
              onClick={opt.onClick}
              disabled={opt.primary ? loading : false}
              className={`group flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left elev-xs transition-all duration-200 hover:-translate-y-px hover:elev-md disabled:opacity-60 ${
                opt.primary
                  ? "border-[var(--color-accent-line)] bg-[color-mix(in_srgb,var(--color-accent)_7%,var(--color-card))]"
                  : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)] transition-transform duration-200 group-hover:scale-105">
                <opt.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                  {opt.title}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--color-text-muted)]">
                  {opt.desc}
                </span>
              </span>
              <span className="text-[var(--color-text-dimmed)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
                →
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={async () => {
            await updateSettings({ onboardingComplete: true });
            onComplete();
          }}
          className="rounded-md px-3 py-1.5 text-[11.5px] text-[var(--color-text-dimmed)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_6%,transparent)] hover:text-[var(--color-text-secondary)]"
        >
          {t("common.skipForNow")}
        </button>
      </div>
    </div>
  );
}
