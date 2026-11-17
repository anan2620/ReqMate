import type {
  GraphQLState,
  GrpcState,
  KeyValuePair,
  RequestBody,
  RequestFile,
  Tab,
  TabProtocol,
} from "@reqmate/types";
import { emptyKvRow, generateTabId, kvId } from "./tab-model";

/**
 * Parse query params from a URL string into KeyValuePair[].
 * Returns { baseUrl, params } where baseUrl has no query string.
 */
export function parseUrlParams(url: string): { baseUrl: string; params: KeyValuePair[] } {
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return { baseUrl: url, params: [] };

  const baseUrl = url.slice(0, qIndex);
  const queryString = url.slice(qIndex + 1);
  const params: KeyValuePair[] = [];

  if (queryString) {
    for (const part of queryString.split("&")) {
      const eqIndex = part.indexOf("=");
      const key = eqIndex === -1 ? part : part.slice(0, eqIndex);
      const value = eqIndex === -1 ? "" : part.slice(eqIndex + 1);
      params.push({ id: kvId(), key: decodeURIComponent(key), value: decodeURIComponent(value), enabled: true });
    }
  }

  return { baseUrl, params };
}

/** Build a URL query string from KeyValuePair[], appending to a base URL. */
export function buildUrlWithParams(baseUrl: string, params: KeyValuePair[]): string {
  const enabledParams = params.filter((p) => p.enabled && p.key.trim());
  if (enabledParams.length === 0) return baseUrl;
  const qs = enabledParams
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&");
  return `${baseUrl}?${qs}`;
}

/** Build an editable tab from an on-disk request file. */
export function requestFileToTab(
  file: RequestFile,
  filePath: string,
  collectionPath: string,
): Tab {
  // Convert Record<string, string> headers to KeyValuePair[]
  const headers: KeyValuePair[] = Object.entries(file.headers || {}).map(
    ([key, value]) => ({ id: kvId(), key, value, enabled: true }),
  );
  if (headers.length === 0) headers.push(emptyKvRow());

  // Separate path variables from query params.
  // Path variables match :paramName placeholders in the URL.
  const urlPathVarNames = new Set(
    (file.url.match(/:([\w]+)/g) || []).map((m) => m.slice(1)),
  );
  const pathVariables: Record<string, string> = {};
  const fileQueryParams: KeyValuePair[] = [];
  for (const [key, value] of Object.entries(file.params || {})) {
    if (urlPathVarNames.has(key)) {
      pathVariables[key] = value;
    } else {
      fileQueryParams.push({ id: kvId(), key, value, enabled: true });
    }
  }

  const { params: urlParams } = parseUrlParams(file.url);
  // Combine: URL query params first, then remaining file params (avoiding duplicates)
  const seenKeys = new Set(urlParams.map((p) => p.key));
  const mergedParams = [
    ...urlParams,
    ...fileQueryParams.filter((p) => !seenKeys.has(p.key)),
  ];
  const params = mergedParams.length > 0 ? [...mergedParams, emptyKvRow()] : [emptyKvRow()];

  // Convert body
  const body: RequestBody = file.body
    ? {
        type: file.body.type as RequestBody["type"],
        content: file.body.content || "",
        formData: [],
      }
    : { type: "none", content: "", formData: [] };

  // Convert assert to YAML string for the editor
  let assertionsStr: string | null = null;
  if (file.assert) {
    // The assert field comes from Rust as a serde_yaml::Value serialized to JSON.
    // Convert it back to a simple YAML-like string for editing.
    try {
      if (typeof file.assert === "object" && file.assert !== null) {
        assertionsStr = Object.entries(file.assert as Record<string, unknown>)
          .map(([k, v]) => {
            if (typeof v === "object" && v !== null) {
              return `${k}:\n` + Object.entries(v as Record<string, unknown>)
                .map(([ok, ov]) => `  ${ok}: ${JSON.stringify(ov)}`)
                .join("\n");
            }
            return `${k}: ${JSON.stringify(v)}`;
          })
          .join("\n");
      } else if (typeof file.assert === "string") {
        assertionsStr = file.assert;
      }
    } catch {
      // If conversion fails, just stringify
      assertionsStr = JSON.stringify(file.assert);
    }
  }

  // Detect GraphQL: explicit protocol field or JSON body with a "query" field
  const isGraphQL = file.protocol === "graphql" || (
    file.body?.type === "json" && file.body.content &&
    (() => { try { return "query" in JSON.parse(file.body!.content!); } catch { return false; } })()
  );
  const graphqlState: GraphQLState | null = isGraphQL
    ? (() => {
        try {
          const parsed = JSON.parse(file.body!.content!);
          return {
            query: parsed.query || "",
            variables: parsed.variables ? JSON.stringify(parsed.variables, null, 2) : "{}",
            operationName: parsed.operationName || "",
            schemaJson: null,
          };
        } catch { return { query: "", variables: "{}", operationName: "", schemaJson: null }; }
      })()
    : null;

  // Determine protocol from explicit field or heuristic
  const protocol: TabProtocol = file.protocol === "websocket" ? "websocket"
    : file.protocol === "sse" ? "sse"
    : file.protocol === "grpc" ? "grpc"
    : isGraphQL ? "graphql"
    : "http";

  // Initialize gRPC state if needed
  const grpcState: GrpcState | null = protocol === "grpc" ? {
    services: [],
    selectedService: null,
    selectedMethod: null,
    requestJson: "{}",
    metadata: [emptyKvRow()],
    loading: false,
    response: null,
    error: null,
  } : null;

  return {
    id: generateTabId(),
    name: file.name,
    filePath,
    collectionPath,
    isDirty: false,
    protocol,
    graphql: graphqlState,
    grpc: grpcState,
    method: file.method,
    url: file.url,
    headers,
    params,
    pathVariables,
    body,
    auth: file.auth || { type: "none" },
    preRequestScript: file.preRequestScript ?? null,
    postResponseScript: file.postResponseScript ?? null,
    testScript: file.tests ?? null,
    assertions: assertionsStr,
    response: null,
    error: null,
    loading: false,
    testResults: [],
    assertionResults: [],
    consoleOutput: [],
    conflictState: null,
    pinned: false,
    undoStack: [],
    redoStack: [],
  };
}

