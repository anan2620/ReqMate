import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCollectionStore } from "@/stores/collection-store";

// vi.mock factories are hoisted, so the fixture has to be hoisted with them.
const { tree } = vi.hoisted(() => ({
  tree: {
    type: "collection" as const,
    name: "Acme",
    path: "/mock/Acme",
    children: [
      { type: "request" as const, name: "List", method: "GET" as const, path: "/mock/Acme/list.json" },
    ],
  },
}));

vi.mock("@/lib/tauri-api", () => ({
  openCollection: vi.fn().mockResolvedValue(tree),
  createRequest: vi.fn(),
  createFolder: vi.fn(),
  deleteItem: vi.fn(),
  renameItem: vi.fn(),
  watchCollection: vi.fn().mockResolvedValue(undefined),
  unwatchCollection: vi.fn().mockResolvedValue(undefined),
  restoreFromTrash: vi.fn(),
  checkCollectionVersion: vi.fn().mockResolvedValue({
    collectionVersion: 1,
    currentVersion: 1,
    needsMigration: false,
    isNewer: false,
  }),
  migrateCollection: vi.fn(),
}));

describe("Collection Store expansion", () => {
  beforeEach(() => {
    useCollectionStore.setState({
      collections: [],
      expandedPaths: new Set<string>(),
      readOnlyPaths: new Set<string>(),
      migrationPrompt: null,
    });
  });

  it("keeps a restored collection collapsed when expand is false", async () => {
    await useCollectionStore.getState().openCollection("/mock/Acme", { expand: false });
    const state = useCollectionStore.getState();
    expect(state.collections).toHaveLength(1);
    expect(state.expandedPaths.has("/mock/Acme")).toBe(false);
  });

  it("expands a collection opened from an explicit user action", async () => {
    await useCollectionStore.getState().openCollection("/mock/Acme");
    expect(useCollectionStore.getState().expandedPaths.has("/mock/Acme")).toBe(true);
  });

  it("re-expands an already open collection only when asked", async () => {
    await useCollectionStore.getState().openCollection("/mock/Acme", { expand: false });
    // Plain re-open (e.g. startup restore running twice) must not force it open
    await useCollectionStore.getState().openCollection("/mock/Acme", { expand: false });
    expect(useCollectionStore.getState().expandedPaths.has("/mock/Acme")).toBe(false);

    await useCollectionStore.getState().openCollection("/mock/Acme");
    expect(useCollectionStore.getState().expandedPaths.has("/mock/Acme")).toBe(true);
  });

  it("toggles expansion on demand", async () => {
    await useCollectionStore.getState().openCollection("/mock/Acme");
    useCollectionStore.getState().toggleExpand("/mock/Acme");
    expect(useCollectionStore.getState().expandedPaths.has("/mock/Acme")).toBe(false);
    useCollectionStore.getState().toggleExpand("/mock/Acme");
    expect(useCollectionStore.getState().expandedPaths.has("/mock/Acme")).toBe(true);
  });
});
