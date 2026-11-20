import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { KeyValueEditor } from "./key-value-editor";
import { COMMON_REQUEST_HEADERS } from "@/lib/http-headers";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { AuthEditor } from "./editors/auth-editor";
import { BodyEditor } from "./editors/body-editor";
import { extractPathVariables } from "@/lib/url";
import { PathVariablesEditor } from "./editors/path-variables-editor";
import { ScriptsEditor, TestsEditor } from "./editors/scripts-editors";

type Tab = "params" | "headers" | "body" | "auth" | "scripts" | "tests";

const TAB_IDS: Tab[] = ["params", "headers", "body", "auth", "scripts", "tests"];

const TAB_LABEL_KEYS: Record<Tab, string> = {
  params: "request.params",
  headers: "request.headers",
  body: "request.body",
  auth: "request.auth",
  scripts: "request.scripts",
  tests: "request.tests",
};

export function RequestPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("params");
  const tab = useActiveTab();
  const {
    setParams,
    setHeaders,
    setBody,
    setAuth,
    setUrl,
    setPathVariables,
    setPreRequestScript,
    setPostResponseScript,
    setTestScript,
    setAssertions,
  } = useTabStore();

  const pathVars = useMemo(() => tab ? extractPathVariables(tab.url) : [], [tab?.url]);

  if (!tab) return null;

  const { params, headers, body, auth, pathVariables } = tab;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2">
        {TAB_IDS.map((tabId) => {
          const isActive = activeTab === tabId;
          const count =
            tabId === "params"
              ? params.filter((p) => p.key).length
              : tabId === "headers"
                ? headers.filter((h) => h.key).length
                : 0;
          const hasDot =
            (tabId === "scripts" && Boolean(tab.preRequestScript || tab.postResponseScript)) ||
            (tabId === "tests" && Boolean(tab.testScript || tab.assertions));
          return (
            <button
              key={tabId}
              data-tour={`tab-${tabId}`}
              onClick={() => setActiveTab(tabId)}
              className={`relative shrink-0 whitespace-nowrap px-3 py-[9px] text-[12.5px] transition-colors duration-150 ${
                isActive
                  ? "font-medium text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {t(TAB_LABEL_KEYS[tabId])}
                {count > 0 && (
                  <span className="tabular rounded-full bg-[color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] px-1.5 text-[10px] font-medium leading-[15px] text-[var(--color-text-muted)]">
                    {count}
                  </span>
                )}
                {hasDot && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                )}
              </span>
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-[2px] bg-[var(--color-accent)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "params" && (
          <div className="relative space-y-4">
            <PathVariablesEditor
              url={tab.url}
              pathVars={pathVars}
              values={pathVariables}
              onChange={setPathVariables}
              onUrlChange={setUrl}
            />
            <KeyValueEditor
              pairs={params}
              onChange={setParams}
              keyPlaceholder={t("request.parameter")}
              valuePlaceholder={t("request.value")}
            />
            <HintTooltip hintId="env-vars" message="Tip: Use {{variableName}} for dynamic values from environments" />
          </div>
        )}

        {activeTab === "headers" && (
          <KeyValueEditor
            pairs={headers}
            onChange={setHeaders}
            keyPlaceholder="Header"
            valuePlaceholder={t("request.value")}
            keySuggestions={COMMON_REQUEST_HEADERS}
          />
        )}

        {activeTab === "body" && (
          <BodyEditor body={body} onChange={setBody} />
        )}

        {activeTab === "auth" && (
          <AuthEditor auth={auth} onChange={setAuth} />
        )}

        {activeTab === "scripts" && (
          <ScriptsEditor
            preRequestScript={tab.preRequestScript}
            postResponseScript={tab.postResponseScript}
            onPreRequestChange={setPreRequestScript}
            onPostResponseChange={setPostResponseScript}
          />
        )}

        {activeTab === "tests" && (
          <TestsEditor
            assertions={tab.assertions}
            testScript={tab.testScript}
            onAssertionsChange={setAssertions}
            onTestScriptChange={setTestScript}
          />
        )}
      </div>
    </div>
  );
}
