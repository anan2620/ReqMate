import { describe, it, expect, beforeEach } from "vitest";
import { useRightPanelStore } from "@/stores/right-panel-store";

describe("Right Panel Store", () => {
  beforeEach(() => {
    useRightPanelStore.setState({ kind: null });
  });

  it("starts closed", () => {
    expect(useRightPanelStore.getState().kind).toBeNull();
  });

  it("opens a panel", () => {
    useRightPanelStore.getState().open("mock");
    expect(useRightPanelStore.getState().kind).toBe("mock");
  });

  it("switching tools replaces the docked panel", () => {
    useRightPanelStore.getState().open("mock");
    useRightPanelStore.getState().open("monitor");
    expect(useRightPanelStore.getState().kind).toBe("monitor");
  });

  it("toggles the same tool closed and open", () => {
    useRightPanelStore.getState().toggle("monitor");
    expect(useRightPanelStore.getState().kind).toBe("monitor");
    useRightPanelStore.getState().toggle("monitor");
    expect(useRightPanelStore.getState().kind).toBeNull();
  });

  it("toggle switches when another tool is docked", () => {
    useRightPanelStore.getState().open("mock");
    useRightPanelStore.getState().toggle("monitor");
    expect(useRightPanelStore.getState().kind).toBe("monitor");
  });

  it("closes", () => {
    useRightPanelStore.getState().open("mock");
    useRightPanelStore.getState().close();
    expect(useRightPanelStore.getState().kind).toBeNull();
  });
});
