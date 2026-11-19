import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { oauthClearToken, oauthGetTokenStatus, oauthStartFlow } from "@/lib/tauri-api";
import type { AuthConfig, OAuth2GrantType, OAuthTokenStatus } from "@reqmate/types";
import { Select } from "@/components/ui/select";

const INPUT_CLASS =
  "w-full rounded border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none";

/** Auth type switcher plus the fields for the selected type. */
export function AuthEditor({
  auth,
  onChange,
}: {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {/* Auth type selector */}
      <Select
        size="md"
        value={auth.type}
        onChange={(v) => {
          const type = v as AuthConfig["type"];
          switch (type) {
            case "none":
              onChange({ type: "none" });
              break;
            case "bearer":
              onChange({ type: "bearer", token: "" });
              break;
            case "basic":
              onChange({ type: "basic", username: "", password: "" });
              break;
            case "api-key":
              onChange({ type: "api-key", key: "", value: "", addTo: "header" });
              break;
            case "oauth2":
              onChange({
                type: "oauth2",
                grantType: "authorization_code",
                authUrl: "",
                tokenUrl: "",
                clientId: "",
                clientSecret: "",
                scope: "",
                callbackUrl: "http://localhost:9876/callback",
                username: "",
                password: "",
                usePkce: true,
              });
              break;
            case "digest":
              onChange({ type: "digest", username: "", password: "" });
              break;
            case "aws-v4":
              onChange({
                type: "aws-v4",
                accessKey: "",
                secretKey: "",
                region: "",
                service: "",
                sessionToken: "",
              });
              break;
            case "jwt-bearer":
              onChange({
                type: "jwt-bearer",
                secret: "",
                algorithm: "HS256",
                payload: '{\n  "sub": "1234567890",\n  "iat": 0\n}',
                headerPrefix: "Bearer",
              });
              break;
            case "ntlm":
              onChange({
                type: "ntlm",
                username: "",
                password: "",
                domain: "",
                workstation: "",
              });
              break;
            case "saml":
              onChange({
                type: "saml",
                idpUrl: "",
                entityId: "",
                assertionConsumerUrl: "",
                certificate: "",
                nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
                samlToken: "",
              });
              break;
          }
        }}
        options={[
          { value: "none", label: t("auth.none") },
          { value: "bearer", label: t("auth.bearer") },
          { value: "basic", label: t("auth.basic") },
          { value: "api-key", label: t("auth.apiKey") },
          { value: "oauth2", label: t("auth.oauth2") },
          { value: "digest", label: t("auth.digest") },
          { value: "aws-v4", label: t("auth.awsV4") },
          { value: "jwt-bearer", label: t("auth.jwtBearer") },
          { value: "ntlm", label: t("auth.ntlm") },
          { value: "saml", label: t("auth.saml") },
        ]}
      />

      {/* Auth fields */}
      {auth.type === "bearer" && (
        <input
          type="text"
          value={auth.token}
          onChange={(e) => onChange({ ...auth, token: e.target.value })}
          placeholder={t("auth.token")}
          className={INPUT_CLASS}
        />
      )}

      {auth.type === "basic" && (
        <div className="space-y-2">
          <input
            type="text"
            value={auth.username}
            onChange={(e) => onChange({ ...auth, username: e.target.value })}
            placeholder={t("auth.username")}
            className={INPUT_CLASS}
          />
          <input
            type="password"
            value={auth.password}
            onChange={(e) => onChange({ ...auth, password: e.target.value })}
            placeholder={t("auth.password")}
            className={INPUT_CLASS}
          />
        </div>
      )}

      {auth.type === "api-key" && (
        <div className="space-y-2">
          <input
            type="text"
            value={auth.key}
            onChange={(e) => onChange({ ...auth, key: e.target.value })}
            placeholder={t("auth.keyNamePlaceholder")}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={auth.value}
            onChange={(e) => onChange({ ...auth, value: e.target.value })}
            placeholder={t("request.value")}
            className={INPUT_CLASS}
          />
          <Select
            size="md"
            value={auth.addTo}
            onChange={(v) =>
              onChange({ ...auth, addTo: v as "header" | "query" })
            }
        options={[
          { value: "header", label: t("auth.addToHeader") },
          { value: "query", label: t("auth.addToQuery") },
        ]}
      />
        </div>
      )}

      {auth.type === "oauth2" && (
        <OAuth2Editor auth={auth} onChange={onChange} />
      )}

      {auth.type === "digest" && (
        <div className="space-y-2">
          <input
            type="text"
            value={auth.username}
            onChange={(e) => onChange({ ...auth, username: e.target.value })}
            placeholder={t("auth.username")}
            className={INPUT_CLASS}
          />
          <input
            type="password"
            value={auth.password}
            onChange={(e) => onChange({ ...auth, password: e.target.value })}
            placeholder={t("auth.password")}
            className={INPUT_CLASS}
          />
        </div>
      )}

      {auth.type === "aws-v4" && (
        <div className="space-y-2">
          <input
            type="text"
            value={auth.accessKey}
            onChange={(e) => onChange({ ...auth, accessKey: e.target.value })}
            placeholder={t("auth.accessKey")}
            className={INPUT_CLASS}
          />
          <input
            type="password"
            value={auth.secretKey}
            onChange={(e) => onChange({ ...auth, secretKey: e.target.value })}
            placeholder={t("auth.secretKey")}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={auth.region}
            onChange={(e) => onChange({ ...auth, region: e.target.value })}
            placeholder={t("auth.region")}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={auth.service}
            onChange={(e) => onChange({ ...auth, service: e.target.value })}
            placeholder={t("auth.service")}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={auth.sessionToken}
            onChange={(e) => onChange({ ...auth, sessionToken: e.target.value })}
            placeholder={t("auth.sessionToken")}
            className={INPUT_CLASS}
          />
        </div>
      )}

      {auth.type === "jwt-bearer" && (
        <div className="space-y-2">
          <Select
            size="md"
            value={auth.algorithm}
            onChange={(v) => onChange({ ...auth, algorithm: v })}
            options={[
              { value: "HS256", label: "HS256" },
              { value: "HS384", label: "HS384" },
              { value: "HS512", label: "HS512" },
              { value: "RS256", label: "RS256" },
              { value: "RS384", label: "RS384" },
              { value: "RS512", label: "RS512" },
              { value: "ES256", label: "ES256" },
              { value: "ES384", label: "ES384" },
            ]}
          />
          <input
            type="password"
            value={auth.secret}
            onChange={(e) => onChange({ ...auth, secret: e.target.value })}
            placeholder={auth.algorithm.startsWith("HS") ? "HMAC Secret" : "Private Key (PEM)"}
            className={INPUT_CLASS}
          />
          <textarea
            value={auth.payload}
            onChange={(e) => onChange({ ...auth, payload: e.target.value })}
            placeholder='{"sub": "user", "iat": 0}'
            rows={5}
            className={INPUT_CLASS + " resize-y font-mono"}
          />
          <input
            type="text"
            value={auth.headerPrefix}
            onChange={(e) => onChange({ ...auth, headerPrefix: e.target.value })}
            placeholder={t("auth.headerPrefix")}
            className={INPUT_CLASS}
          />
        </div>
      )}

      {auth.type === "ntlm" && (
        <div className="space-y-2">
          <input
            type="text"
            value={auth.username}
            onChange={(e) => onChange({ ...auth, username: e.target.value })}
            placeholder={t("auth.username")}
            className={INPUT_CLASS}
          />
          <input
            type="password"
            value={auth.password}
            onChange={(e) => onChange({ ...auth, password: e.target.value })}
            placeholder={t("auth.password")}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={auth.domain}
            onChange={(e) => onChange({ ...auth, domain: e.target.value })}
            placeholder={t("auth.domain")}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={auth.workstation}
            onChange={(e) => onChange({ ...auth, workstation: e.target.value })}
            placeholder={t("auth.workstation")}
            className={INPUT_CLASS}
          />
        </div>
      )}

      {auth.type === "saml" && (
        <div className="space-y-2">
          <input
            type="text"
            value={auth.idpUrl}
            onChange={(e) => onChange({ ...auth, idpUrl: e.target.value })}
            placeholder={t("auth.idpUrl")}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={auth.entityId}
            onChange={(e) => onChange({ ...auth, entityId: e.target.value })}
            placeholder={t("auth.entityId")}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={auth.assertionConsumerUrl}
            onChange={(e) => onChange({ ...auth, assertionConsumerUrl: e.target.value })}
            placeholder={t("auth.assertionConsumerUrl")}
            className={INPUT_CLASS}
          />
          <textarea
            value={auth.certificate}
            onChange={(e) => onChange({ ...auth, certificate: e.target.value })}
            placeholder={t("auth.certificate")}
            rows={3}
            className={INPUT_CLASS + " resize-y font-mono"}
          />
          <input
            type="text"
            value={auth.nameIdFormat}
            onChange={(e) => onChange({ ...auth, nameIdFormat: e.target.value })}
            placeholder={t("auth.nameIdFormat")}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={auth.samlToken}
            onChange={(e) => onChange({ ...auth, samlToken: e.target.value })}
            placeholder={t("auth.samlToken")}
            className={INPUT_CLASS}
          />
        </div>
      )}
    </div>
  );
}

