import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AppSettings } from "@reqmate/types";
import { useSettingsStore, __resetSettingsWriteQueue } from "@/stores/settings-store";
import { updateSettings as updateSettingsApi } from "@/lib/tauri-api";

vi.mock("@/lib/tauri-api", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(async (patch: Record<string, unknown>) => patch),
}));

const mockedUpdate = vi.mocked(updateSettingsApi);

describe("Settings Store", () => {
  beforeEach(() => {
    __resetSettingsWriteQueue();
    mockedUpdate.mockClear();
    useSettingsStore.setState({ loaded: false });
  });

  it("applies a patch immediately instead of waiting for the IPC round-trip", () => {
    useSettingsStore.getState().updateSettings({ timeoutMs: 1234 });
    expect(useSettingsStore.getState().settings.timeoutMs).toBe(1234);
    // Nothing written yet — the write is debounced.
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("coalesces rapid keystrokes into a single write with the last value", async () => {
    const { updateSettings } = useSettingsStore.getState();
    updateSettings({ proxyHost: "h" });
    updateSettings({ proxyHost: "ho" });
    updateSettings({ proxyHost: "host" });

    await useSettingsStore.getState().flushSettings();

    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    expect(mockedUpdate).toHaveBeenCalledWith({ proxyHost: "host" });
    expect(useSettingsStore.getState().settings.proxyHost).toBe("host");
  });

  it("does not let a stale response revert newer input", async () => {
    let resolveFirst: (value: AppSettings) => void = () => {};
    mockedUpdate.mockImplementationOnce(
      () => new Promise<AppSettings>((resolve) => {
        resolveFirst = resolve;
      }),
    );

    useSettingsStore.getState().updateSettings({ aiModel: "first" });
    const inFlight = useSettingsStore.getState().flushSettings();

    // The user keeps typing while the first write is in flight.
    useSettingsStore.getState().updateSettings({ aiModel: "second" });

    resolveFirst({ ...useSettingsStore.getState().settings, aiModel: "first" });
    await inFlight;

    expect(useSettingsStore.getState().settings.aiModel).toBe("second");
  });

  it("flushSettings is a no-op when nothing is queued", async () => {
    await useSettingsStore.getState().flushSettings();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});
