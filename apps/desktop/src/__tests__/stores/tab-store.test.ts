import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/tauri-api", () => ({
  sendRequest: vi.fn().mockResolvedValue({}),
  sendRequestWithScripts: vi.fn().mockResolvedValue({}),
  cancelRequest: vi.fn().mockResolvedValue(false),
  readRequestFile: vi.fn().mockResolvedValue({}),
  saveRequestFile: vi.fn().mockResolvedValue(undefined),
  loadPersistedState: vi.fn().mockResolvedValue({ tabs: [], activeTabId: null }),
  savePersistedState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/stores/environment-store", () => ({
  useEnvironmentStore: { getState: () => ({ getResolvedVariables: vi.fn().mockResolvedValue({}) }) },
}));

vi.mock("@/stores/settings-store", () => ({
  useSettingsStore: { getState: () => ({ settings: {} }) },
}));

vi.mock("@/stores/console-store", () => ({
  useConsoleStore: { getState: () => ({ log: vi.fn() }) },
}));

import * as api from "@/lib/tauri-api";
import { useTabStore } from "@/stores/tab-store";

describe("Tab Store", () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
    });
  });

  it("creates a new HTTP tab", () => {
    useTabStore.getState().newTab();
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].protocol).toBe("http");
    expect(state.tabs[0].method).toBe("GET");
    expect(state.tabs[0].name).toBe("Untitled Request");
    expect(state.activeTabId).toBe(state.tabs[0].id);
  });

  it("cancels the in-flight request of the active tab", async () => {
    useTabStore.getState().newTab();
    const id = useTabStore.getState().activeTabId!;
    useTabStore.setState({
      tabs: useTabStore.getState().tabs.map((t) => (t.id === id ? { ...t, loading: true } : t)),
    });
    vi.mocked(api.cancelRequest).mockResolvedValueOnce(true);

    await useTabStore.getState().cancel();

    const tab = useTabStore.getState().tabs[0];
    expect(api.cancelRequest).toHaveBeenCalledWith(id);
    expect(tab.loading).toBe(false);
    expect(tab.error?.errorType).toBe("cancelled");
  });

  it("keeps loading when the request already settled", async () => {
    useTabStore.getState().newTab();
    const id = useTabStore.getState().activeTabId!;
    useTabStore.setState({
      tabs: useTabStore.getState().tabs.map((t) => (t.id === id ? { ...t, loading: true } : t)),
    });
    vi.mocked(api.cancelRequest).mockResolvedValueOnce(false);

    await useTabStore.getState().cancel();

    const tab = useTabStore.getState().tabs[0];
    expect(tab.loading).toBe(true);
    expect(tab.error).toBeNull();
  });

  it("ignores a response that lands after the request was cancelled", async () => {
    let release: () => void = () => {};
    vi.mocked(api.sendRequest).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              status: 200,
              statusText: "OK",
              body: "late",
              headers: [],
              cookies: [],
              timeMs: 1,
              sizeBytes: 1,
            });
        }),
    );
    vi.mocked(api.cancelRequest).mockResolvedValueOnce(true);

    useTabStore.getState().newTab();
    useTabStore.getState().setUrl("https://api.test/slow");
    const pending = useTabStore.getState().send();

    // Wait until the request actually reached the bridge.
    await vi.waitFor(() => expect(api.sendRequest).toHaveBeenCalled());
    await useTabStore.getState().cancel();

    release();
    await pending;

    const tab = useTabStore.getState().tabs[0];
    expect(tab.response).toBeNull();
    expect(tab.error?.errorType).toBe("cancelled");
    expect(tab.loading).toBe(false);
  });

  it("does nothing when no request is loading", async () => {
    useTabStore.getState().newTab();
    vi.mocked(api.cancelRequest).mockClear();

    await useTabStore.getState().cancel();

    expect(api.cancelRequest).not.toHaveBeenCalled();
  });

  it("creates a new WebSocket tab", () => {
    useTabStore.getState().newWebSocketTab();
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].protocol).toBe("websocket");
    expect(state.tabs[0].name).toBe("Untitled WebSocket");
  });

  it("creates a new GraphQL tab", () => {
    useTabStore.getState().newGraphQLTab();
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].protocol).toBe("graphql");
    expect(state.tabs[0].graphql).not.toBeNull();
  });

  it("creates a new gRPC tab", () => {
    useTabStore.getState().newGrpcTab();
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].protocol).toBe("grpc");
    expect(state.tabs[0].grpc).not.toBeNull();
  });

  it("creates a new MQTT tab", () => {
    useTabStore.getState().newMqttTab();
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].protocol).toBe("mqtt");
  });

  it("creates a new Socket.IO tab", () => {
    useTabStore.getState().newSocketIoTab();
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].protocol).toBe("socketio");
  });

  it("closes a tab", () => {
    useTabStore.getState().newTab();
    useTabStore.getState().newTab();
    const firstId = useTabStore.getState().tabs[0].id;
    expect(useTabStore.getState().tabs).toHaveLength(2);

    useTabStore.getState().closeTab(firstId);
    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(useTabStore.getState().tabs[0].id).not.toBe(firstId);
  });

  it("sets active tab", () => {
    useTabStore.getState().newTab();
    useTabStore.getState().newTab();
    const tabs = useTabStore.getState().tabs;

    useTabStore.getState().setActiveTab(tabs[0].id);
    expect(useTabStore.getState().activeTabId).toBe(tabs[0].id);

    useTabStore.getState().setActiveTab(tabs[1].id);
    expect(useTabStore.getState().activeTabId).toBe(tabs[1].id);
  });

  it("updates method on active tab", () => {
    useTabStore.getState().newTab();
    useTabStore.getState().setMethod("POST");
    expect(useTabStore.getState().tabs[0].method).toBe("POST");
  });

  it("updates URL on active tab", () => {
    useTabStore.getState().newTab();
    useTabStore.getState().setUrl("https://api.example.com/users");
    expect(useTabStore.getState().tabs[0].url).toBe("https://api.example.com/users");
  });

  it("marks tab as dirty after changes", () => {
    useTabStore.getState().newTab();
    expect(useTabStore.getState().tabs[0].isDirty).toBe(false);

    useTabStore.getState().setUrl("https://changed.com");
    expect(useTabStore.getState().tabs[0].isDirty).toBe(true);
  });

  it("supports undo/redo", () => {
    useTabStore.getState().newTab();
    useTabStore.getState().setUrl("https://first.com");
    useTabStore.getState().setUrl("https://second.com");
    expect(useTabStore.getState().tabs[0].url).toBe("https://second.com");

    useTabStore.getState().undoTab();
    expect(useTabStore.getState().tabs[0].url).toBe("https://first.com");

    useTabStore.getState().redoTab();
    expect(useTabStore.getState().tabs[0].url).toBe("https://second.com");
  });

  it("toggles pin on tab", () => {
    useTabStore.getState().newTab();
    const tabId = useTabStore.getState().tabs[0].id;
    expect(useTabStore.getState().tabs[0].pinned).toBe(false);

    useTabStore.getState().togglePin(tabId);
    expect(useTabStore.getState().tabs[0].pinned).toBe(true);

    useTabStore.getState().togglePin(tabId);
    expect(useTabStore.getState().tabs[0].pinned).toBe(false);
  });

  it("duplicates a tab", () => {
    useTabStore.getState().newTab();
    useTabStore.getState().setUrl("https://dup.test");
    const tabId = useTabStore.getState().tabs[0].id;

    useTabStore.getState().duplicateTab(tabId);
    const tabs = useTabStore.getState().tabs;
    expect(tabs).toHaveLength(2);
    expect(tabs[1].url).toBe("https://dup.test");
    expect(tabs[1].id).not.toBe(tabs[0].id);
  });

  it("closes other tabs", () => {
    useTabStore.getState().newTab();
    useTabStore.getState().newTab();
    useTabStore.getState().newTab();
    const keepId = useTabStore.getState().tabs[1].id;

    useTabStore.getState().closeOtherTabs(keepId);
    const tabs = useTabStore.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe(keepId);
  });

  it("closes all tabs", () => {
    useTabStore.getState().newTab();
    useTabStore.getState().newTab();

    useTabStore.getState().closeAllTabs();
    expect(useTabStore.getState().tabs).toHaveLength(0);
    expect(useTabStore.getState().activeTabId).toBeNull();
  });
});