/** OAuth 2.0 fields plus token acquisition/status. */
function OAuth2Editor({
  auth,
  onChange,
}: {
  auth: Extract<AuthConfig, { type: "oauth2" }>;
  onChange: (auth: AuthConfig) => void;
}) {
  const { t } = useTranslation();
  const [tokenStatus, setTokenStatus] = useState<OAuthTokenStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `${auth.clientId}:${auth.authUrl}`;

  const refreshStatus = useCallback(async () => {
    if (!auth.clientId) return;
    try {
      const status = await oauthGetTokenStatus(cacheKey);
      setTokenStatus(status);
    } catch {
      // ignore - no token yet
    }
  }, [cacheKey, auth.clientId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleGetToken = async () => {
    setLoading(true);
    setError(null);
    try {
      await oauthStartFlow(auth);
      await refreshStatus();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message: string }).message
        : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClearToken = async () => {
    try {
      await oauthClearToken(cacheKey);
      setTokenStatus(null);
    } catch {
      // ignore
    }
  };

  const showAuthUrl =
    auth.grantType === "authorization_code" || auth.grantType === "implicit";
  const showTokenUrl = auth.grantType !== "implicit";
  const showPassword = auth.grantType === "password";
  const showPkce = auth.grantType === "authorization_code";

  return (
    <div className="space-y-2">
      {/* Grant Type */}
      <label className="block">
        <span className="text-xs text-[var(--color-text-secondary)]">{t("auth.grantType")}</span>
        <Select
          size="md"
          value={auth.grantType}
          onChange={(v) =>
            onChange({ ...auth, grantType: v as OAuth2GrantType })
          }
          options={[
            { value: "authorization_code", label: t("auth.authorizationCode") },
            { value: "client_credentials", label: t("auth.clientCredentials") },
            { value: "implicit", label: t("auth.implicit") },
            { value: "password", label: t("auth.passwordGrant") },
          ]}
        />
      </label>

      {/* Auth URL */}
      {showAuthUrl && (
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{t("auth.authUrl")}</span>
          <input
            type="text"
            value={auth.authUrl}
            onChange={(e) => onChange({ ...auth, authUrl: e.target.value })}
            placeholder="https://provider.com/oauth/authorize"
            className={INPUT_CLASS}
          />
        </label>
      )}

      {/* Token URL */}
      {showTokenUrl && (
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{t("auth.tokenUrl")}</span>
          <input
            type="text"
            value={auth.tokenUrl}
            onChange={(e) => onChange({ ...auth, tokenUrl: e.target.value })}
            placeholder="https://provider.com/oauth/token"
            className={INPUT_CLASS}
          />
        </label>
      )}

      {/* Client ID & Secret */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{t("auth.clientId")}</span>
          <input
            type="text"
            value={auth.clientId}
            onChange={(e) => onChange({ ...auth, clientId: e.target.value })}
            placeholder={t("auth.clientId")}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{t("auth.clientSecret")}</span>
          <input
            type="password"
            value={auth.clientSecret}
            onChange={(e) => onChange({ ...auth, clientSecret: e.target.value })}
            placeholder={t("auth.clientSecret")}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      {/* Scope */}
      <label className="block">
        <span className="text-xs text-[var(--color-text-secondary)]">{t("auth.scope")}</span>
        <input
          type="text"
          value={auth.scope}
          onChange={(e) => onChange({ ...auth, scope: e.target.value })}
          placeholder="openid profile email"
          className={INPUT_CLASS}
        />
      </label>

      {/* Username & Password (password grant only) */}
      {showPassword && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">{t("auth.username")}</span>
            <input
              type="text"
              value={auth.username}
              onChange={(e) => onChange({ ...auth, username: e.target.value })}
              placeholder={t("auth.username")}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-text-secondary)]">{t("auth.password")}</span>
            <input
              type="password"
              value={auth.password}
              onChange={(e) => onChange({ ...auth, password: e.target.value })}
              placeholder={t("auth.password")}
              className={INPUT_CLASS}
            />
          </label>
        </div>
      )}

      {/* Callback URL */}
      {showAuthUrl && (
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{t("auth.callbackUrl")}</span>
          <input
            type="text"
            value={auth.callbackUrl}
            onChange={(e) => onChange({ ...auth, callbackUrl: e.target.value })}
            placeholder="http://localhost:9876/callback"
            className={INPUT_CLASS}
          />
        </label>
      )}

      {/* PKCE */}
      {showPkce && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input
            type="checkbox"
            checked={auth.usePkce}
            onChange={(e) => onChange({ ...auth, usePkce: e.target.checked })}
            className="rounded"
          />
          {t("auth.usePkce")}
        </label>
      )}

      {/* Token Status & Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleGetToken}
          disabled={loading}
          className="btn-accent rounded-md px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50"
        >
          {loading ? t("auth.authenticating") : t("auth.getToken")}
        </button>
        {tokenStatus?.hasToken && (
          <button
            onClick={handleClearToken}
            className="rounded bg-[var(--color-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            {t("auth.clearToken")}
          </button>
        )}
      </div>

      {/* Token status display */}
      {tokenStatus?.hasToken && (
        <div
          className={`rounded px-3 py-1.5 text-xs ${
            tokenStatus.isExpired
              ? "bg-red-500/10 text-red-400"
              : "bg-green-500/10 text-green-400"
          }`}
        >
          {tokenStatus.isExpired
            ? t("auth.tokenExpired")
            : tokenStatus.expiresAt
              ? `${t("auth.tokenValid")} (expires ${new Date(tokenStatus.expiresAt * 1000).toLocaleTimeString()})`
              : `${t("auth.tokenValid")} (no expiry)`}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
