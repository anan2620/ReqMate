import { create } from "zustand";
import type {
  HttpMethod,
  KeyValuePair,
  RequestBody,
  AuthConfig,
  HttpError,
  ResponseData,
  ProxyConfig,
  Tab,
} from "@reqmate/types";
import {
  sendRequest,
  sendRequestWithScripts,
  cancelRequest,
  readRequestFile,
  saveRequestFile,
  loadPersistedState,
  savePersistedState,
} from "@/lib/tauri-api";
import { useEnvironmentStore } from "./environment-store";
import { useSettingsStore } from "./settings-store";
import { useConsoleStore } from "./console-store";
import { createEmptyTab, emptyKvRow, kvId, MAX_UNDO_DEPTH, takeSnapshot } from "./tab/tab-model";
import {
  buildUrlWithParams,
  parseUrlParams,
  requestFileToTab,
  tabToRequestFile,
} from "./tab/tab-serialization";
import { markRecentlySaved } from "./tab/recently-saved";
import { resolvePathVariables } from "@/lib/url";
import {
  getPersistableGeometry,
  isMaximizedCached,
  refreshWindowState,
} from "./tab/window-state";

// Re-exported for the file watcher, which must ignore our own writes.
export { wasRecentlySaved } from "./tab/recently-saved";

/**
 * Per-tab request token.
 *
 * Bumped whenever a request starts or is cancelled. A response that comes back
 * with a stale token belongs to an aborted/superseded request, so it must not
 * touch the tab any more — otherwise a cancelled request could clear the
 * loading state of the one that replaced it.
 */
const requestTokens = new Map<string, number>();

function nextRequestToken(tabId: string): number {
  const next = (requestTokens.get(tabId) ?? 0) + 1;
  requestTokens.set(tabId, next);
  return next;
}

/** Stop a tab's request when the tab goes away — no point waiting for a timeout. */
function abortInFlight(tab: Tab | undefined): void {
  if (!tab?.loading) return;
  nextRequestToken(tab.id);
  void cancelRequest(tab.id);
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  autoSaveError: string | null;
  /** Bumped after a manual save so the UI can flash a "saved" confirmation */
  savePulse: { tabId: string; at: number } | null;

  // Tab management
  newTab: () => void;
  openTab: (filePath: string, collectionPath: string) => Promise<void>;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Protocol-specific tab creation
  newGraphQLTab: () => void;
  newWebSocketTab: () => void;
  newSSETab: () => void;
  newGrpcTab: () => void;
  newMqttTab: () => void;
  newSocketIoTab: () => void;

  // GraphQL mutations
  setGraphQLQuery: (query: string) => void;
  setGraphQLVariables: (variables: string) => void;
  setGraphQLOperationName: (operationName: string) => void;
  setGraphQLSchema: (schema: string | null) => void;

  // Active tab request mutations
  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  setHeaders: (headers: KeyValuePair[]) => void;
  setParams: (params: KeyValuePair[]) => void;
  setBody: (body: RequestBody) => void;
  setAuth: (auth: AuthConfig) => void;
  setPathVariables: (pathVariables: Record<string, string>) => void;
  setPreRequestScript: (script: string | null) => void;
  setPostResponseScript: (script: string | null) => void;
  setTestScript: (script: string | null) => void;
  setAssertions: (assertions: string | null) => void;

  // Actions
  send: () => Promise<void>;
  /** Abort the in-flight request for the active tab. */
  cancel: () => Promise<void>;
  save: () => Promise<void>;
  /** Auto-save a specific tab (defaults to the active one). */
  autoSave: (tabId?: string) => Promise<void>;
  clearAutoSaveError: () => void;
  clearResponse: () => void;
  updateResponse: (tabId: string, updates: Partial<ResponseData>) => void;
  hasUnsavedNewTabs: () => boolean;

  // Undo/Redo
  undoTab: () => void;
  redoTab: () => void;

  // Conflict resolution
  handleExternalChange: (filePath: string, changeType: "modified" | "deleted") => void;
  reloadFromDisk: (tabId: string) => Promise<void>;
  dismissConflict: (tabId: string) => void;

  // Pin & duplicate
  togglePin: (id: string) => void;
  duplicateTab: (id: string) => void;

  // Detach tab to new window
  detachTab: (id: string) => Promise<void>;

  // Persistence
  persistTabs: () => void;
  restoreTabs: () => Promise<void>;
}

