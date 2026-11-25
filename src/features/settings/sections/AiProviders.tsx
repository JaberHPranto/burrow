import { type AiProviderId, type AiTestResult, commands } from "@/core/platform/commands";
import { AI_PROVIDERS } from "@/core/settings/settings";
import { useSettings } from "@/core/settings/store";
import { cx } from "@/core/utils/cx";
import { Button, Field, Input, Select, Tag, toast } from "@/design";
import { Check, KeyRound, PlugZap, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Section } from "../Section";
import styles from "../settings.module.css";

export function AiProviders() {
  const [keys, setKeys] = useState<Record<AiProviderId, boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setKeys(await commands.aiKeyStatus());
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Section
      title="AI providers"
      description={
        <>
          Bring your own key. Keys are stored in your system keyring (GNOME Keyring), never in
          Burrow's files, and are never shown again after saving. Requests go straight from Burrow
          to the provider.
        </>
      }
    >
      {error && (
        <p className={styles.rowHelp}>
          Couldn't open the keyring: {error}. Make sure GNOME Keyring is running (it is on standard
          Ubuntu).
        </p>
      )}
      {AI_PROVIDERS.map((p) => (
        <ProviderCard
          key={p.id}
          provider={p}
          hasKey={keys?.[p.id] ?? false}
          onKeysChanged={refresh}
        />
      ))}
    </Section>
  );
}

function ProviderCard({
  provider,
  hasKey,
  onKeysChanged,
}: {
  provider: (typeof AI_PROVIDERS)[number];
  hasKey: boolean;
  onKeysChanged: () => Promise<void>;
}) {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const config = settings.ai.providers[provider.id];
  const isDefault = settings.ai.defaultProvider === provider.id;
  const [draftKey, setDraftKey] = useState("");
  const [test, setTest] = useState<AiTestResult | null>(null);
  const [busy, setBusy] = useState(false);

  const setConfig = (patch: Partial<typeof config>) =>
    update({
      ai: {
        ...settings.ai,
        providers: { ...settings.ai.providers, [provider.id]: { ...config, ...patch } },
      },
    });

  async function saveKey() {
    setBusy(true);
    try {
      await commands.aiSetKey(provider.id, draftKey);
      setDraftKey("");
      await onKeysChanged();
      toast.success(`${provider.name} key saved to keyring`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteKey() {
    await commands.aiDeleteKey(provider.id);
    setTest(null);
    await onKeysChanged();
    toast.success(`${provider.name} key removed`);
  }

  async function runTest() {
    setBusy(true);
    try {
      const result = await commands.aiTest(provider.id, config.baseUrl.trim() || null);
      setTest(result);
      if (result.ok && !config.model && result.models[0]) setConfig({ model: result.models[0] });
    } catch (err) {
      setTest({ ok: false, message: String(err), models: [] });
    } finally {
      setBusy(false);
    }
  }

  const ready = provider.needsKey ? hasKey : true;

  return (
    <div className={cx(styles.provider, isDefault && styles.providerDefault)}>
      <div className={styles.providerHead}>
        <strong>{provider.name}</strong>
        {provider.needsKey &&
          (hasKey ? (
            <Tag tone="mint" icon={Check}>
              key saved
            </Tag>
          ) : (
            <Tag>no key</Tag>
          ))}
        {isDefault && (
          <Tag tone="butter" icon={Star}>
            default
          </Tag>
        )}
        <span className="b-grow" />
        {!isDefault && ready && (
          <Button
            size="sm"
            variant="ghost"
            icon={Star}
            onClick={() => update({ ai: { ...settings.ai, defaultProvider: provider.id } })}
          >
            Make default
          </Button>
        )}
      </div>

      <div className={styles.providerGrid}>
        {provider.needsKey || provider.id === "custom" ? (
          <div className={styles.keyField}>
            <Field label="API key">
              <div className={styles.inline}>
                <Input
                  type="password"
                  autoComplete="off"
                  icon={KeyRound}
                  placeholder={hasKey ? "•••••••• (saved — type to replace)" : provider.keyHint}
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!draftKey.trim() || busy}
                  onClick={saveKey}
                >
                  Save
                </Button>
                {hasKey && (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={Trash2}
                    onClick={deleteKey}
                    aria-label="Delete key"
                  />
                )}
              </div>
            </Field>
          </div>
        ) : null}

        {provider.baseUrlHint !== null && (
          <Field
            label="Base URL"
            hint={
              provider.id === "custom"
                ? "Any OpenAI-compatible API (LM Studio, vLLM, Groq…)"
                : "Leave empty for the default"
            }
          >
            <Input
              placeholder={provider.baseUrlHint}
              value={config.baseUrl}
              onChange={(e) => setConfig({ baseUrl: e.target.value })}
            />
          </Field>
        )}

        <Field label="Default model">
          {test?.models.length ? (
            <Select value={config.model} onChange={(e) => setConfig({ model: e.target.value })}>
              {!test.models.includes(config.model) && config.model && (
                <option>{config.model}</option>
              )}
              {test.models.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          ) : (
            <Input
              placeholder="Test the connection to list models"
              value={config.model}
              onChange={(e) => setConfig({ model: e.target.value })}
            />
          )}
        </Field>
      </div>

      <div className={styles.inline}>
        <Button size="sm" icon={PlugZap} onClick={runTest} disabled={busy || !ready}>
          Test connection
        </Button>
        {test && (
          <span className={cx(styles.testResult, test.ok ? styles.ok : styles.bad)}>
            {test.message}
          </span>
        )}
      </div>
    </div>
  );
}
