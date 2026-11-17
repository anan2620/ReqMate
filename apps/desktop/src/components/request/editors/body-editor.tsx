import { useTranslation } from "react-i18next";
import { CodeEditor } from "@/components/ui/code-editor";
import { KeyValueEditor } from "../key-value-editor";
import { FormDataEditor } from "./form-data-editor";
import type { BodyType, RequestBody } from "@reqmate/types";

const BODY_TYPE_IDS: BodyType[] = ["none", "json", "xml", "raw", "urlencoded", "form-data"];

const BODY_TYPE_LABEL_KEYS: Record<BodyType, string> = {
  none: "body.none",
  json: "body.json",
  xml: "body.xml",
  raw: "body.raw",
  urlencoded: "body.urlencoded",
  "form-data": "body.formData",
  binary: "body.binary",
};

/** Request body editor: type switcher + the matching content editor. */
export function BodyEditor({
  body,
  onChange,
}: {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {/* Body type selector */}
      <div className="flex gap-2">
        {BODY_TYPE_IDS.map((btId) => (
          <button
            key={btId}
            onClick={() => onChange({ ...body, type: btId })}
            className={`rounded px-3 py-1 text-xs transition-colors ${
              body.type === btId
                ? "bg-[var(--color-accent)] text-white shadow-[var(--shadow-xs)]"
                : "bg-[var(--color-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {t(BODY_TYPE_LABEL_KEYS[btId])}
          </button>
        ))}
      </div>

      {/* Body content */}
      {body.type !== "none" && body.type !== "form-data" && body.type !== "urlencoded" && (
        <CodeEditor
          value={body.content}
          onChange={(v) => onChange({ ...body, content: v })}
          language={body.type === "json" ? "json" : body.type === "xml" ? "xml" : "plaintext"}
          height="220px"
          placeholder={body.type === "json" ? '{\n  "key": "value"\n}' : ""}
        />
      )}

      {body.type === "urlencoded" && (
        <KeyValueEditor
          pairs={body.formData.length > 0 ? body.formData : [{ id: `kv_formdata_${Date.now()}`, key: "", value: "", enabled: true }]}
          onChange={(formData) => onChange({ ...body, formData })}
          keyPlaceholder="Field"
          valuePlaceholder={t("request.value")}
        />
      )}

      {body.type === "form-data" && (
        <FormDataEditor
          pairs={body.formData.length > 0 ? body.formData : [{ id: `kv_formdata_${Date.now()}`, key: "", value: "", enabled: true }]}
          onChange={(formData) => onChange({ ...body, formData })}
        />
      )}
    </div>
  );
}
