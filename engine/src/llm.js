// Talk to the AI model the person chooses. Nothing is sent anywhere unless they pick a provider.
//   local:      Ollama on their own computer (OpenAI-compatible API)
//   free cloud: OpenRouter's free models, with their own free key
//   paid cloud: OpenAI, Anthropic, or any OpenAI-compatible service, with their own key

export const PROVIDERS = {
  none: { label: "No AI model (works offline)", tier: "none" },
  ollama: { label: "Ollama on this computer", tier: "local", baseUrl: "http://localhost:11434/v1", needsKey: false, modelHint: "llama3.2" },
  openrouter: { label: "OpenRouter", tier: "free or paid cloud", baseUrl: "https://openrouter.ai/api/v1", needsKey: true, modelHint: "a model ID from openrouter.ai/models (free ones end in :free)" },
  openai: { label: "OpenAI", tier: "paid cloud", baseUrl: "https://api.openai.com/v1", needsKey: true, modelHint: "a model ID from your OpenAI account" },
  anthropic: { label: "Anthropic (Claude)", tier: "paid cloud", baseUrl: "https://api.anthropic.com/v1", needsKey: true, modelHint: "claude-sonnet-5-5" },
  custom: { label: "Other OpenAI-compatible service", tier: "cloud or local", baseUrl: "", needsKey: false, modelHint: "the service's model ID" },
};

/** Is this configuration complete enough to call? */
export function isReady(settings) {
  const p = PROVIDERS[settings?.provider];
  if (!p || settings.provider === "none") return false;
  if (!settings.model) return false;
  if (p.needsKey && !settings.apiKey) return false;
  return Boolean(settings.baseUrl || p.baseUrl);
}

/** Build the fetch request for a chat. messages: [{ role: "user"|"assistant", content }]. */
export function buildRequest(settings, { system = "", messages = [], maxTokens = 1024 } = {}) {
  const p = PROVIDERS[settings.provider];
  const base = (settings.baseUrl || p.baseUrl).replace(/\/+$/, "");
  if (settings.provider === "anthropic") {
    return {
      url: `${base}/messages`,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": settings.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: settings.model, max_tokens: maxTokens, system, messages }),
      },
    };
  }
  const headers = { "content-type": "application/json" };
  if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
  if (settings.provider === "openrouter") headers["x-title"] = "Seekto";
  return {
    url: `${base}/chat/completions`,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.model,
        max_tokens: maxTokens,
        messages: system ? [{ role: "system", content: system }, ...messages] : messages,
      }),
    },
  };
}

/** Pull the reply text out of either API's response. */
export function readReply(provider, json) {
  if (provider === "anthropic") return (json.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return json.choices?.[0]?.message?.content ?? "";
}

/** Send a chat and return the reply text. Throws an Error with a readable message on failure. */
export async function chat(settings, options, fetchImpl = globalThis.fetch) {
  if (!isReady(settings)) throw new Error("Choose an AI model in Settings first.");
  const { url, init } = buildRequest(settings, options);
  let res;
  try {
    res = await fetchImpl(url, init);
  } catch {
    throw new Error(
      settings.provider === "ollama"
        ? "Couldn't reach Ollama. Make sure it's running and allows this site (set OLLAMA_ORIGINS)."
        : "Couldn't reach the AI service. Check your connection."
    );
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || json.error || `The AI service answered ${res.status}.`);
  return readReply(settings.provider, json);
}
