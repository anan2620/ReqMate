import { useTranslation } from "react-i18next";
import { CodeEditor } from "@/components/ui/code-editor";

/** Pre-request / post-response script editors. */
export function ScriptsEditor({
  preRequestScript,
  postResponseScript,
  onPreRequestChange,
  onPostResponseChange,
}: {
  preRequestScript: string | null;
  postResponseScript: string | null;
  onPreRequestChange: (script: string | null) => void;
  onPostResponseChange: (script: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          {t("request.preRequest")}
        </label>
        <p className="mb-2 text-xs text-[var(--color-text-dimmed)]">
          Runs before the request is sent. Use <code className="rounded bg-[var(--color-elevated)] px-1">req.env.set()</code>, <code className="rounded bg-[var(--color-elevated)] px-1">req.request.setHeader()</code>, etc.
        </p>
        <CodeEditor
          value={preRequestScript ?? ""}
          onChange={(v) => onPreRequestChange(v || null)}
          language="javascript"
          height="150px"
          placeholder="// req.env.set('token', 'abc123');"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          {t("request.postResponse")}
        </label>
        <p className="mb-2 text-xs text-[var(--color-text-dimmed)]">
          Runs after the response is received. Access response via <code className="rounded bg-[var(--color-elevated)] px-1">req.response.json()</code>, <code className="rounded bg-[var(--color-elevated)] px-1">req.response.status</code>, etc.
        </p>
        <CodeEditor
          value={postResponseScript ?? ""}
          onChange={(v) => onPostResponseChange(v || null)}
          language="javascript"
          height="150px"
          placeholder="// const body = req.response.json();"
        />
      </div>
    </div>
  );
}

/** Declarative assertions + JS test script editors. */
export function TestsEditor({
  assertions,
  testScript,
  onAssertionsChange,
  onTestScriptChange,
}: {
  assertions: string | null;
  testScript: string | null;
  onAssertionsChange: (assertions: string | null) => void;
  onTestScriptChange: (script: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          {t("request.assertions")}
        </label>
        <p className="mb-2 text-xs text-[var(--color-text-dimmed)]">
          Declarative checks. E.g. <code className="rounded bg-[var(--color-elevated)] px-1">status: 200</code>, <code className="rounded bg-[var(--color-elevated)] px-1">{"body.id: { type: string }"}</code>
        </p>
        <CodeEditor
          value={assertions ?? ""}
          onChange={(v) => onAssertionsChange(v || null)}
          language="yaml"
          height="130px"
          placeholder="status: 200"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          {t("request.testScript")}
        </label>
        <p className="mb-2 text-xs text-[var(--color-text-dimmed)]">
          Write tests using <code className="rounded bg-[var(--color-elevated)] px-1">req.test()</code> and <code className="rounded bg-[var(--color-elevated)] px-1">req.expect()</code>.
        </p>
        <CodeEditor
          value={testScript ?? ""}
          onChange={(v) => onTestScriptChange(v || null)}
          language="javascript"
          height="150px"
          placeholder={`req.test("status is 200", function() { ... });`}
        />
      </div>
    </div>
  );
}
