import { useRef, useCallback, useState } from "react";
import Editor, { type OnMount, loader } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useResolvedTheme } from "@/hooks/use-theme";

// Configure Monaco to use the local monaco-editor package instead of fetching from CDN.
// The vite-plugin-monaco-editor handles bundling workers automatically.
import * as monacoEditor from "monaco-editor";
loader.config({ monaco: monacoEditor });

// ReqMate light theme
const REQMATE_LIGHT: Monaco.editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6b7280", fontStyle: "italic" },
    { token: "keyword", foreground: "7c3aed" },
    { token: "string", foreground: "059669" },
    { token: "number", foreground: "d97706" },
    { token: "type", foreground: "4f46e5" },
    { token: "variable", foreground: "2563eb" },
  ],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#151a22",
    "editor.lineHighlightBackground": "#f5f7fa",
    "editor.selectionBackground": "#5b5bd630",
    "editorCursor.foreground": "#5b5bd6",
    "editorLineNumber.foreground": "#9ca3af",
    "editorLineNumber.activeForeground": "#374151",
    "editor.inactiveSelectionBackground": "#5b5bd615",
    "editorIndentGuide.background": "#e8ebf0",
    "editorWidget.background": "#f6f7f9",
    "editorWidget.border": "#c8cfda",
    "input.background": "#ffffff",
    "input.border": "#c8cfda",
  },
};

// ReqMate dark theme
const REQMATE_DARK: Monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6b7280", fontStyle: "italic" },
    { token: "keyword", foreground: "a78bfa" },
    { token: "string", foreground: "34d399" },
    { token: "number", foreground: "fbbf24" },
    { token: "type", foreground: "818cf8" },
    { token: "variable", foreground: "60a5fa" },
  ],
  colors: {
    "editor.background": "#15181e",
    "editor.foreground": "#edf0f5",
    "editor.lineHighlightBackground": "#1b1f26",
    "editor.selectionBackground": "#5b5bd640",
    "editorCursor.foreground": "#5b5bd6",
    "editorLineNumber.foreground": "#52525b",
    "editorLineNumber.activeForeground": "#a1a1aa",
    "editor.inactiveSelectionBackground": "#5b5bd620",
    "editorIndentGuide.background": "#262b33",
    "editorWidget.background": "#1a1e25",
    "editorWidget.border": "#38404c",
    "input.background": "#1c2027",
    "input.border": "#38404c",
  },
};

// ReqMate black/OLED theme
const REQMATE_BLACK: Monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: REQMATE_DARK.rules,
  colors: {
    ...REQMATE_DARK.colors,
    "editor.background": "#0c0e11",
    "editor.lineHighlightBackground": "#14171b",
    "editorIndentGuide.background": "#1e2127",
    "editorWidget.background": "#0c0e11",
    "editorWidget.border": "#2e333b",
    "input.background": "#14171b",
    "input.border": "#2e333b",
  },
};

let themesRegistered = false;
let graphqlRegistered = false;

function registerThemes(monaco: typeof Monaco) {
  if (themesRegistered) return;
  monaco.editor.defineTheme("reqmate-light", REQMATE_LIGHT);
  monaco.editor.defineTheme("reqmate-dark", REQMATE_DARK);
  monaco.editor.defineTheme("reqmate-black", REQMATE_BLACK);
  themesRegistered = true;
}

function registerGraphQL(monaco: typeof Monaco) {
  if (graphqlRegistered) return;
  graphqlRegistered = true;

  monaco.languages.register({ id: "graphql" });
  monaco.languages.setMonarchTokensProvider("graphql", {
    keywords: [
      "query", "mutation", "subscription", "fragment", "on", "type", "input",
      "enum", "scalar", "interface", "union", "extend", "schema", "directive",
      "implements", "true", "false", "null",
    ],
    typeKeywords: ["Int", "Float", "String", "Boolean", "ID"],
    operators: ["=", "!", "...", ":", "@", "|", "&"],
    symbols: /[=!:@|&]+/,
    escapes: /\\(?:["\\/bfnrt]|u[0-9A-Fa-f]{4})/,
    tokenizer: {
      root: [
        [/#.*$/, "comment"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
        [/\d+/, "number"],
        [/\$\w+/, "variable"],
        [/[a-zA-Z_]\w*/, {
          cases: {
            "@keywords": "keyword",
            "@typeKeywords": "type",
            "@default": "identifier",
          },
        }],
        // eslint-disable-next-line no-useless-escape
        [/[{}()\[\]]/, "@brackets"],
        [/@symbols/, {
          cases: {
            "@operators": "operator",
            "@default": "",
          },
        }],
        { include: "@whitespace" },
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],
      whitespace: [
        [/[ \t\r\n]+/, "white"],
      ],
    },
  });
}

// Pre-register GraphQL language since Monaco doesn't include it by default.
registerGraphQL(monacoEditor);

function getMonacoTheme(resolved: "light" | "dark" | "black"): string {
  switch (resolved) {
    case "light": return "reqmate-light";
    case "black": return "reqmate-black";
    default: return "reqmate-dark";
  }
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string | number;
  readOnly?: boolean;
  minimap?: boolean;
  lineNumbers?: boolean;
  placeholder?: string;
  /** Draw the hairline frame around the editor (default true). */
  bordered?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language = "javascript",
  height = "200px",
  readOnly = false,
  minimap = false,
  lineNumbers = true,
  placeholder,
  bordered = true,
}: CodeEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const resolvedTheme = useResolvedTheme();
  const monacoTheme = getMonacoTheme(resolvedTheme);

  const [contentLeft, setContentLeft] = useState(56);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerGraphQL(monaco);
    registerThemes(monaco);
    monaco.editor.setTheme(monacoTheme);
    setContentLeft(editor.getLayoutInfo().contentLeft);
    editor.onDidLayoutChange((layout) => {
      setContentLeft(layout.contentLeft);
    });
  }, [monacoTheme]);

  // Switch theme when app theme changes
  if (monacoRef.current && themesRegistered) {
    monacoRef.current.editor.setTheme(monacoTheme);
  }

  const showPlaceholder = placeholder && !value;

  return (
    <div
      className={`relative h-full overflow-hidden ${bordered ? "rounded border border-[var(--color-border)]" : ""}`}
    >
      {showPlaceholder && (
        <div className="pointer-events-none absolute top-2 z-10 text-sm text-[var(--color-text-dimmed)]" style={{ left: contentLeft }}>
          {placeholder}
        </div>
      )}
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        theme={monacoTheme}
        loading={
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
          </div>
        }
        options={{
          minimap: { enabled: minimap },
          lineNumbers: lineNumbers ? "on" : "off",
          readOnly,
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
          tabSize: 2,
          wordWrap: "on",
          automaticLayout: true,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: readOnly ? "none" : "line",
          folding: true,
          bracketPairColorization: { enabled: true },
          suggest: { showWords: false },
          quickSuggestions: language === "javascript" || language === "typescript",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
        }}
      />
    </div>
  );
}