export function initWindowStateTracker() {
  // no-op — tracking is module-level
}

// Module-level: runs as soon as this file is imported
if (typeof window !== "undefined") {
  // Track normal geometry on resize (only when not maximized)
  window.addEventListener("resize", refreshWindowState);

  // Persist window state periodically so it survives hard kills (Ctrl+C)
  setInterval(() => {
    refreshWindowState();
    useTabStore.getState().persistTabs();
  }, 5000);
}

function updateActiveTab(
  state: TabState,
  updater: (tab: Tab) => Partial<Tab>,
): Partial<TabState> {
  if (!state.activeTabId) return {};
  return {
    tabs: state.tabs.map((t) => {
      if (t.id !== state.activeTabId) return t;
      const snapshot = takeSnapshot(t);
      const changes = updater(t);
      return {
        ...t,
        ...changes,
        isDirty: true,
        undoStack: [...t.undoStack.slice(-MAX_UNDO_DEPTH + 1), snapshot],
        redoStack: [], // Clear redo on new change
      };
    }),
  };
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  autoSaveError: null,
  savePulse: null,

  newTab: () => {
    const tab = createEmptyTab();
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
  },

  newGraphQLTab: () => {
    const tab = createEmptyTab({
      name: "Untitled GraphQL",
      protocol: "graphql",
      method: "POST",
      graphql: { query: "", variables: "{}", operationName: "", schemaJson: null },
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  newWebSocketTab: () => {
    const tab = createEmptyTab({
      name: "Untitled WebSocket",
      protocol: "websocket",
      method: "GET",
      url: "ws://localhost:8080",
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  newSSETab: () => {
    const tab = createEmptyTab({
      name: "Untitled SSE",
      protocol: "sse",
      method: "GET",
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  newGrpcTab: () => {
    const tab = createEmptyTab({
      name: "Untitled gRPC",
      protocol: "grpc",
      url: "http://localhost:50051",
      grpc: {
        services: [],
        selectedService: null,
        selectedMethod: null,
        requestJson: "{}",
        metadata: [emptyKvRow()],
        response: null,
        loading: false,
        error: null,
      },
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  newMqttTab: () => {
    const tab = createEmptyTab({
      name: "Untitled MQTT",
      protocol: "mqtt",
      url: "localhost",
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  newSocketIoTab: () => {
    const tab = createEmptyTab({
      name: "Untitled Socket.IO",
      protocol: "socketio",
      url: "http://localhost:3000",
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  openTab: async (filePath, collectionPath) => {
    // Check if already open
    const existing = get().tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    try {
      const file = await readRequestFile(filePath);
      const tab = requestFileToTab(file, filePath, collectionPath);
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      }));
    } catch (err) {
      const errStr = String((err as { message?: string })?.message ?? err);
      if (errStr.includes("MERGE_CONFLICT:")) {
        // Open a blank tab with merge-conflict state
        const tab = createEmptyTab({
          name: filePath.split("/").pop()?.replace(".yaml", "") ?? "Conflict",
          filePath,
          collectionPath,
          conflictState: "merge-conflict",
        });
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id,
        }));
      } else {
        const { useToastStore } = await import("@/stores/toast-store");
        useToastStore.getState().showError(`Failed to open request: ${String((err as { message?: string })?.message ?? err)}`);
      }
    }
  },

  closeTab: (id) => {
    // Flush a dirty file-backed tab before it disappears from the store —
    // otherwise the pending auto-save has no tab left to write.
    const closing = get().tabs.find((t) => t.id === id);
    abortInFlight(closing);
    if (
      closing?.filePath &&
      closing.isDirty &&
      useSettingsStore.getState().settings.autoSave
    ) {
      // The content snapshot is taken synchronously inside autoSave().
      void get().autoSave(id);
    }

    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === id);
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActive = state.activeTabId;
      if (state.activeTabId === id) {
        if (newTabs.length === 0) {
          newActive = null;
        } else if (idx >= newTabs.length) {
          newActive = newTabs[newTabs.length - 1].id;
        } else {
          newActive = newTabs[idx].id;
        }
      }
      return { tabs: newTabs, activeTabId: newActive };
    });
  },

  closeOtherTabs: (id) => {
    get()
      .tabs.filter((t) => t.id !== id)
      .forEach(abortInFlight);
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === id),
      activeTabId: id,
    }));
  },

  closeAllTabs: () => {
    get().tabs.forEach(abortInFlight);
    set({ tabs: [], activeTabId: null });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  reorderTabs: (fromIndex, toIndex) => {
    set((state) => {
      const newTabs = [...state.tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return { tabs: newTabs };
    });
  },

  togglePin: (id) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, pinned: !t.pinned } : t,
      ),
    }));
  },

  duplicateTab: (id) => {
    set((state) => {
      const source = state.tabs.find((t) => t.id === id);
      if (!source) return state;
      const newId = crypto.randomUUID();
      const dup: Tab = {
        ...source,
        id: newId,
        name: `${source.name} (copy)`,
        filePath: null, // duplicated tab is unsaved
        isDirty: true,
        pinned: false,
        response: null,
        error: null,
        loading: false,
        testResults: [],
        assertionResults: [],
        consoleOutput: [],
        conflictState: null,
        undoStack: [],
        redoStack: [],
      };
      const idx = state.tabs.findIndex((t) => t.id === id);
      const newTabs = [...state.tabs];
      newTabs.splice(idx + 1, 0, dup);
      return { tabs: newTabs, activeTabId: newId };
    });
  },

  // Request mutations (apply to active tab)
  setMethod: (method) => set((state) => updateActiveTab(state, () => ({ method }))),
  setUrl: (url) => set((state) => updateActiveTab(state, (tab) => {
    // Sync: extract query params from URL into the params table
    const { params: urlParams } = parseUrlParams(url);
    // Keep any empty trailing row for UX
    const emptyRow = tab.params.find((p) => !p.key.trim());
    const newParams = urlParams.length > 0
      ? [...urlParams, emptyRow || emptyKvRow()]
      : [emptyKvRow()];
    return { url, params: newParams };
  })),
  setHeaders: (headers) => set((state) => updateActiveTab(state, () => ({ headers }))),
  setParams: (params) => set((state) => updateActiveTab(state, (tab) => {
    // Sync: rebuild URL query string from params
    const baseUrl = tab.url.split("?")[0];
    const newUrl = buildUrlWithParams(baseUrl, params);
    return { params, url: newUrl };
  })),
  setPathVariables: (pathVariables) => set((state) => updateActiveTab(state, () => ({ pathVariables }))),
  setBody: (body) => set((state) => updateActiveTab(state, () => ({ body }))),
  setAuth: (auth) => set((state) => updateActiveTab(state, () => ({ auth }))),
  setPreRequestScript: (script) => set((state) => updateActiveTab(state, () => ({ preRequestScript: script }))),
  setPostResponseScript: (script) => set((state) => updateActiveTab(state, () => ({ postResponseScript: script }))),
  setTestScript: (script) => set((state) => updateActiveTab(state, () => ({ testScript: script }))),
  setAssertions: (assertions) => set((state) => updateActiveTab(state, () => ({ assertions }))),

  // GraphQL setters
  setGraphQLQuery: (query) => set((state) => updateActiveTab(state, (t) => ({
    graphql: t.graphql ? { ...t.graphql, query } : null,
  }))),
  setGraphQLVariables: (variables) => set((state) => updateActiveTab(state, (t) => ({
    graphql: t.graphql ? { ...t.graphql, variables } : null,
  }))),
  setGraphQLOperationName: (operationName) => set((state) => updateActiveTab(state, (t) => ({
    graphql: t.graphql ? { ...t.graphql, operationName } : null,
  }))),
  setGraphQLSchema: (schemaJson) => set((state) => updateActiveTab(state, (t) => ({
    graphql: t.graphql ? { ...t.graphql, schemaJson } : null,
  }))),

  send: async () => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.url.trim()) return;

    // Mark loading
    set({
      tabs: tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, loading: true, error: null, response: null, testResults: [], assertionResults: [], consoleOutput: [] }
          : t,
      ),
    });

    const token = nextRequestToken(tab.id);
    const isCurrent = () => requestTokens.get(tab.id) === token;

    // Get resolved variables from environment store
    const envStore = useEnvironmentStore.getState();
    const variables = await envStore.getResolvedVariables();

    // Get network settings
    const { settings } = useSettingsStore.getState();
    // The proxy mode always crosses the bridge so the backend knows whether to
    // go direct ("off"), use the configured proxy ("on") or let the OS decide
    // ("system").
    const proxy: ProxyConfig =
      settings.proxyMode === "on" && settings.proxyHost
        ? {
            mode: "on",
            proxyType: settings.proxyType,
            host: settings.proxyHost,
            port: settings.proxyPort ?? undefined,
            bypass: settings.proxyBypass ?? undefined,
            username: settings.proxyUsername ?? undefined,
            password: settings.proxyPassword ?? undefined,
          }
        : { mode: settings.proxyMode === "system" ? "system" : "off" };

    // Build body — for GraphQL, construct from graphql state
    let body = tab.body.type !== "none" ? tab.body : undefined;
    let headers = tab.headers.filter((h) => h.key.trim() !== "" && h.enabled);
    if (tab.protocol === "graphql" && tab.graphql) {
      const gqlBody: Record<string, unknown> = { query: tab.graphql.query };
      try {
        const vars = JSON.parse(tab.graphql.variables);
        if (Object.keys(vars).length > 0) gqlBody.variables = vars;
      } catch { /* ignore invalid JSON */ }
      if (tab.graphql.operationName) gqlBody.operationName = tab.graphql.operationName;
      body = { type: "json", content: JSON.stringify(gqlBody), formData: [] };
      // Auto-add Content-Type if not present
      if (!headers.some((h) => h.key.toLowerCase() === "content-type")) {
        headers = [{ id: kvId(), key: "Content-Type", value: "application/json", enabled: true }, ...headers];
      }
    }

    // Resolve path variables (:paramName → value) in the URL before sending
    const resolvedUrl = resolvePathVariables(tab.url, tab.pathVariables);

    const requestParams = {
      method: tab.protocol === "graphql" ? ("POST" as const) : tab.method,
      url: resolvedUrl,
      headers,
      // Params are already synced into the URL query string, so send empty
      // to avoid the Rust side double-appending them
      params: [] as KeyValuePair[],
      body,
      auth: tab.auth.type !== "none" ? tab.auth : undefined,
      proxy,
      timeoutMs: settings.timeoutMs,
      followRedirects: settings.followRedirects,
      verifySsl: settings.verifySsl,
      caCertPath: settings.caCertPath ?? undefined,
      clientCertPath: settings.clientCertPath ?? undefined,
      clientKeyPath: settings.clientKeyPath ?? undefined,
      clientCertPassphrase: settings.clientCertPassphrase ?? undefined,
    };

    const hasScripts = tab.preRequestScript || tab.postResponseScript || tab.testScript || tab.assertions;

    try {
      if (hasScripts) {
        const scriptedResponse = await sendRequestWithScripts(
          requestParams,
          variables,
          tab.collectionPath ?? undefined,
          tab.name !== "Untitled Request" ? tab.name : undefined,
          tab.preRequestScript,
          tab.postResponseScript,
          tab.testScript,
          tab.assertions,
          activeTabId ?? undefined,
        );
        // Cancelled or superseded while in flight — the token moved on.
        if (!isCurrent()) return;
        // Apply env mutations to the environment store
        if (scriptedResponse.envMutations && Object.keys(scriptedResponse.envMutations).length > 0) {
          envStore.applyMutations(scriptedResponse.envMutations);
        }
        set({
          tabs: get().tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  response: {
                    status: scriptedResponse.status,
                    statusText: scriptedResponse.statusText,
                    headers: scriptedResponse.headers,
                    cookies: scriptedResponse.cookies,
                    body: scriptedResponse.body,
                    timeMs: scriptedResponse.timeMs,
                    sizeBytes: scriptedResponse.sizeBytes,
                  },
                  testResults: scriptedResponse.testResults,
                  assertionResults: scriptedResponse.assertionResults,
                  consoleOutput: scriptedResponse.consoleOutput,
                  loading: false,
                }
              : t,
          ),
        });

        // Push script console output to global console
        const consoleFn = useConsoleStore.getState().log;
        const reqLabel = tab.name || tab.url || "Request";
        consoleFn(reqLabel, `${scriptedResponse.status} ${scriptedResponse.statusText} (${scriptedResponse.timeMs}ms)`, "info");
        for (const entry of scriptedResponse.consoleOutput) {
          const level = entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "log";
          consoleFn(reqLabel, entry.message, level);
        }
      } else {
        const response = await sendRequest(
          requestParams,
          variables,
          tab.collectionPath ?? undefined,
          tab.name !== "Untitled Request" ? tab.name : undefined,
          activeTabId ?? undefined,
        );
        if (!isCurrent()) return;
        set({
          tabs: get().tabs.map((t) =>
            t.id === activeTabId ? { ...t, response, loading: false } : t,
          ),
        });
        const reqLabel = tab.name || tab.url || "Request";
        useConsoleStore.getState().log(reqLabel, `${response.status} ${response.statusText} (${response.timeMs}ms)`, "info");
      }
    } catch (err) {
      // A cancelled/superseded request reports an error too; ignore it.
      if (!isCurrent()) return;
      const httpErr = err as HttpError;
      set({
        tabs: get().tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, error: httpErr, loading: false }
            : t,
        ),
      });
      // A user-initiated cancel is not a failure worth shouting about.
      if (httpErr?.errorType !== "cancelled") {
        const reqLabel = tab.name || tab.url || "Request";
        useConsoleStore.getState().log(reqLabel, httpErr?.message || String(err), "error");
      }
    }
  },

  cancel: async () => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab?.loading) return;

    // The backend owns the socket; it decides whether anything was still in flight.
    const cancelled = await cancelRequest(tab.id);
    if (!cancelled) return;

    // Invalidate the promise still awaiting the aborted request.
    nextRequestToken(tab.id);

    set({
      tabs: get().tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              loading: false,
              error: { errorType: "cancelled", message: "Request cancelled" },
            }
          : t,
      ),
    });
  },

  save: async () => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    // A request that has never been written to disk needs a location first
    if (!tab.filePath) {
      window.dispatchEvent(new CustomEvent("reqmate:open-save-as"));
      return;
    }

    const { useToastStore } = await import("@/stores/toast-store");
    const { default: i18n } = await import("@/lib/i18n");
    const label = tab.name?.trim() || tab.url || i18n.t("tabs.untitled");

    try {
      const requestFile = tabToRequestFile(tab);
      markRecentlySaved(tab.filePath);
      await saveRequestFile(tab.filePath, requestFile, tab.assertions);
      set({
        savePulse: { tabId: tab.id, at: Date.now() },
        tabs: get().tabs.map((t) =>
          t.id === tab.id ? { ...t, isDirty: false } : t,
        ),
      });
      useToastStore.getState().showSuccess(i18n.t("common.savedTo", { name: label }));
    } catch (err) {
      useToastStore
        .getState()
        .showError(i18n.t("common.saveFailed", { reason: String(err) }));
    }
  },

  autoSave: async (tabId) => {
    const { tabs, activeTabId } = get();
    const targetId = tabId ?? activeTabId;
    const tab = tabs.find((t) => t.id === targetId);
    if (!tab || !tab.filePath || !tab.isDirty) return;

    // Snapshot the exact object we serialise: if editing continues during the
    // IPC round-trip the tab is replaced, and it must stay dirty so the next
    // debounce writes those keystrokes too.
    const snapshot = tab;
    const filePath: string = tab.filePath;

    try {
      const requestFile = tabToRequestFile(snapshot);
      markRecentlySaved(filePath);
      await saveRequestFile(filePath, requestFile, snapshot.assertions);
      set((state) => ({
        autoSaveError: null,
        tabs: state.tabs.map((t) =>
          t.id === targetId && t === snapshot ? { ...t, isDirty: false } : t,
        ),
      }));
    } catch (err) {
      set({ autoSaveError: String(err) });
    }
  },

  clearAutoSaveError: () => {
    set({ autoSaveError: null });
  },

  hasUnsavedNewTabs: () => {
    return get().tabs.some(
      (t) =>
        // Never-saved requests, plus anything still dirty: auto-save can be
        // off, failing, or mid-flight, so dirty always means "not on disk".
        (!t.filePath && (t.url.trim() || t.body.content.trim())) || t.isDirty,
    );
  },

  clearResponse: () => {
    set((state) => updateActiveTab(state, () => ({ response: null, error: null })));
  },

  updateResponse: (tabId: string, updates: Partial<ResponseData>) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId && t.response
          ? { ...t, response: { ...t.response, ...updates } }
          : t
      ),
    }));
  },

  undoTab: () => {
    set((state) => {
      if (!state.activeTabId) return {};
      return {
        tabs: state.tabs.map((t) => {
          if (t.id !== state.activeTabId || t.undoStack.length === 0) return t;
          const snapshot = t.undoStack[t.undoStack.length - 1];
          const currentSnapshot = takeSnapshot(t);
          return {
            ...t,
            ...snapshot,
            undoStack: t.undoStack.slice(0, -1),
            redoStack: [...t.redoStack, currentSnapshot],
          };
        }),
      };
    });
  },

  redoTab: () => {
    set((state) => {
      if (!state.activeTabId) return {};
      return {
        tabs: state.tabs.map((t) => {
          if (t.id !== state.activeTabId || t.redoStack.length === 0) return t;
          const snapshot = t.redoStack[t.redoStack.length - 1];
          const currentSnapshot = takeSnapshot(t);
          return {
            ...t,
            ...snapshot,
            redoStack: t.redoStack.slice(0, -1),
            undoStack: [...t.undoStack, currentSnapshot],
          };
        }),
      };
    });
  },

  handleExternalChange: (filePath, changeType) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.filePath !== filePath) return t;
        if (changeType === "deleted") {
          return { ...t, conflictState: "deleted" as const };
        }
        // Modified externally — if tab is dirty, show conflict; if clean, auto-reload
        if (t.isDirty) {
          return { ...t, conflictState: "external-change" as const };
        }
        // Clean tab: auto-reload will be handled by the caller
        return t;
      }),
    }));
  },

  reloadFromDisk: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.filePath || !tab.collectionPath) return;
    try {
      const file = await readRequestFile(tab.filePath);
      const reloaded = requestFileToTab(file, tab.filePath, tab.collectionPath);
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...reloaded, id: t.id, conflictState: null }
            : t,
        ),
      }));
    } catch {
      // File may no longer exist
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, conflictState: "deleted" as const } : t,
        ),
      }));
    }
  },

  dismissConflict: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, conflictState: null } : t,
      ),
    }));
  },

  detachTab: async (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab || !tab.filePath) return;

    try {
      const { openNewWindow } = await import("@/lib/tauri-api");
      await openNewWindow();
      // Close the tab in the current window — the new window will load its own state
      get().closeTab(id);
    } catch {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError("Failed to open new window. Please try again.")
      );
    }
  },

  persistTabs: () => {
    const { tabs, activeTabId } = get();
    // Only persist file-backed tabs (exclude ephemeral WS/SSE tabs), deduplicated
    const seen = new Set<string>();
    const persistedTabs = tabs
      .filter((t) => {
        if (!t.filePath || !t.collectionPath || t.protocol === "websocket" || t.protocol === "sse" || t.protocol === "grpc") return false;
        if (seen.has(t.filePath)) return false;
        seen.add(t.filePath);
        return true;
      })
      .map((t) => ({ filePath: t.filePath!, collectionPath: t.collectionPath! }));
    // The active tab has to be located inside `persistedTabs`: it is filtered
    // (ephemeral WS/SSE/gRPC tabs and duplicates are dropped), so an index
    // taken from `tabs` points at a different entry after a restart.
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const activeTabPath =
      activeTab?.filePath && persistedTabs.some((p) => p.filePath === activeTab.filePath)
        ? activeTab.filePath
        : null;
    const activeIndex = activeTabPath
      ? persistedTabs.findIndex((p) => p.filePath === activeTabPath)
      : -1;

    // Capture window position/size — use normal (non-maximized) geometry
    // so restoring from maximized doesn't span multiple monitors
    const windowState = {
      ...getPersistableGeometry(),
      maximized: isMaximizedCached(),
    };

    // Persist all opened collection paths (not just those with open tabs)
    import("@/stores/collection-store").then(({ useCollectionStore }) => {
      const collections = useCollectionStore.getState().collections
        .filter((c) => c.type === "collection")
        .map((c) => c.path);

      savePersistedState({
        tabs: persistedTabs,
        activeTabIndex: activeIndex >= 0 ? activeIndex : null,
        activeTabPath,
        windowState,
        collections,
      }).catch(() => { /* Tab persistence failure is non-critical */ });
    }).catch(() => {
      // Fallback: save without collections if store not available
      savePersistedState({
        tabs: persistedTabs,
        activeTabIndex: activeIndex >= 0 ? activeIndex : null,
        activeTabPath,
        windowState,
      }).catch(() => {});
    });
  },

  restoreTabs: async () => {
    try {
      const persisted = await loadPersistedState();

      const collectionPaths = new Set<string>();

      // Restore persisted collections first (even if no tabs are open)
      if (persisted.collections?.length) {
        for (const path of persisted.collections) {
          collectionPaths.add(path);
        }
      }

      if (persisted.tabs.length === 0) {
        // No tabs to restore, but still re-open collections
        if (collectionPaths.size > 0) {
          import("@/stores/collection-store").then(({ useCollectionStore }) => {
            for (const path of collectionPaths) {
              // Restored collections start collapsed — the tree only opens on demand.
              useCollectionStore.getState().openCollection(path, { expand: false }).catch(() => {});
            }
          });
        }
        return;
      }
      const seenPaths = new Set<string>();
      // Tabs that actually made it back, in restore order.
      const restored: { filePath: string; tabId: string }[] = [];

      for (const pt of persisted.tabs) {
        // Deduplicate — only restore one tab per file path
        if (seenPaths.has(pt.filePath)) continue;
        seenPaths.add(pt.filePath);

        try {
          const file = await readRequestFile(pt.filePath);
          const tab = requestFileToTab(file, pt.filePath, pt.collectionPath);
          set((state) => ({
            tabs: [...state.tabs, tab],
            activeTabId: state.activeTabId ?? tab.id,
          }));
          restored.push({ filePath: pt.filePath, tabId: tab.id });
          if (pt.collectionPath) collectionPaths.add(pt.collectionPath);
        } catch {
          // File may have been deleted, skip it
          // Still try to restore the collection sidebar
          if (pt.collectionPath) collectionPaths.add(pt.collectionPath);
        }
      }

      // Prefer the persisted path — it still resolves when an earlier tab in
      // the list could not be restored. Fall back to the index for state files
      // written by older builds.
      const byPath = persisted.activeTabPath
        ? restored.find((r) => r.filePath === persisted.activeTabPath)
        : undefined;
      const byIndex =
        persisted.activeTabIndex != null
          ? restored[persisted.activeTabIndex]
          : undefined;
      const activeTabId = (byPath ?? byIndex)?.tabId;
      if (activeTabId) set({ activeTabId });

      // Re-open collections in the sidebar (persisted collections were
      // already added above; this also includes any from open tabs).
      if (collectionPaths.size > 0) {
        import("@/stores/collection-store").then(({ useCollectionStore }) => {
          for (const path of collectionPaths) {
            useCollectionStore.getState().openCollection(path, { expand: false }).catch(() => {});
          }
        });
      }
    } catch {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showWarning("Some tabs could not be restored from your last session.")
      );
    }
  },
}));

// Selectors
export const useActiveTab = () => {
  return useTabStore((state) =>
    state.tabs.find((t) => t.id === state.activeTabId) ?? null
  );
};
