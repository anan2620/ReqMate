import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProxyStore } from "@/stores/proxy-store";
import {
  proxyStart,
  proxyStop,
  proxyGetStatus,
  proxyGetCaptures,
  proxyClearCaptures,
  proxySetPassthrough,
  proxyGenerateCa,
  proxyCaExists,
  proxyGetCaCert,
  type CapturedRequest,
} from "@/lib/tauri-api";
import { copyText } from "@/lib/clipboard";
import {
  Play,
  Square,
  Trash2,
  Shield,
  ShieldCheck,
  Download,
  ChevronDown,
  ChevronRight,
  Search,
  Copy,
  Check,
} from "lucide-react";

export function ProxySidePanel() {
  const { t } = useTranslation();
  const status = useProxyStore((s) => s.status);
  const setStatus = useProxyStore((s) => s.setStatus);
  const [port, setPort] = useState("8888");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [passthrough, setPassthrough] = useState("");
  const [caExists, setCaExists] = useState(false);
  const [caCopied, setCaCopied] = useState(false);
  // Pre-loaded PEM: copying must happen inside the click gesture, and the IPC
  // round-trip alone is enough to lose it (clipboard writes then reject with
  // NotAllowedError).
  const [caPem, setCaPem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    proxyGetStatus()
      .then((s) => s && setStatus(s))
      .catch(() => {});
    proxyCaExists()
      .then((exists) => {
        setCaExists(exists);
        if (exists) proxyGetCaCert().then(setCaPem).catch(() => {});
      })
      .catch(() => {});
  }, [setStatus]);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      if (status.running) {
        const s = await proxyStop();
        setStatus(s);
      } else {
        const s = await proxyStart(parseInt(port, 10) || 8888);
        setStatus(s);
      }
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  };

  const handleGenerateCa = async () => {
    try {
      await proxyGenerateCa();
      setCaExists(true);
      setCaPem(await proxyGetCaCert());
      // A running proxy picked its interceptor up at start — restart it so the
      // new CA actually takes effect instead of silently staying a tunnel.
      if (status.running) {
        const activePort = status.port;
        await proxyStop();
        setStatus(await proxyStart(activePort));
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleCopyCaCert = async () => {
    try {
      const pem = caPem ?? (await proxyGetCaCert());
      if (!caPem) setCaPem(pem);
      if (!(await copyText(pem))) {
        setError(t("proxy.copyFailed"));
        return;
      }
      setCaCopied(true);
      setTimeout(() => setCaCopied(false), 2000);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleUpdatePassthrough = async () => {
    const domains = passthrough
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    try {
      await proxySetPassthrough(domains);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Status */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              status.running ? "bg-green-500 animate-pulse" : "bg-gray-500"
            }`}
          />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {status.running ? t("proxy.running") : t("proxy.stopped")}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* The port keeps its slot while running — it used to jump to the
              corner, which read like a stray label rather than the setting. */}
          <input
            type="text"
            value={status.running ? String(status.port) : port}
            onChange={(e) => setPort(e.target.value)}
            readOnly={status.running}
            placeholder="8888"
            aria-label={t("proxy.port")}
            className="h-7 w-[68px] rounded-md bg-[var(--color-surface)] px-2 text-xs text-[var(--color-text-primary)] outline-none transition-colors read-only:text-[var(--color-text-muted)] focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold disabled:opacity-50 ${
              status.running ? "btn-danger" : "btn-accent"
            }`}
          >
            {status.running ? (
              <>
                <Square className="h-3 w-3 shrink-0" />
                {t("proxy.stop")}
              </>
            ) : (
              <>
                <Play className="h-3 w-3 shrink-0" />
                {t("proxy.startProxy")}
              </>
            )}
          </button>
        </div>

        {status.running && (
          <p className="mt-2 text-[10px] text-[var(--color-text-dimmed)]">
            {t("proxy.proxyHint", { port: status.port })}
          </p>
        )}
        {status.running && status.mitm && (
          <p className="mt-1 flex items-center gap-1 text-[10px] text-green-500">
            <ShieldCheck className="h-3 w-3 shrink-0" />
            {t("proxy.mitmOn")}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* CA Certificate */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
        <div className="flex items-center gap-2 mb-2">
          {caExists ? (
            <ShieldCheck className="h-4 w-4 text-green-500" />
          ) : (
            <Shield className="h-4 w-4 text-[var(--color-text-muted)]" />
          )}
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t("proxy.caTitle")}
          </span>
        </div>
        {caExists ? (
          <div className="flex gap-2">
            <button
              onClick={handleCopyCaCert}
              className="flex flex-1 items-center justify-center gap-1.5 rounded bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
            >
              {caCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {caCopied ? t("proxy.copied") : t("proxy.copyPem")}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateCa}
            className="flex w-full items-center justify-center gap-1.5 rounded bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
          >
            <Download className="h-3 w-3" />
            {t("proxy.generateCa")}
          </button>
        )}
        <p className="mt-1.5 text-[10px] text-[var(--color-text-dimmed)]">
          {t("proxy.caHint")}
        </p>
      </div>

      {/* Settings */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          {showSettings ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {t("proxy.passthrough")}
        </button>
        {showSettings && (
          <div className="px-3 pb-3">
            <input
              type="text"
              value={passthrough}
              onChange={(e) => setPassthrough(e.target.value)}
              placeholder={t("proxy.passthroughPlaceholder")}
              className="w-full rounded bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-indigo-500"
              onBlur={handleUpdatePassthrough}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdatePassthrough();
              }}
            />
            <p className="mt-1 text-[10px] text-[var(--color-text-dimmed)]">
              {t("proxy.passthroughHint")}
            </p>
          </div>
        )}
      </div>

      {/* Captures count */}
      <div className="text-center text-xs text-[var(--color-text-dimmed)]">
        {t("proxy.captured", { count: status.captureCount })}
      </div>
    </div>
  );
}

export function ProxyCaptureViewer() {
  const { t } = useTranslation();
  const captures = useProxyStore((s) => s.captures);
  const selectedId = useProxyStore((s) => s.selectedId);
  const filter = useProxyStore((s) => s.filter);
  const isRunning = useProxyStore((s) => s.status.running);
  const setCaptures = useProxyStore((s) => s.setCaptures);
  const clearCaptures = useProxyStore((s) => s.clearCaptures);
  const selectCapture = useProxyStore((s) => s.selectCapture);
  const setFilter = useProxyStore((s) => s.setFilter);
  const appendCaptures = useProxyStore((s) => s.appendCaptures);

  // Listen for live captures.
  //
  // Events are buffered and flushed on a timer: a page load fires dozens of
  // captures at once, and updating the store per event meant one React render
  // (and one 500-row list diff) per request — that is what froze the window.
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const buffer: CapturedRequest[] = [];

    const flush = () => {
      timer = null;
      if (buffer.length === 0) return;
      appendCaptures(buffer.splice(0, buffer.length));
    };

    const setup = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<CapturedRequest>("proxy:capture", (event) => {
          if (cancelled) return;
          buffer.push(event.payload);
          if (timer === null) timer = setTimeout(flush, 60);
        });
      } catch {
        // Not in Tauri env
      }
    };
    setup();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      unlisten?.();
    };
  }, [appendCaptures]);

  // Load existing captures on mount
  useEffect(() => {
    proxyGetCaptures().then(setCaptures).catch(() => {});
  }, [setCaptures]);

  const handleClear = async () => {
    try {
      await proxyClearCaptures();
      clearCaptures();
    } catch {
      // ignore
    }
  };

  const selected = captures.find((c) => c.id === selectedId) ?? null;

  const filtered = filter
    ? captures.filter(
        (c) =>
          c.url.toLowerCase().includes(filter.toLowerCase()) ||
          c.method.toLowerCase().includes(filter.toLowerCase()) ||
          String(c.status ?? "").includes(filter),
      )
    : captures;

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-l border-[var(--color-border)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-1.5">
        <span className="text-xs font-semibold text-[var(--color-text-muted)]">
          {t("proxy.captures")}
        </span>
        <span className="rounded-full bg-[var(--color-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-dimmed)]">
          {filtered.length}
        </span>
        <div className="flex-1" />
        <div className="ring-focus flex items-center gap-1 rounded-lg border border-transparent bg-[color-mix(in_srgb,var(--color-text-primary)_5%,transparent)] pl-2 pr-1 py-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-primary)_7%,transparent)]">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-dimmed)]" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("proxy.filter")}
            className="w-28 bg-transparent py-1 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
          />
        </div>
        <button
          onClick={handleClear}
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-secondary)]"
          title={t("proxy.clearCaptures")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Capture list */}
        <div className="w-1/2 overflow-auto border-r border-[var(--color-border)]">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-[var(--color-text-dimmed)]">
              {isRunning ? t("proxy.waiting") : t("proxy.startHint")}
            </div>
          ) : (
            filtered.map((cap) => (
              <button
                key={cap.id}
                onClick={() => selectCapture(cap.id)}
                className={`flex w-full items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-left transition-colors ${
                  selectedId === cap.id
                    ? "bg-[var(--color-accent-glow)]"
                    : "hover:bg-[var(--color-elevated)]"
                }`}
              >
                <MethodBadge method={cap.method} />
                <StatusBadge status={cap.status} />
                <span className="flex-1 truncate text-xs text-[var(--color-text-primary)]">
                  {shortenUrl(cap.url)}
                </span>
                <span className="shrink-0 text-[10px] text-[var(--color-text-dimmed)]">
                  {cap.timeMs}ms
                </span>
              </button>
            ))
          )}
        </div>

        {/* Detail view */}
        <div className="flex-1 overflow-auto">
          {selected ? (
            <CaptureDetail capture={selected} />
          ) : (
            <div className="flex items-center justify-center py-8 text-xs text-[var(--color-text-dimmed)]">
              {t("proxy.selectRequest")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CaptureDetail({ capture }: { capture: CapturedRequest }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"request" | "response">("response");

  const tabs = [
    { id: "request" as const, label: t("proxy.request") },
    { id: "response" as const, label: t("proxy.response") },
  ];

  return (
    <div className="flex flex-col">
      {/* URL */}
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <MethodBadge method={capture.method} />
          <StatusBadge status={capture.status} />
          <span className="text-[10px] text-[var(--color-text-dimmed)]">
            {capture.timeMs}ms
          </span>
        </div>
        <p className="mt-1 break-all text-xs text-[var(--color-text-primary)]">
          {capture.url}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--color-text-dimmed)]">
          {new Date(capture.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-auto p-3">
        {activeTab === "request" ? (
          <>
            <SectionTitle>{t("proxy.headers")}</SectionTitle>
            <HeadersTable headers={capture.requestHeaders} />
            {capture.requestBody && (
              <>
                <SectionTitle>{t("proxy.body")}</SectionTitle>
                <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-[var(--color-surface)] p-2 font-mono text-xs text-[var(--color-text-primary)]">
                  {tryFormatJson(capture.requestBody)}
                </pre>
              </>
            )}
          </>
        ) : (
          <>
            <SectionTitle>{t("proxy.headers")}</SectionTitle>
            <HeadersTable headers={capture.responseHeaders} />
            {capture.responseBody && (
              <>
                <SectionTitle>{t("proxy.body")}</SectionTitle>
                <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-[var(--color-surface)] p-2 font-mono text-xs text-[var(--color-text-primary)]">
                  {tryFormatJson(capture.responseBody)}
                </pre>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-1 mt-3 first:mt-0 text-[10px] font-semibold uppercase text-[var(--color-text-dimmed)]">
      {children}
    </h4>
  );
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const { t } = useTranslation();
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return <p className="text-xs text-[var(--color-text-dimmed)]">{t("proxy.noHeaders")}</p>;
  }
  return (
    <div className="rounded border border-[var(--color-border)]">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex border-b border-[var(--color-border)] last:border-b-0"
        >
          <span className="w-1/3 shrink-0 break-all px-2 py-1 text-[10px] font-medium text-[var(--color-text-muted)]">
            {key}
          </span>
          <span className="flex-1 break-all px-2 py-1 text-[10px] text-[var(--color-text-primary)]">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-green-500/15 text-green-400",
    POST: "bg-blue-500/15 text-blue-400",
    PUT: "bg-amber-500/15 text-amber-400",
    PATCH: "bg-orange-500/15 text-orange-400",
    DELETE: "bg-red-500/15 text-red-400",
    HEAD: "bg-gray-500/15 text-gray-400",
    OPTIONS: "bg-purple-500/15 text-purple-400",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${colors[method] ?? "bg-gray-500/15 text-gray-400"}`}
    >
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) {
    return (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-500/15 text-red-400">
        ERR
      </span>
    );
  }
  const color =
    status < 300
      ? "bg-green-500/15 text-green-400"
      : status < 400
        ? "bg-yellow-500/15 text-yellow-400"
        : "bg-red-500/15 text-red-400";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>
      {status}
    </span>
  );
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function tryFormatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
