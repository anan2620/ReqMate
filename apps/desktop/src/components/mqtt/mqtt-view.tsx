import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useActiveTab } from "@/stores/tab-store";
import { useMqtt, type MqttMessage } from "@/hooks/use-mqtt";
import { Select } from "@/components/ui/select";
import {
  Send,
  Plug,
  Unplug,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";

function mqttStatusLabel(status: string, t: TFunction): string {
  if (status === "connected") return t("mqtt.statusConnected");
  if (status === "connecting") return t("mqtt.statusConnecting");
  return t("mqtt.statusDisconnected");
}

const QOS_OPTIONS = [
  { value: "0", label: "QoS 0" },
  { value: "1", label: "QoS 1" },
  { value: "2", label: "QoS 2" },
];

export function MqttView() {
  const { t } = useTranslation();
  const tab = useActiveTab();
  const connectionId = tab?.id ?? "";

  const {
    status,
    messages,
    subscriptions,
    error,
    connect,
    disconnect,
    subscribe,
    publish,
    clearMessages,
  } = useMqtt(connectionId);

  // Connection settings
  const [brokerUrl, setBrokerUrl] = useState("localhost");
  const [port, setPort] = useState("1883");
  const [clientId, setClientId] = useState(
    () => `reqmate-${Math.random().toString(36).slice(2, 8)}`,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showAuth, setShowAuth] = useState(false);

  // Subscribe
  const [subTopic, setSubTopic] = useState("#");
  const [subQos, setSubQos] = useState(0);

  // Publish
  const [pubTopic, setPubTopic] = useState("");
  const [pubPayload, setPubPayload] = useState("");
  const [pubQos, setPubQos] = useState(0);
  const [pubRetain, setPubRetain] = useState(false);

  // UI
  const [autoScroll, setAutoScroll] = useState(true);
  const [topicFilter, setTopicFilter] = useState("");
  const [showSettings, setShowSettings] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  if (!tab) return null;

  const handleConnect = async () => {
    if (status === "connected") {
      disconnect();
    } else {
      await connect({
        brokerUrl,
        port: parseInt(port, 10) || 1883,
        clientId,
        username: username || undefined,
        password: password || undefined,
        keepAliveSecs: 30,
      });
    }
  };

  const handleSubscribe = () => {
    if (!subTopic.trim() || status !== "connected") return;
    subscribe(subTopic.trim(), subQos);
    setSubTopic("");
  };

  const handlePublish = () => {
    if (!pubTopic.trim() || status !== "connected") return;
    publish(pubTopic.trim(), pubPayload, pubQos, pubRetain);
  };

  const filteredMessages = topicFilter
    ? messages.filter((m) => m.topic.includes(topicFilter))
    : messages;

  const sentCount = messages.filter((m) => m.direction === "sent").length;
  const receivedCount = messages.filter((m) => m.direction === "received").length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Breadcrumb />

      {/* Connection bar */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">MQTT</span>
        <div className="flex flex-1 items-center gap-1.5">
          <input
            type="text"
            value={brokerUrl}
            onChange={(e) => setBrokerUrl(e.target.value)}
            placeholder={t("mqtt.brokerHost")}
            disabled={status === "connected"}
            className="h-9 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none disabled:opacity-50"
          />
          <span className="text-xs text-[var(--color-text-dimmed)]">:</span>
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="1883"
            disabled={status === "connected"}
            className="h-9 w-16 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none disabled:opacity-50"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-gray-500"
            }`}
          />
          <span className="text-xs text-[var(--color-text-muted)]">{mqttStatusLabel(status, t)}</span>
        </div>
        <button
          onClick={handleConnect}
          disabled={status === "connecting" || !brokerUrl.trim()}
          className={`flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold disabled:opacity-50 ${
            status === "connected" ? "btn-danger" : "btn-accent"
          }`}
        >
          {status === "connected" ? (
            <>
              <Unplug className="h-3.5 w-3.5" />
              {t("mqtt.disconnect")}
            </>
          ) : (
            <>
              <Plug className="h-3.5 w-3.5" />
              {status === "connecting" ? t("mqtt.connecting") : t("mqtt.connect")}
            </>
          )}
        </button>
      </div>

      {/* Connection settings (collapsible) */}
      <div className="border-b border-[var(--color-border)]">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex w-full items-center gap-1 px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          {showSettings ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {t("mqtt.connectionSettings")}
        </button>
        {showSettings && (
          <div className="grid grid-cols-2 gap-2 px-3 pb-2">
            <div>
              <label className="text-[10px] text-[var(--color-text-dimmed)]">{t("mqtt.clientId")}</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={status === "connected"}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-text-primary)] outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <button
                onClick={() => setShowAuth(!showAuth)}
                className="text-[10px] text-[var(--color-text-dimmed)] hover:text-[var(--color-text-secondary)]"
              >
                {t("mqtt.authentication")} {showAuth ? "▾" : "▸"}
              </button>
              {showAuth && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("mqtt.username")}
                    disabled={status === "connected"}
                    className="h-8 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none disabled:opacity-50"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("mqtt.password")}
                    disabled={status === "connected"}
                    className="h-8 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none disabled:opacity-50"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-[var(--color-border)] bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Subscribe + Publish panels */}
      <div className="grid grid-cols-2 border-b border-[var(--color-border)]">
        {/* Subscribe */}
        <div className="border-r border-[var(--color-border)] p-2">
          <div className="mb-1.5 text-[10px] font-medium uppercase text-[var(--color-text-dimmed)]">
            {t("mqtt.subscribe")}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={subTopic}
              onChange={(e) => setSubTopic(e.target.value)}
              placeholder={t("mqtt.topicPlaceholder")}
              disabled={status !== "connected"}
              className="h-8 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubscribe();
              }}
            />
            <Select
              value={String(subQos)}
              onChange={(v) => setSubQos(Number(v))}
              options={QOS_OPTIONS}
              disabled={status !== "connected"}
              className="!w-[86px] shrink-0"
              aria-label={t("mqtt.qos")}
            />
            <button
              onClick={handleSubscribe}
              disabled={status !== "connected" || !subTopic.trim()}
              className="btn-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md disabled:opacity-40"
              title={t("mqtt.subscribe")}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {subscriptions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {subscriptions.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-400"
                >
                  {topic}
                  <button
                    onClick={() => {
                      /* unsubscribe not supported by backend yet, just remove from UI */
                    }}
                    className="hover:text-purple-200"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Publish */}
        <div className="p-2">
          <div className="mb-1.5 text-[10px] font-medium uppercase text-[var(--color-text-dimmed)]">
            {t("mqtt.publish")}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={pubTopic}
              onChange={(e) => setPubTopic(e.target.value)}
              placeholder={t("mqtt.topic")}
              disabled={status !== "connected"}
              className="h-8 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none disabled:opacity-50"
            />
            <Select
              value={String(pubQos)}
              onChange={(v) => setPubQos(Number(v))}
              options={QOS_OPTIONS}
              disabled={status !== "connected"}
              className="!w-[86px] shrink-0"
              aria-label={t("mqtt.qos")}
            />
            <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={pubRetain}
                onChange={(e) => setPubRetain(e.target.checked)}
                disabled={status !== "connected"}
                className="h-3 w-3"
              />
              {t("mqtt.retain")}
            </label>
          </div>
          <div className="mt-1.5 flex items-stretch gap-1.5">
            <textarea
              value={pubPayload}
              onChange={(e) => setPubPayload(e.target.value)}
              placeholder={t("mqtt.payloadPlaceholder")}
              disabled={status !== "connected"}
              className="h-16 flex-1 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-2 font-mono text-[12.5px] leading-5 text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none disabled:opacity-50"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handlePublish();
                }
              }}
            />
            <button
              onClick={handlePublish}
              disabled={status !== "connected" || !pubTopic.trim()}
              className="btn-accent flex shrink-0 items-center gap-1.5 self-stretch rounded-md px-3.5 text-[12.5px] font-semibold disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {t("mqtt.publish")}
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-3">
          <span>{t("mqtt.messagesCount", { count: messages.length })}</span>
          <span className="text-green-500">{t("mqtt.sentCount", { count: sentCount })}</span>
          <span className="text-blue-500">{t("mqtt.receivedCount", { count: receivedCount })}</span>
          <span className="text-purple-400">{t("mqtt.topicsCount", { count: subscriptions.length })}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            placeholder={t("mqtt.filterPlaceholder")}
            className="w-40 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-0.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
          />
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="h-3 w-3"
            />
            {t("mqtt.autoScroll")}
          </label>
          <button
            onClick={clearMessages}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--color-elevated)]"
            title={t("mqtt.clearLog")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Message log */}
      <div ref={logRef} className="flex-1 overflow-auto">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-[var(--color-text-dimmed)]">
            {status === "connected" ? t("mqtt.emptyConnected") : t("mqtt.emptyDisconnected")}
          </div>
        ) : (
          filteredMessages.map((msg, i) => (
            <MessageRow key={i} msg={msg} />
          ))
        )}
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: MqttMessage }) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex gap-2 border-b border-[var(--color-border)] px-3 py-2 text-sm ${
        msg.direction === "sent" ? "bg-green-500/5" : "bg-blue-500/5"
      }`}
    >
      <div className="shrink-0 pt-0.5">
        {msg.direction === "sent" ? (
          <ArrowUp className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 text-blue-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
            {msg.topic}
          </span>
          <span className="text-[10px] text-[var(--color-text-dimmed)]">
            {t("mqtt.qosValue", { qos: msg.qos })}
          </span>
          {msg.retain && (
            <span className="text-[10px] text-yellow-500">{t("mqtt.retained")}</span>
          )}
        </div>
        <pre className="whitespace-pre-wrap break-all font-mono text-xs text-[var(--color-text-primary)]">
          {msg.payload}
        </pre>
      </div>
      <div className="shrink-0 text-[10px] text-[var(--color-text-dimmed)]">
        {new Date(msg.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
