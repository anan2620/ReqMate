import { describe, it, expect } from "vitest";
import { extractPathVariables, resolvePathVariables } from "@/lib/url";

describe("extractPathVariables", () => {
  it("ignores the port when the URL has no path variables", () => {
    expect(extractPathVariables("http://10.0.108.8:31017/extract")).toEqual([]);
    expect(extractPathVariables("http://localhost:8080")).toEqual([]);
    expect(extractPathVariables("https://api.reqmate.dev:8443/v1/users")).toEqual([]);
  });

  it("picks up :name segments in the path", () => {
    expect(extractPathVariables("https://api.reqmate.dev/v1/users/:id")).toEqual(["id"]);
    expect(extractPathVariables("http://localhost:3000/users/:userId/posts/:postId")).toEqual([
      "userId",
      "postId",
    ]);
  });

  it("works when the host or scheme is templated", () => {
    expect(extractPathVariables("{{baseUrl}}/users/:id")).toEqual(["id"]);
    expect(extractPathVariables("https://{{host}}:8080/items/:itemId")).toEqual(["itemId"]);
  });

  it("ignores :name inside the query string and fragment", () => {
    expect(extractPathVariables("https://host/v1/users/:id?at=:time#/x/:y")).toEqual(["id"]);
    expect(extractPathVariables("https://host/search?q=:query")).toEqual([]);
  });

  it("requires the name to start with a letter and sit on a segment boundary", () => {
    expect(extractPathVariables("https://host/a:1234/b")).toEqual([]);
    expect(extractPathVariables("https://host/v1/orders/:order-id")).toEqual(["order-id"]);
    expect(extractPathVariables("https://host/v1/orders/prefix:id")).toEqual([]);
  });

  it("deduplicates repeated variables", () => {
    expect(extractPathVariables("https://host/:id/children/:id")).toEqual(["id"]);
  });
});

describe("resolvePathVariables", () => {
  it("substitutes whole :name segments", () => {
    expect(resolvePathVariables("https://host/v1/users/:id", { id: "42" })).toBe(
      "https://host/v1/users/42",
    );
    expect(
      resolvePathVariables("https://host/:a/items/:b?x=1", { a: "users", b: "7" }),
    ).toBe("https://host/users/items/7?x=1");
  });

  it("never rewrites the port, even with a stale key", () => {
    expect(resolvePathVariables("http://10.0.108.8:31017/extract", { "31017": "x" })).toBe(
      "http://10.0.108.8:31017/extract",
    );
    expect(resolvePathVariables("http://host:8080/:id", { id: "1", "8080": "x" })).toBe(
      "http://host:8080/1",
    );
  });

  it("ignores empty values and encodes the substitution", () => {
    expect(resolvePathVariables("https://host/:id", { id: "" })).toBe("https://host/:id");
    expect(resolvePathVariables("https://host/:q", { q: "a b/c" })).toBe(
      "https://host/a%20b%2Fc",
    );
  });
});
