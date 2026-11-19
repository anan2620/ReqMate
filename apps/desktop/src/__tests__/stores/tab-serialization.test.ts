import { describe, it, expect } from "vitest";
import {
  buildUrlWithParams,
  parseUrlParams,
  requestFileToTab,
  tabToRequestFile,
} from "@/stores/tab/tab-serialization";
import { createEmptyTab } from "@/stores/tab/tab-model";
import type { RequestFile } from "@reqmate/types";

describe("tab model", () => {
  it("creates an empty HTTP tab with one header and one param row", () => {
    const tab = createEmptyTab();

    expect(tab.protocol).toBe("http");
    expect(tab.method).toBe("GET");
    expect(tab.headers).toHaveLength(1);
    expect(tab.params).toHaveLength(1);
    expect(tab.body).toEqual({ type: "none", content: "", formData: [] });
    expect(tab.auth).toEqual({ type: "none" });
    expect(tab.undoStack).toEqual([]);
  });

  it("gives every tab a unique id and applies overrides", () => {
    const a = createEmptyTab();
    const b = createEmptyTab({ name: "Second" });

    expect(a.id).not.toBe(b.id);
    expect(b.name).toBe("Second");
  });
});

describe("URL ↔ params synchronisation", () => {
  it("splits query params out of the URL", () => {
    const { baseUrl, params } = parseUrlParams("https://api.test/users?page=2&q=a%20b");

    expect(baseUrl).toBe("https://api.test/users");
    expect(params.map((p) => [p.key, p.value])).toEqual([
      ["page", "2"],
      ["q", "a b"],
    ]);
  });

  it("keeps the URL untouched when there is no query string", () => {
    const { baseUrl, params } = parseUrlParams("https://api.test/users");
    expect(baseUrl).toBe("https://api.test/users");
    expect(params).toEqual([]);
  });

  it("rebuilds the query string from enabled, non-empty params", () => {
    const url = buildUrlWithParams("https://api.test/users", [
      { id: "1", key: "page", value: "2", enabled: true },
      { id: "2", key: "skip", value: "x", enabled: false },
      { id: "3", key: "", value: "ignored", enabled: true },
    ]);

    expect(url).toBe("https://api.test/users?page=2");
  });

  it("drops the query string entirely when no param is enabled", () => {
    const url = buildUrlWithParams("https://api.test/users", [
      { id: "1", key: "page", value: "2", enabled: false },
    ]);
    expect(url).toBe("https://api.test/users");
  });

  it("round-trips a URL through params", () => {
    const original = "https://api.test/users?page=2&limit=10";
    const { baseUrl, params } = parseUrlParams(original);
    expect(buildUrlWithParams(baseUrl, params)).toBe(original);
  });
});