/** Serialize a tab back to the on-disk request file shape. */
export function tabToRequestFile(tab: Tab): RequestFile {
  // Convert KeyValuePair[] to Record<string, string> (only enabled, non-empty)
  const headers: Record<string, string> = {};
  for (const h of tab.headers) {
    if (h.key.trim() && h.enabled) {
      headers[h.key] = h.value;
    }
  }

  // Save path variables to the params field
  const params: Record<string, string> | undefined =
    Object.keys(tab.pathVariables).length > 0 ? { ...tab.pathVariables } : undefined;

  // For GraphQL tabs, serialize the query/variables into a JSON body
  // so it's detected as GraphQL when loaded back (requestFileToTab checks for body.content with "query")
  let body: { type: string; content: string } | undefined;
  if (tab.protocol === "graphql" && tab.graphql) {
    const gqlBody: Record<string, unknown> = { query: tab.graphql.query };
    try {
      const vars = JSON.parse(tab.graphql.variables);
      if (Object.keys(vars).length > 0) gqlBody.variables = vars;
    } catch { /* ignore invalid JSON */ }
    if (tab.graphql.operationName) gqlBody.operationName = tab.graphql.operationName;
    body = { type: "json", content: JSON.stringify(gqlBody, null, 2) };
    // Ensure Content-Type header is set
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
  } else if (tab.body.type !== "none") {
    body = { type: tab.body.type, content: tab.body.content };
  }

  return {
    name: tab.name,
    method: tab.protocol === "graphql" ? "POST" : tab.method,
    url: tab.url, // URL already contains query params (synced)
    protocol: tab.protocol !== "http" ? tab.protocol : undefined,
    headers,
    params,
    auth: tab.auth.type !== "none" ? tab.auth : undefined,
    body,
    preRequestScript: tab.preRequestScript || undefined,
    postResponseScript: tab.postResponseScript || undefined,
    tests: tab.testScript || undefined,
  };
}
