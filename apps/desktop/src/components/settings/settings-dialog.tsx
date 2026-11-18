import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  FolderOpen,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  Check,
  Palette,
  Save,
  Network,
  ShieldCheck,
  Sparkles,
  Keyboard,
  SlidersHorizontal,
  DatabaseBackup,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/lib/i18n";
import { useSettingsStore } from "@/stores/settings-store";
import {
  useShortcutsStore,
  SHORTCUT_ACTIONS,
  formatBindingParts,
  bindingFromKeyboardEvent,
} from "@/stores/shortcuts-store";
import type { AppSettings } from "@reqmate/types";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { exportAppState, importAppState } from "@/lib/tauri-api";
import { tokenSwatchGroups } from "@/styles/tokens";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSectionId =
  | "appearance"
  | "saving"
  | "network"
  | "certificates"
  | "ai"
  | "updates"
  | "shortcuts"
  | "backup"
  | "tokens";

const PROXY_MODES: {
  value: "off" | "on" | "system";
  labelKey: string;
}[] = [
  { value: "off", labelKey: "settings.proxyOff" },
  { value: "on", labelKey: "settings.proxyOn" },
  { value: "system", labelKey: "settings.proxySystem" },
];

const PROXY_TYPES = ["http", "https", "socks5"] as const;

