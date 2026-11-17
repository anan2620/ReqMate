import type { KeyValuePair, Tab, TabSnapshot } from "@reqmate/types";

let tabCounter = 0;
let kvCounter = 0;

/** Stable-per-session ids for tabs and key/value rows. */
export const generateTabId = (): string => `tab_${Date.now()}_${++tabCounter}`;
export const kvId = (): string => `kv_${Date.now()}_${++kvCounter}`;

export const emptyKvRow = (): KeyValuePair => ({
  id: kvId(),
  key: "",
  value: "",
  enabled: true,
});

/** Maximum number of undo steps kept per tab. */
export const MAX_UNDO_DEPTH = 100;

/** A blank tab, with protocol-specific fields left at their defaults. */
export function createEmptyTab(overrides?: Partial<Tab>): Tab {
  return {
    id: generateTabId(),
    name: "Untitled Request",
    filePath: null,
    collectionPath: null,
    isDirty: false,
    protocol: "http",
    graphql: null,
    grpc: null,
    method: "GET",
    url: "",
    headers: [emptyKvRow()],
    params: [emptyKvRow()],
    pathVariables: {},
    body: { type: "none", content: "", formData: [] },
    auth: { type: "none" },
    preRequestScript: null,
    postResponseScript: null,
    testScript: null,
    assertions: null,
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
    ...overrides,
  };
}

/** Deep copy of the editable request fields, for the undo/redo stacks. */
export function takeSnapshot(tab: Tab): TabSnapshot {
  return {
    method: tab.method,
    url: tab.url,
    headers: JSON.parse(JSON.stringify(tab.headers)),
    params: JSON.parse(JSON.stringify(tab.params)),
    pathVariables: { ...tab.pathVariables },
    body: JSON.parse(JSON.stringify(tab.body)),
    auth: JSON.parse(JSON.stringify(tab.auth)),
    preRequestScript: tab.preRequestScript,
    postResponseScript: tab.postResponseScript,
    testScript: tab.testScript,
    assertions: tab.assertions,
  };
}
