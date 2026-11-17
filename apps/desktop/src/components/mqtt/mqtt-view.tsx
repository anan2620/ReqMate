import { useState, useRef, useEffect } from "react";
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

const QOS_OPTIONS = [
  { value: "0", label: "QoS 0" },
  { value: "1", label: "QoS 1" },
  { value: "2", label: "QoS 2" },
];

export function MqttView() {
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
            placeholder="Broker host"
            disabled={status === "connected"}
            className="flex-1 rounded bg-[var(--color-elevated)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
          />
          <span className="text-xs text-[var(--color-text-dimmed)]">:</span>
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="1883"
            disabled={status === "connected"}
            className="w-16 rounded bg-[var(--color-elevated)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
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
          <span className="text-xs text-[var(--color-text-muted)] capitalize">{status}</span>
        </div>
        <button
          onClick={handleConnect}
          disabled={status === "connecting" || !brokerUrl.trim()}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-semibold disabled:opacity-50 ${
            status === "connected" ? "btn-danger" : "btn-accent"
          }`}
        >
          {status === "connected" ? (
            <>
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </>
          ) : (
            <>
              <Plug className="h-3.5 w-3.5" />
              {status === "connecting" ? "Connecting..." : "Connect"}
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
          Connection Settings
        </button>
        {showSettings && (
          <div className="grid grid-cols-2 gap-2 px-3 pb-2">
            <div>
              <label className="text-[10px] text-[var(--color-text-dimmed)]">Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={status === "connected"}
                className="w-full rounded bg-[var(--color-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
              />
            </div>
            <div>
              <button
                onClick={() => setShowAuth(!showAuth)}
                className="text-[10px] text-[var(--color-text-dimmed)] hover:text-[var(--color-text-secondary)]"
              >
                Authentication {showAuth ? "▾" : "▸"}
              </button>
              {showAuth && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    disabled={status === "connected"}
                    className="h-8 flex-1 rounded-md bg-[var(--color-elevated)] px-2.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    disabled={status === "connected"}
                    className="h-8 flex-1 rounded-md bg-[var(--color-elevated)] px-2.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
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
            Subscribe
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={subTopic}
              onChange={(e) => setSubTopic(e.target.value)}
              placeholder="Topic (e.g. sensor/#)"
              disabled={status !== "connected"}
              className="h-8 flex-1 rounded-md bg-[var(--color-elevated)] px-2.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
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
              aria-label="QoS"
            />
            <button
              onClick={handleSubscribe}
              disabled={status !== "connected" || !subTopic.trim()}
              className="btn-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md disabled:opacity-40"
              title="Subscribe"
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
            Publish
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={pubTopic}
              onChange={(e) => setPubTopic(e.target.value)}
              placeholder="Topic"
              disabled={status !== "connected"}
              className="h-8 flex-1 rounded-md bg-[var(--color-elevated)] px-2.5 text-[12.5px] text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
            />
            <Select
              value={String(pubQos)}
              onChange={(v) => setPubQos(Number(v))}
              options={QOS_OPTIONS}
              disabled={status !== "connected"}
              className="!w-[86px] shrink-0"
              aria-label="QoS"
            />
            <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={pubRetain}
                onChange={(e) => setPubRetain(e.target.checked)}
                disabled={status !== "connected"}
                className="h-3 w-3"
              />
              Retain
            </label>
          </div>
          <div className="mt-1.5 flex items-end gap-1.5">
            <textarea
              value={pubPayload}
              onChange={(e) => setPubPayload(e.target.value)}
              placeholder="Message payload"
              disabled={status !== "connected"}
              className="flex-1 resize-none rounded bg-[var(--color-elevated)] p-2 font-mono text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
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
              className="btn-accent flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Publish
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-3">
          <span>Messages: {messages.length}</span>
          <span className="text-green-500">Sent: {sentCount}</span>
          <span className="text-blue-500">Received: {receivedCount}</span>
          <span className="text-purple-400">Topics: {subscriptions.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            placeholder="Filter by topic..."
            className="w-40 rounded bg-[var(--color-elevated)] px-2 py-0.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
          />
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="h-3 w-3"
            />
            Auto-scroll
          </label>
          <button
            onClick={clearMessages}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--color-elevated)]"
            title="Clear log"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Message log */}
      <div ref={logRef} className="flex-1 overflow-auto">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-[var(--color-text-dimmed)]">
            {status === "connected"
              ? "No messages yet — subscribe to a topic"
              : "Connect to a broker to start"}
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
            QoS {msg.qos}
          </span>
          {msg.retain && (
            <span className="text-[10px] text-yellow-500">retained</span>
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
