import { describe, expect, it } from "vitest";
import type { CollectionNode } from "@reqmate/types";
import { reorderSiblingKeys } from "@/lib/collection-order";

const folder = (name: string): CollectionNode => ({
  type: "folder",
  name,
  path: `/c/${name}`,
  children: [],
});

const request = (stem: string): CollectionNode => ({
  type: "request",
  name: stem,
  method: "GET",
  path: `/c/${stem}.yaml`,
});

const siblings: CollectionNode[] = [
  folder("auth"),
  folder("users"),
  request("create-user"),
  request("list-users"),
  request("ping"),
];

describe("reorderSiblingKeys", () => {
  it("moves a request down past its neighbour", () => {
    // list-users → ping
    expect(
      reorderSiblingKeys(siblings, "/c/list-users.yaml", "/c/ping.yaml"),
    ).toEqual(["auth", "users", "create-user", "ping", "list-users"]);
  });

  it("moves a request up past its neighbour", () => {
    // ping → create-user
    expect(
      reorderSiblingKeys(siblings, "/c/ping.yaml", "/c/create-user.yaml"),
    ).toEqual(["auth", "users", "ping", "create-user", "list-users"]);
  });

  it("keeps every sibling in the vector so nothing falls back to alphabetical", () => {
    const order = reorderSiblingKeys(
      siblings,
      "/c/create-user.yaml",
      "/c/list-users.yaml",
    );
    expect(order).toHaveLength(siblings.length);
    expect(new Set(order)).toEqual(
      new Set(["auth", "users", "create-user", "list-users", "ping"]),
    );
  });

  it("reorders folders without touching the request block", () => {
    expect(
      reorderSiblingKeys(siblings, "/c/users", "/c/auth"),
    ).toEqual(["users", "auth", "create-user", "list-users", "ping"]);
  });

  it("refuses a folder↔request drop, which has no representable position", () => {
    expect(reorderSiblingKeys(siblings, "/c/auth", "/c/ping.yaml")).toBeNull();
  });

  it("ignores drops onto itself or onto a node from another folder", () => {
    expect(reorderSiblingKeys(siblings, "/c/auth", "/c/auth")).toBeNull();
    expect(reorderSiblingKeys(siblings, "/c/auth", "/other/ping.yaml")).toBeNull();
  });
});