describe("request file ↔ tab conversion", () => {
  const file: RequestFile = {
    name: "Get user",
    method: "GET",
    url: "https://api.test/users/:id?expand=roles",
    headers: { Accept: "application/json" },
    params: { id: "42" },
    auth: { type: "bearer", token: "{{token}}" },
    body: { type: "none", content: "" },
  };

  it("turns a request file into a tab", () => {
    const tab = requestFileToTab(file, "/c/users/get.yaml", "/c");

    expect(tab.name).toBe("Get user");
    expect(tab.filePath).toBe("/c/users/get.yaml");
    expect(tab.collectionPath).toBe("/c");
    expect(tab.isDirty).toBe(false);
    expect(tab.headers.some((h) => h.key === "Accept")).toBe(true);
    // `id` matches a :id placeholder, so it becomes a path variable, not a query param
    expect(tab.pathVariables).toEqual({ id: "42" });
    expect(tab.params.some((p) => p.key === "expand")).toBe(true);
    expect(tab.auth).toEqual({ type: "bearer", token: "{{token}}" });
  });

  it("turns a tab back into a request file", () => {
    const tab = requestFileToTab(file, "/c/users/get.yaml", "/c");
    const out = tabToRequestFile(tab);

    expect(out.name).toBe("Get user");
    expect(out.method).toBe("GET");
    expect(out.url).toBe(file.url);
    expect(out.headers).toEqual({ Accept: "application/json" });
    expect(out.params).toEqual({ id: "42" });
    expect(out.auth).toEqual({ type: "bearer", token: "{{token}}" });
  });

  it("omits empty optional fields when saving", () => {
    const tab = createEmptyTab({ name: "Blank", url: "https://api.test" });
    const out = tabToRequestFile(tab);

    expect(out.auth).toBeUndefined();
    expect(out.body).toBeUndefined();
    expect(out.preRequestScript).toBeUndefined();
    expect(out.tests).toBeUndefined();
  });

  it("serialises GraphQL state into a JSON body so it reloads as GraphQL", () => {
    const tab = createEmptyTab({
      name: "Query",
      protocol: "graphql",
      url: "https://api.test/graphql",
      graphql: {
        query: "{ me { id } }",
        variables: '{"a":1}',
        operationName: "Me",
        schemaJson: null,
      },
    });

    const out = tabToRequestFile(tab);
    expect(out.protocol).toBe("graphql");
    expect(out.method).toBe("POST");
    expect(out.headers?.["Content-Type"]).toBe("application/json");

    const body = JSON.parse(out.body!.content);
    expect(body.query).toBe("{ me { id } }");
    expect(body.variables).toEqual({ a: 1 });
    expect(body.operationName).toBe("Me");

    const reloaded = requestFileToTab(
      { ...out, name: "Query" },
      "/c/query.yaml",
      "/c",
    );
    expect(reloaded.protocol).toBe("graphql");
    expect(reloaded.graphql?.query).toBe("{ me { id } }");
  });

  it("ignores invalid GraphQL variables JSON when saving", () => {
    const tab = createEmptyTab({
      protocol: "graphql",
      url: "https://api.test/graphql",
      graphql: { query: "{ a }", variables: "not json", operationName: "", schemaJson: null },
    });

    const body = JSON.parse(tabToRequestFile(tab).body!.content);
    expect(body.query).toBe("{ a }");
    expect(body.variables).toBeUndefined();
  });
});

describe("request file round-trip fidelity", () => {
  it("keeps urlencoded and form-data rows through a save/reload cycle", () => {
    for (const type of ["urlencoded", "form-data"] as const) {
      const tab = createEmptyTab({ name: "Form", url: "https://api.test/form" });
      tab.body = {
        type,
        content: "",
        formData: [
          { id: "1", key: "name", value: "ada", enabled: true },
          { id: "2", key: "role", value: "admin", enabled: false },
        ],
      };

      const saved = tabToRequestFile(tab);
      expect(saved.body?.formData?.map((kv) => [kv.key, kv.value])).toEqual([
        ["name", "ada"],
        ["role", "admin"],
      ]);

      const reloaded = requestFileToTab(
        { ...saved, name: "Form" },
        "/c/form.yaml",
        "/c",
      );
      expect(reloaded.body.type).toBe(type);
      expect(reloaded.body.formData.map((kv) => [kv.key, kv.value])).toEqual([
        ["name", "ada"],
        ["role", "admin"],
      ]);
    }
  });

  it("parses legacy urlencoded bodies that only have a content string", () => {
    const tab = requestFileToTab(
      {
        name: "Legacy",
        method: "POST",
        url: "https://api.test/form",
        headers: {},
        body: { type: "urlencoded", content: "a=1&b=hello+world" },
      },
      "/c/legacy.yaml",
      "/c",
    );

    expect(tab.body.formData.map((kv) => [kv.key, kv.value])).toEqual([
      ["a", "1"],
      ["b", "hello world"],
    ]);
  });

  it("echoes description and cookies back on save instead of dropping them", () => {
    const tab = requestFileToTab(
      {
        name: "User",
        method: "GET",
        url: "https://api.test/user",
        headers: {},
        description: "Fetches the current user",
        cookies: { session: "abc" },
      },
      "/c/user.yaml",
      "/c",
    );

    const saved = tabToRequestFile(tab);
    expect(saved.description).toBe("Fetches the current user");
    expect(saved.cookies).toEqual({ session: "abc" });
  });

  it("never writes an assert block from the serialiser (the editor text owns it)", () => {
    const tab = requestFileToTab(
      {
        name: "Checked",
        method: "GET",
        url: "https://api.test/x",
        headers: {},
        assert: { status: 200 },
      },
      "/c/x.yaml",
      "/c",
    );

    expect(tab.assertions).toContain("status");
    expect(tabToRequestFile(tab).assert).toBeUndefined();
  });
});
