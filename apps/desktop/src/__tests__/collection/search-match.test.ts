import { describe, expect, it } from "vitest";
import type { CollectionNode } from "@reqmate/types";
import { nodeMatchesSearch } from "@/lib/collection-search";

const request = (name: string, parent = "/c"): CollectionNode => ({
  type: "request",
  name,
  method: "GET",
  path: `${parent}/${name}.yaml`,
});

const folder = (name: string, children: CollectionNode[] = []): CollectionNode => ({
  type: "folder",
  name,
  path: `/c/${name}`,
  children,
});

const collection = (children: CollectionNode[]): CollectionNode => ({
  type: "collection",
  name: "demo-api",
  path: "/c",
  children,
});

/**
 * `nodeMatchesSearch` decides whether a collapsed collection is kept in the
 * sidebar while a query is active. If it fails to look into descendants, a hit
 * inside a folded folder silently disappears from the results.
 */
describe("nodeMatchesSearch", () => {
  const tree = collection([
    folder("auth", [request("login", "/c/auth"), request("logout", "/c/auth")]),
    folder("users", [folder("admin", [request("ban-user", "/c/users/admin")])]),
    request("ping"),
  ]);

  it("keeps everything visible when the query is empty", () => {
    expect(nodeMatchesSearch(tree, "")).toBe(true);
  });

  it("matches the node's own name", () => {
    expect(nodeMatchesSearch(tree, "ping")).toBe(true);
    expect(nodeMatchesSearch(tree, "auth")).toBe(true);
  });

  it("matches requests nested several folders deep", () => {
    expect(nodeMatchesSearch(tree, "ban")).toBe(true);
    expect(nodeMatchesSearch(tree, "logout")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(nodeMatchesSearch(tree, "PING")).toBe(true);
    expect(nodeMatchesSearch(tree, "DEMO")).toBe(true);
  });

  it("reports no match when nothing in the subtree matches", () => {
    expect(nodeMatchesSearch(tree, "zzz")).toBe(false);
  });

  it("does not look for children under a request leaf", () => {
    // Requests carry no children, so a sibling-only match must not leak in.
    expect(nodeMatchesSearch(request("login"), "logout")).toBe(false);
  });
});