const SETTINGS_SECTIONS: {
  id: SettingsSectionId;
  icon: typeof Palette;
  labelKey: string;
}[] = [
  { id: "appearance", icon: Palette, labelKey: "settings.appearance" },
  { id: "saving", icon: Save, labelKey: "settings.saving" },
  { id: "network", icon: Network, labelKey: "settings.network" },
  { id: "certificates", icon: ShieldCheck, labelKey: "settings.certificates" },
  { id: "ai", icon: Sparkles, labelKey: "settings.aiAssistant" },
  { id: "updates", icon: RefreshCw, labelKey: "settings.updates" },
  { id: "shortcuts", icon: Keyboard, labelKey: "settings.shortcuts" },
  { id: "backup", icon: DatabaseBackup, labelKey: "settings.backup" },
  { id: "tokens", icon: SlidersHorizontal, labelKey: "settings.designTokens" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettingsStore();
  const { t, i18n } = useTranslation();
  const [section, setSection] = useState<SettingsSectionId>("appearance");
  const scrollRef = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<AppSettings>) => {
    updateSettings(patch);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-overlay)]" />
        <Dialog.Content className="animate-panel-in fixed left-1/2 top-1/2 z-50 flex h-[86vh] max-h-[860px] w-[1040px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-card)] elev-pop focus:outline-none">
          {/* Header — fixed, the body scrolls beneath it */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-6 py-3.5">
            <Dialog.Title className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
              {t("settings.title")}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Section menu */}
            <nav
              aria-label={t("settings.title")}
              className="flex w-[210px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] p-2.5"
            >
              {SETTINGS_SECTIONS.map((item) => {
                const active = section === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSection(item.id);
                      if (scrollRef.current) scrollRef.current.scrollTop = 0;
                    }}
                    aria-current={active ? "true" : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                      active
                        ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent-text)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.7} />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </button>
                );
              })}
            </nav>

            {/* Active section */}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <div className="max-w-[680px] px-7 py-6">
                {/* Appearance Section */}
                <section hidden={section !== "appearance"}>
                  <h3 className="label-caps mb-3 block">
                    {t("settings.appearance")}
                  </h3>

                  {/* Theme */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.theme")}
                    </label>
                    <div className="flex gap-2">
                      {(["system", "light", "dark", "black"] as const).map((themeOption) => (
                        <button
                          key={themeOption}
                          onClick={() => update({ theme: themeOption })}
                          className={`rounded-md border px-3.5 py-1.5 text-[12.5px] capitalize transition-colors ${
                            settings.theme === themeOption
                              ? "border-transparent bg-[var(--color-accent)] font-medium text-white"
                              : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          {themeOption === "black"
                            ? t("settings.black")
                            : themeOption === "light"
                              ? t("settings.light")
                              : themeOption === "dark"
                                ? t("settings.dark")
                                : t("settings.system")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.accentColor")}
                    </label>
                    <div className="flex gap-2">
                      {([
                        { name: "indigo", color: "#5b5bd6" },
                        { name: "blue", color: "#2f6fed" },
                        { name: "emerald", color: "#0d9d70" },
                        { name: "amber", color: "#d98313" },
                        { name: "rose", color: "#e23b57" },
                        { name: "violet", color: "#7c4ddb" },
                        { name: "cyan", color: "#0a91ad" },
                        { name: "orange", color: "#e2661a" },
                      ] as const).map((a) => (
                        <button
                          key={a.name}
                          onClick={() => update({ accentColor: a.name })}
                          title={a.name.charAt(0).toUpperCase() + a.name.slice(1)}
                          aria-pressed={settings.accentColor === a.name}
                          className={`flex h-7 w-7 items-center justify-center rounded-full transition-opacity ${
                            settings.accentColor === a.name
                              ? "opacity-100"
                              : "opacity-75 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: a.color }}
                        >
                          {settings.accentColor === a.name && (
                            <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Layout */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.panelLayout")}
                    </label>
                    <div className="flex gap-2">
                      {([
                        { value: "horizontal" as const, label: t("settings.sideBySide") },
                        { value: "vertical" as const, label: t("settings.stacked") },
                        { value: "tabbed" as const, label: t("settings.tabbed") },
                      ]).map((l) => (
                        <button
                          key={l.value}
                          onClick={() => update({ layout: l.value })}
                          className={`rounded-md border px-3.5 py-1.5 text-[12.5px] transition-all ${
                            settings.layout === l.value
                              ? "border-transparent bg-[var(--color-accent)] font-medium text-white"
                              : "border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-muted)] hover:border-[color-mix(in_srgb,var(--color-border-strong)_60%,var(--color-text-muted))] hover:text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sidebar width */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.sidebarWidth")}: {settings.sidebarWidth}px
                    </label>
                    <input
                      type="range"
                      min={180}
                      max={400}
                      step={4}
                      value={settings.sidebarWidth}
                      onChange={(e) => update({ sidebarWidth: Number(e.target.value) })}
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </div>

                  {/* Language */}
                  <div>
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.language")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            i18n.changeLanguage(lang.code);
                            localStorage.setItem("reqmate-language", lang.code);
                          }}
                          className={`rounded-md border px-3 py-1.5 text-[12.5px] transition-colors ${
                            i18n.language === lang.code
                              ? "border-transparent bg-[var(--color-accent)] text-white"
                              : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Saving Section */}
                <section hidden={section !== "saving"}>
                  <h3 className="label-caps mb-3 block">
                    {t("settings.saving")}
                  </h3>
                  <div className="flex items-start justify-between gap-8">
                    <div className="min-w-0">
                      <label
                        htmlFor="setting-auto-save"
                        className="text-sm text-[var(--color-text-secondary)]"
                      >
                        {t("settings.autoSave")}
                      </label>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
                        {t("settings.autoSaveDesc")}
                      </p>
                    </div>
                    <div id="setting-auto-save">
                      <ToggleSwitch
                        checked={settings.autoSave}
                        onChange={(v) => update({ autoSave: v })}
                      />
                    </div>
                  </div>
                </section>

                {/* Network Section */}
                <section hidden={section !== "network"}>
                  <h3 className="label-caps mb-3 block">
                    {t("settings.network")}
                  </h3>

                  {/* SSL Verification */}
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm text-[var(--color-text-secondary)]">
                      {t("settings.sslVerification")}
                    </label>
                    <ToggleSwitch
                      checked={settings.verifySsl}
                      onChange={(v) => update({ verifySsl: v })}
                    />
                  </div>

                  {/* Follow Redirects */}
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm text-[var(--color-text-secondary)]">
                      {t("settings.followRedirects")}
                    </label>
                    <ToggleSwitch
                      checked={settings.followRedirects}
                      onChange={(v) => update({ followRedirects: v })}
                    />
                  </div>

                  {/* Timeout */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.timeout")}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={settings.timeoutMs}
                      onChange={(e) => update({ timeoutMs: Number(e.target.value) || 30000 })}
                      className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                    />
                  </div>

                  {/* Proxy */}
                  <div>
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.proxyMode")}
                    </label>
                    <div className="flex gap-2">
                      {PROXY_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          onClick={() => update({ proxyMode: mode.value })}
                          aria-pressed={settings.proxyMode === mode.value}
                          className={`rounded-md border px-3.5 py-1.5 text-[12.5px] transition-colors ${
                            settings.proxyMode === mode.value
                              ? "border-transparent bg-[var(--color-accent)] font-medium text-white"
                              : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          {t(mode.labelKey)}
                        </button>
                      ))}
                    </div>

                    {settings.proxyMode === "system" && (
                      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
                        {t("settings.proxySystemHint")}
                      </p>
                    )}

                    {settings.proxyMode === "on" && (
                      <div className="mt-3 space-y-3 rounded-md border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text-primary)_2%,transparent)] p-3">
                        {/* Scheme */}
                        <div>
                          <label className="mb-1.5 block text-[12.5px] text-[var(--color-text-secondary)]">
                            {t("settings.proxyType")}
                          </label>
                          <div className="flex gap-2">
                            {PROXY_TYPES.map((type) => (
                              <button
                                key={type}
                                onClick={() => update({ proxyType: type })}
                                aria-pressed={settings.proxyType === type}
                                className={`rounded-md border px-2.5 py-1 text-[12px] uppercase tracking-wide transition-colors ${
                                  settings.proxyType === type
                                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent-text)]"
                                    : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]"
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Host + port */}
                        <div className="flex gap-2">
                          <div className="min-w-0 flex-1">
                            <label className="mb-1.5 block text-[12.5px] text-[var(--color-text-secondary)]">
                              {t("settings.proxyHost")}
                            </label>
                            <input
                              type="text"
                              value={settings.proxyHost ?? ""}
                              onChange={(e) => update({ proxyHost: e.target.value.trim() || null })}
                              placeholder="127.0.0.1"
                              spellCheck={false}
                              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 font-mono text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-colors focus:border-[var(--color-accent)]"
                            />
                          </div>
                          <div className="w-[96px] shrink-0">
                            <label className="mb-1.5 block text-[12.5px] text-[var(--color-text-secondary)]">
                              {t("settings.proxyPort")}
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={65535}
                              value={settings.proxyPort ?? ""}
                              onChange={(e) => {
                                const parsed = Number(e.target.value);
                                update({
                                  proxyPort:
                                    Number.isFinite(parsed) && parsed > 0 && parsed <= 65535
                                      ? Math.trunc(parsed)
                                      : null,
                                });
                              }}
                              placeholder="8080"
                              className="tabular w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-colors focus:border-[var(--color-accent)]"
                            />
                          </div>
                        </div>

                        {/* Bypass list */}
                        <div>
                          <label className="mb-1.5 block text-[12.5px] text-[var(--color-text-secondary)]">
                            {t("settings.proxyBypass")}
                          </label>
                          <textarea
                            rows={3}
                            value={settings.proxyBypass ?? ""}
                            onChange={(e) => update({ proxyBypass: e.target.value || null })}
                            placeholder={"localhost\n127.0.0.1\n*.internal.example.com"}
                            spellCheck={false}
                            className="w-full resize-none rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 font-mono text-[12.5px] leading-relaxed text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-colors focus:border-[var(--color-accent)]"
                          />
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                            {t("settings.proxyBypassHint")}
                          </p>
                        </div>

                        {/* Authentication */}
                        <div>
                          <label className="mb-1.5 block text-[12.5px] text-[var(--color-text-secondary)]">
                            {t("settings.proxyAuth")}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={settings.proxyUsername ?? ""}
                              onChange={(e) => update({ proxyUsername: e.target.value || null })}
                              placeholder={t("settings.proxyUsername")}
                              autoComplete="off"
                              className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-colors focus:border-[var(--color-accent)]"
                            />
                            <input
                              type="password"
                              value={settings.proxyPassword ?? ""}
                              onChange={(e) => update({ proxyPassword: e.target.value || null })}
                              placeholder={t("settings.proxyPassword")}
                              autoComplete="off"
                              className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-colors focus:border-[var(--color-accent)]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Certificates Section */}
                <section hidden={section !== "certificates"}>
                  <h3 className="label-caps mb-3 block">
                    {t("settings.certificates")}
                  </h3>

                  {/* Custom CA Certificate */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.caCert")}
                    </label>
                    <FilePathInput
                      value={settings.caCertPath ?? ""}
                      onChange={(v) => update({ caCertPath: v || null })}
                      placeholder="Path to CA certificate (.pem, .crt)"
                      filters={[{ name: "Certificates", extensions: ["pem", "crt", "cer"] }]}
                    />
                  </div>

                  {/* Client Certificate */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.clientCert")}
                    </label>
                    <FilePathInput
                      value={settings.clientCertPath ?? ""}
                      onChange={(v) => update({ clientCertPath: v || null })}
                      placeholder="Path to client certificate (.pem, .crt, .pfx)"
                      filters={[{ name: "Certificates", extensions: ["pem", "crt", "cer", "pfx", "p12"] }]}
                    />
                  </div>

                  {/* Client Key */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                      {t("settings.clientKey")}
                    </label>
                    <FilePathInput
                      value={settings.clientKeyPath ?? ""}
                      onChange={(v) => update({ clientKeyPath: v || null })}
                      placeholder="Path to client private key (.pem, .key)"
                      filters={[{ name: "Keys", extensions: ["pem", "key"] }]}
                    />
                  </div>

                  {/* PFX Passphrase */}
                  {settings.clientCertPath?.match(/\.(pfx|p12)$/i) && (
                    <div className="mb-4">
                      <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                        {t("settings.pfxPassphrase")}
                      </label>
                      <input
                        type="password"
                        value={settings.clientCertPassphrase ?? ""}
                        onChange={(e) => update({ clientCertPassphrase: e.target.value || null })}
                        placeholder="Passphrase (optional)"
                                            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-colors focus:border-[var(--color-accent)]"
                      />
                    </div>
                  )}
                </section>

                {/* AI Section */}
                <section id="settings-ai" hidden={section !== "ai"}>
                  <h3 className="label-caps mb-3 block">
                    {t("settings.aiAssistant")}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm text-[var(--color-text-secondary)]">
                        API Endpoint
                      </label>
                      <input
                        type="text"
                        value={settings.aiEndpoint ?? ""}
                        onChange={(e) => update({ aiEndpoint: e.target.value.trim() || null })}
                        placeholder="https://api.openai.com/v1"
                        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dimmed)]"
                      />
                      <p className="mt-0.5 text-xs text-[var(--color-text-dimmed)]">
                        Any OpenAI-compatible endpoint (OpenAI, Ollama, LM Studio, etc.)
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-[var(--color-text-secondary)]">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={settings.aiApiKey ?? ""}
                        onChange={(e) => update({ aiApiKey: e.target.value || null })}
                        placeholder="sk-..."
                        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dimmed)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-[var(--color-text-secondary)]">
                        Model
                      </label>
                      <input
                        type="text"
                        value={settings.aiModel ?? ""}
                        onChange={(e) => update({ aiModel: e.target.value || null })}
                        placeholder="gpt-4o-mini"
                        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dimmed)]"
                      />
                    </div>
                  </div>
                </section>

                {/* Updates Section */}
                <div hidden={section !== "updates"}>
                  <UpdateSection settings={settings} update={update} />
                </div>

                {/* Keyboard Shortcuts */}
                <div hidden={section !== "shortcuts"}>
                  <KeyboardShortcutsSection />
                </div>

                {/* Backup Section */}
                <div hidden={section !== "backup"}>
                  <BackupSection />
                </div>

                {/* Design Tokens Reference */}
                <div hidden={section !== "tokens"}>
                  <DesignTokensSection />
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UpdateSection({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Awaited<ReturnType<typeof import("@tauri-apps/plugin-updater").check>> | null>(null);
  const [backups, setBackups] = useState<string[]>([]);
  const [installType, setInstallType] = useState<string | null>(null);

  const loadBackups = async () => {
    try {
      const { listRollbackVersions } = await import("@/lib/tauri-api");
      setBackups((await listRollbackVersions()) ?? []);
    } catch { /* ignore */ }
  };

  const detectInstallType = async () => {
    try {
      const { getInstallType } = await import("@/lib/tauri-api");
      setInstallType(await getInstallType());
    } catch { /* ignore */ }
  };

  const checkForUpdates = async () => {
    setChecking(true);
    setUpdateStatus(null);
    setPendingUpdate(null);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const result = await check();
      if (result) {
        setPendingUpdate(result);
        setUpdateStatus(`Update available: v${result.version}`);
      } else {
        setUpdateStatus("You're up to date!");
      }
      loadBackups();
    } catch (e) {
      setUpdateStatus(`Check failed: ${e}`);
    } finally {
      setChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!pendingUpdate) return;
    setInstalling(true);
    setUpdateStatus("Backing up current version...");
    try {
      const { backupCurrentBinary } = await import("@/lib/tauri-api");
      await backupCurrentBinary().catch(() => {});

      setUpdateStatus("Downloading update...");
      await pendingUpdate.downloadAndInstall((progress) => {
        if (progress.event === "Started" && progress.data.contentLength) {
          setUpdateStatus(`Downloading... (${(progress.data.contentLength / 1024 / 1024).toFixed(1)} MB)`);
        } else if (progress.event === "Finished") {
          setUpdateStatus("Download complete. Restart to apply.");
        }
      });
      setUpdateStatus("Update installed! Restart the app to apply.");
      setPendingUpdate(null);
      loadBackups();
    } catch (e) {
      setUpdateStatus(`Update failed: ${e}`);
    } finally {
      setInstalling(false);
    }
  };

  // Load backups and detect install type on mount
  useState(() => { loadBackups(); detectInstallType(); });

  const isSystemPackage = installType === "system-package";

  return (
    <section>
      <h3 className="label-caps mb-3 block">
        {t("settings.updates")}
      </h3>

      {isSystemPackage && (
        <div className="mb-4 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 p-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Auto-update isn't available for system package installs (.deb/.rpm).
            Use your package manager or download from{" "}
            <a
              href="https://github.com/anan2620/ReqMate/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent-text)] hover:underline inline-flex items-center gap-1"
            >
              GitHub Releases <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      )}

      <div className="mb-4">
        <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
          {t("settings.updateChannel")}
        </label>
        <div className="flex gap-2">
          {(["stable", "beta", "nightly"] as const).map((channel) => (
            <button
              key={channel}
              onClick={() => update({ updateChannel: channel })}
              className={`rounded-md border px-3.5 py-1.5 text-[12.5px] capitalize transition-colors ${
                settings.updateChannel === channel
                  ? "border-transparent bg-[var(--color-accent)] font-medium text-white"
                  : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {channel}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={checkForUpdates}
          disabled={checking || installing}
          className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking..." : t("settings.checkForUpdates")}
        </button>

        {pendingUpdate && !installing && !isSystemPackage && (
          <button
            onClick={installUpdate}
            className="flex items-center gap-1.5 rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" />
            Install v{pendingUpdate.version}
          </button>
        )}

        {pendingUpdate && isSystemPackage && (
          <a
            href={`https://github.com/anan2620/ReqMate/releases/tag/v${pendingUpdate.version}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Download v{pendingUpdate.version}
          </a>
        )}

        {updateStatus && (
          <span className="text-xs text-[var(--color-text-muted)]">{updateStatus}</span>
        )}
      </div>

      {backups.length > 0 && (
        <div className="mt-3">
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
            Saved rollback versions ({backups.length})
          </label>
          <div className="space-y-1">
            {backups.map((b) => (
              <div key={b} className="text-xs text-[var(--color-text-secondary)]">
                {b}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BackupSection() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [importConfirm, setImportConfirm] = useState<string | null>(null);

  const handleExport = async () => {
    const path = await saveFileDialog({
      defaultPath: `reqmate-backup-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (!path) return;

    try {
      setStatus(t("settings.exporting"));
      const result = await exportAppState(path, includeHistory);
      setStatus(`Exported ${result.filesIncluded.length} files to ${result.path}`);
    } catch (e) {
      setStatus(`Export failed: ${e}`);
    }
  };

  const handleImport = async () => {
    const path = await openFileDialog({
      multiple: false,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (!path) return;
    setImportConfirm(path);
  };

  const confirmImport = async () => {
    if (!importConfirm) return;
    setImportConfirm(null);
    try {
      setStatus(t("settings.importing"));
      const result = await importAppState(importConfirm);
      const parts = [...result.filesRestored];
      if (result.historyEntries) parts.push(`history (${result.historyEntries})`);
      setStatus(`Restored: ${parts.join(", ")}. Restart app to apply.`);
    } catch (e) {
      setStatus(`Import failed: ${e}`);
    }
  };

  return (
    <section>
      <h3 className="label-caps mb-3 block">
        {t("settings.backup")}
      </h3>

      <div className="mb-3 flex items-center justify-between">
        <label className="text-sm text-[var(--color-text-secondary)]">
          {t("settings.includeHistory")}
        </label>
        <button
          role="switch"
          aria-checked={includeHistory}
          onClick={() => setIncludeHistory(!includeHistory)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
            includeHistory ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              includeHistory ? "translate-x-4.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
        >
          <Download className="h-3.5 w-3.5" />
          {t("settings.exportState")}
        </button>
        <button
          onClick={handleImport}
          className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
        >
          <Upload className="h-3.5 w-3.5" />
          {t("settings.importState")}
        </button>
      </div>

      {status && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{status}</p>
      )}

      {/* Import confirmation dialog */}
      <Dialog.Root open={!!importConfirm} onOpenChange={(v) => { if (!v) setImportConfirm(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-[var(--color-overlay)]" />
          <Dialog.Content className="animate-panel-in surface-pop fixed left-1/2 top-1/2 z-[60] w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl p-5">
            <Dialog.Title className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
              {t("settings.importState")}
            </Dialog.Title>
            <p className="mb-5 text-sm text-[var(--color-text-secondary)]">
              This will merge settings and replace history. Continue?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setImportConfirm(null)}
                className="rounded-lg px-4 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
              >
                Import
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function FilePathInput({
  value,
  onChange,
  placeholder,
  filters,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  filters: { name: string; extensions: string[] }[];
}) {
  const browse = async () => {
    const selected = await openFileDialog({
      multiple: false,
      filters,
    });
    if (selected) {
      onChange(selected);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
                className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-colors focus:border-[var(--color-accent)]"
      />
      <button
        onClick={browse}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
        title="Browse..."
      >
        <FolderOpen className="h-4 w-4" />
      </button>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function DesignTokensSection() {
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="label-caps mb-3 block">
        {t("settings.designTokens")}
      </h3>
      <p className="mb-3 text-xs text-[var(--color-text-dimmed)]">
        Active color palette for the current theme. Useful for theme creators and plugin developers.
      </p>
      <div className="space-y-3">
        {tokenSwatchGroups.map((group) => (
          <div key={group.label}>
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-dimmed)]">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-2">
              {group.swatches.map((swatch) => (
                <div
                  key={swatch.name}
                  className="flex flex-col items-center gap-0.5"
                  title={swatch.value}
                >
                  <div
                    className="h-6 w-6 rounded-full border border-[var(--color-border)]"
                    style={{ backgroundColor: swatch.value }}
                  />
                  <span className="text-[9px] leading-tight text-[var(--color-text-dimmed)]">
                    {swatch.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function KeyboardShortcutsSection() {
  const { t } = useTranslation();
  const { getBinding, setBinding, resetAll, findConflicts } = useShortcutsStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const conflicts = findConflicts();

  const conflictActions = new Set<string>();
  for (const c of conflicts) {
    for (const id of c.actionIds) conflictActions.add(id);
  }

  return (
    <section>
      <h3 className="label-caps mb-3 block">
        {t("settings.shortcuts")}
      </h3>

      {conflicts.length > 0 && (
        <div className="mb-3 rounded bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
          Some shortcuts have conflicting bindings. Only one action will trigger per key combination.
        </div>
      )}

      <div className="space-y-0.5">
        {SHORTCUT_ACTIONS.map((action) => {
          const binding = getBinding(action.id);
          const isRecording = recordingId === action.id;
          const hasConflict = conflictActions.has(action.id);
          const parts = formatBindingParts(binding);

          return (
            <div
              key={action.id}
              className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-[var(--color-elevated)]"
            >
              <span className={`text-xs ${hasConflict ? "text-[var(--color-warning)]" : "text-[var(--color-text-secondary)]"}`}>
                {action.description}
              </span>
              <div className="flex items-center gap-1.5">
                {isRecording ? (
                  <span
                    className="rounded border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] text-[var(--color-accent-text)] animate-pulse"
                    tabIndex={0}
                    ref={(el) => {
                      if (el) {
                        el.focus();
                        const handler = (ev: KeyboardEvent) => {
                          if (ev.key === "Escape") {
                            ev.preventDefault();
                            setRecordingId(null);
                            el.removeEventListener("keydown", handler);
                            return;
                          }
                          const b = bindingFromKeyboardEvent(ev);
                          if (!b) return;
                          ev.preventDefault();
                          ev.stopPropagation();
                          setBinding(action.id, b);
                          setRecordingId(null);
                          el.removeEventListener("keydown", handler);
                        };
                        el.addEventListener("keydown", handler);
                      }
                    }}
                  >
                    Press new shortcut...
                  </span>
                ) : (
                  <div className="flex items-center gap-0.5">
                    {parts.map((part, i) => (
                      <kbd
                        key={i}
                        className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                          hasConflict
                            ? "border-[var(--color-warning)]/50 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                            : "border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        {part}
                      </kbd>
                    ))}
                  </div>
                )}
                {!isRecording && (
                  <button
                    onClick={() => setRecordingId(action.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-dimmed)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-secondary)]"
                  >
                    Rebind
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-[var(--color-text-dimmed)]">
          Escape always exits Zen mode (not customizable)
        </span>
        <button
          onClick={resetAll}
          className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text-primary)]"
        >
          <RefreshCw className="h-3 w-3" />
          Reset to Defaults
        </button>
      </div>
    </section>
  );
}
