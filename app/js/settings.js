// Settings: which AI model to use (or none), voice, and your data.
import { $, html, raw, toast, download, readFile } from "./ui.js";
import { state, updateSettings, loadAll } from "./state.js";
import { all, put, clearAll } from "./store.js";
import { PROVIDERS, isReady, chat } from "../engine/index.js";
import { devicesListHtml, wireForget } from "./connect.js";
import { onStatus } from "./devices.js";
import { renderAccount } from "./account.js";
import { setMode } from "./profile.js";
import { MODELS as ASR_MODELS, prepare as prepareAsr, progressText, defaultTranscriber } from "./ondevice.js";
import { go } from "./nav.js";
import { canListen } from "./voice.js";
import { t, LANGUAGES } from "./i18n.js";

const LANGS = [["", t("Detect automatically")], ["english", t("English")], ["spanish", t("Spanish")], ["french", t("French")], ["german", t("German")], ["portuguese", t("Portuguese")], ["italian", t("Italian")], ["chinese", t("Chinese")], ["japanese", t("Japanese")], ["korean", t("Korean")], ["hindi", t("Hindi")], ["arabic", t("Arabic")], ["russian", t("Russian")], ["vietnamese", t("Vietnamese")], ["turkish", t("Turkish")], ["polish", t("Polish")], ["dutch", t("Dutch")], ["indonesian", t("Indonesian")], ["ukrainian", t("Ukrainian")]];
import { hasSamples, removeSamples } from "./sample.js";
import { disconnect } from "./cloud.js";

const GROUPS = [
  [t("No AI"), ["none"]],
  [t("On your computer (private, free)"), ["ollama"]],
  [t("Free or paid cloud"), ["openrouter"]],
  [t("Paid cloud"), ["openai", "anthropic"]],
  [t("Advanced"), ["custom"]],
];
// Provider labels and model hints are written in the engine; these are the ones that are words, not names.
const PROVIDER_LABELS = { none: t("No AI model (works offline)"), ollama: t("Ollama on this computer"), custom: t("Other OpenAI-compatible service") };
const MODEL_HINTS = { openrouter: t("a model ID from openrouter.ai/models (free ones end in :free)"), openai: t("a model ID from your OpenAI account"), custom: t("the service's model ID") };
const providerLabel = (id) => PROVIDER_LABELS[id] || PROVIDERS[id].label;
const modelHint = (id) => MODEL_HINTS[id] || PROVIDERS[id].modelHint || "";

export function render(main, section) {
  const s = state.settings;
  const transcriber = s.transcriber || defaultTranscriber(canListen);
  const p = PROVIDERS[s.provider];
  main.innerHTML = html`
    <div class="view">
      <h1>${t("Settings")}</h1>
      <section class="panel">
        <h2>${t("Language")}</h2>
        <select id="uiLang" aria-label="${t("Language")}">${raw([["auto", t("Automatic")], ...LANGUAGES].map(([code, name]) => html`<option value="${code}" ${code === (s.uiLang || "auto") ? "selected" : ""}>${name}</option>`).join(""))}</select>
        <p class="note-small">${t("Changes the app's words and the language your browser listens in. Deadlines and definitions are found in English, Spanish and Portuguese whatever you choose.")}</p>
      </section>
      <section class="panel">
        <h2>${t("Use Seekto for")}</h2>
        <div class="seg" role="group" aria-label="${t("Use Seekto for")}">${raw(["learning", "work"].map((m) => html`<button type="button" data-setmode="${m}" aria-pressed="${m === (s.mode || "learning")}">${m === "learning" ? t("Learning") : t("Work")}</button>`).join(""))}</div>
        <p class="note-small">${t("Learning is for classes, assignments and tests. Work is for meetings, decisions and action items. Everything else is the same, and you can switch any time.")}</p>
      </section>
      <section class="panel">
        <h2>${t("Transcription")}</h2>
        <label class="row radio-row"><input type="radio" name="asr" value="device" ${raw(transcriber === "device" || !canListen ? "checked" : "")} style="width:auto"> <span><b>${t("Private, on this device.")}</b> <span class="note-small">${t("Recommended. Whisper runs in your browser when you stop recording, so audio never leaves this device. Works offline after a one-time download, in about 100 languages. Slower on phones.")}</span></span></label>
        <label class="row radio-row"><input type="radio" name="asr" value="browser" ${raw(transcriber !== "device" && canListen ? "checked" : "")} ${raw(canListen ? "" : "disabled")} style="width:auto"> <span><b>${t("Live, with your browser's speech service.")}</b> <span class="note-small">${t("You see words as they're spoken. In Chrome and Edge, audio is processed online by the browser maker.")}${canListen ? "" : " " + t("Not available in this browser.")}</span></span></label>
        <div class="row">
          <label class="field" style="min-width:200px"><span class="label">${t("Model")}</span><select id="asrQuality">${raw(Object.entries(ASR_MODELS).map(([k, m]) => html`<option value="${k}" ${k === (s.asrQuality || "fast") ? "selected" : ""}>${m.label}</option>`).join(""))}</select></label>
          <label class="field" style="min-width:200px"><span class="label">${t("Language")}</span><select id="asrLanguage">${raw(LANGS.map(([code, name]) => html`<option value="${code}" ${code === (s.asrLanguage || "") ? "selected" : ""}>${name}</option>`).join(""))}</select></label>
        </div>
        <div class="row"><button class="btn ghost small" id="asrPrepare">${t("Download the model now")}</button><span class="note-small" id="asrPrepStatus"></span></div>
      </section>
      <section class="panel">
        <h2>${t("Devices")}</h2>
        <p class="sub">${t("Connect your phone, laptop and other devices with a short code. They sync directly with each other.")}</p>
        <div class="agenda" id="setDevices"></div>
        <div class="row"><button class="btn" id="setConnect">${t("Connect a device")}</button></div>
      </section>
      <section class="panel">
        <h2>${t("Your data")}</h2>
        <p class="sub">${t("Everything is stored in this browser on this device. Back it up to move it to another device.")}</p>
        <div class="row">
          ${raw(hasSamples() ? `<button class="btn ghost" id="noSamples">${t("Remove the samples")}</button>` : "")}
          <button class="btn ghost" id="backup">${t("Download backup")}</button>
          <label class="btn ghost" style="cursor:pointer">${t("Restore backup")}<input type="file" id="restore" accept=".json" class="sr-only"></label>
          <button class="btn danger" id="wipe">${t("Delete everything")}</button>
        </div>
        <p class="note-small">${t("Recordings aren't included in backups yet.")}</p>
      </section>
      <details class="more" id="more" ${raw(section ? "open" : "")}>
        <summary><h2>${t("More")}</h2><span class="note-small">${t("AI model, your own storage, research and assignments, voice")}</span></summary>
        <div class="more-body">
      <section class="panel" id="aiPanel">
        <h2>${t("AI model")}</h2>
        <p class="sub">${t("Seekto works without AI: recording, notes, the calendar, quizzes from definitions and answers from your notes. An AI model adds open questions, summaries, better quizzes, research plans and briefs. Your key stays on this device and is sent only to the service you choose.")}</p>
        <label class="field"><span class="label">${t("Provider")}</span>
          <select id="provider">${raw(GROUPS.map(([label, ids]) => `<optgroup label="${label}">${ids.map((id) => html`<option value="${id}" ${id === s.provider ? "selected" : ""}>${id === "openrouter" ? t("{name} (free models available)", { name: providerLabel(id) }) : providerLabel(id)}</option>`).join("")}</optgroup>`).join(""))}</select></label>
        <div id="providerFields" ${raw(s.provider === "none" ? "hidden" : "")} style="display:grid;gap:12px">
          <label class="field"><span class="label">${t("Model")}</span><input type="text" id="model" value="${s.model}" placeholder="${modelHint(s.provider)}"></label>
          <label class="field" id="keyField" ${raw(p.needsKey || s.provider === "custom" ? "" : "hidden")}><span class="label">${t("API key")}</span><input type="password" id="apiKey" value="${s.apiKey}" autocomplete="off" placeholder="${t("Stored only on this device")}"></label>
          <label class="field" id="urlField" ${raw(s.provider === "custom" || s.provider === "ollama" ? "" : "hidden")}><span class="label">${t("Address")}</span><input type="url" id="baseUrl" value="${s.baseUrl}" placeholder="${p.baseUrl || "https://…/v1"}"></label>
          <p class="note-small" id="providerHelp"></p>
          <div class="row"><button class="btn" id="saveModel">${t("Save")}</button><button class="btn ghost" id="testModel">${t("Test connection")}</button><span id="testResult" class="note-small"></span></div>
        </div>
      </section>
      <section class="panel" id="accountPanel"></section>
      <section class="panel">
        <h2>${t("Research & assignments")}</h2>
        <p class="sub">${t("Paste an assignment or rubric to get a checklist and a schedule back from the due date, with your related notes and YouTube sources beside it.")}</p>
        <div class="row"><button class="btn ghost" id="openResearch">${t("Open research & assignments")}</button></div>
      </section>
      <section class="panel">
        <h2>${t("Voice")}</h2>
        <label class="row"><input type="checkbox" id="speak" ${raw(s.speak !== false ? "checked" : "")}> ${t("Read answers aloud in talk mode")}</label>
      </section>
      <section class="panel">
        <h2>${t("Connection server")}</h2>
          <p class="note-small" style="margin:8px 0">${t("Devices find each other through a public message service. Only connection setup passes through it; your data goes directly between devices, encrypted. You can use your own ntfy server instead.")}</p>
          <div class="row"><input type="url" id="signal" value="${s.signalServer}" aria-label="${t("Message server address")}" style="flex:1"><button class="btn ghost small" id="saveSignal">${t("Save")}</button></div>
          <label class="field"><span class="label">${t("STUN and TURN servers (optional)")}</span>
            <textarea id="ice" rows="3" class="mono" placeholder='[{ "urls": "turn:turn.example.org:3478", "username": "me", "credential": "secret" }]'>${s.iceServers || ""}</textarea></label>
          <p class="note-small">${t("By default devices learn their address from Google's and Cloudflare's STUN servers. A TURN server of your own lets devices connect on networks that block direct connections. See docs/SELF-HOSTING.md.")}</p>
          <div class="row"><button class="btn ghost small" id="saveIce">${t("Save servers")}</button></div>
      </section>
        </div>
      </details>
      <p class="note-small">${t("Seekto is free and open source.")} <a href="https://github.com/enrjgy-tech/seekto" target="_blank" rel="noopener">${t("Source code")}</a></p>
    </div>`;

  const help = () => {
    const id = $("#provider").value;
    const hints = {
      ollama: t("Install Ollama, run a model (for example: ollama run llama3.2), and allow this site: set OLLAMA_ORIGINS to this site's address, then restart Ollama."),
      openrouter: t("Create a free key at openrouter.ai. Models ending in :free cost nothing (with daily limits). Paid models need credits."),
      openai: t("Use an API key from your OpenAI account. Usage is billed by OpenAI."),
      anthropic: t("Use an API key from console.anthropic.com. Usage is billed by Anthropic."),
      custom: t("Any service with an OpenAI-compatible /chat/completions endpoint, such as LM Studio or a self-hosted server."),
    };
    $("#providerHelp").textContent = hints[id] || "";
  };
  $("#provider").addEventListener("change", (e) => {
    const id = e.target.value;
    const prov = PROVIDERS[id];
    $("#providerFields").hidden = id === "none";
    $("#keyField").hidden = !(prov.needsKey || id === "custom");
    $("#urlField").hidden = !(id === "custom" || id === "ollama");
    $("#model").placeholder = modelHint(id);
    $("#baseUrl").placeholder = prov.baseUrl || "https://…/v1";
    if (id === "none") { updateSettings({ provider: "none" }); window.dispatchEvent(new Event("seekto:model")); toast(t("AI turned off")); }
    help();
  });
  help();
  const read = () => ({ provider: $("#provider").value, model: $("#model").value.trim(), apiKey: $("#apiKey").value.trim(), baseUrl: $("#baseUrl").value.trim() });
  $("#saveModel").addEventListener("click", () => {
    updateSettings(read());
    window.dispatchEvent(new Event("seekto:model"));
    toast(isReady(state.settings) ? t("Saved") : t("Saved, but a model name (and key, if needed) is still missing"));
  });
  $("#testModel").addEventListener("click", async () => {
    const out = $("#testResult");
    out.textContent = t("Testing…");
    try {
      const reply = await chat(read(), { messages: [{ role: "user", content: "Reply with the single word: ready" }], maxTokens: 10 });
      out.textContent = t('Connected. The model said: "{reply}"', { reply: reply.trim().slice(0, 40) });
    } catch (err) {
      out.textContent = err.message;
    }
  });
  main.querySelectorAll("input[name=asr]").forEach((r) => r.addEventListener("change", () => updateSettings({ transcriber: r.value })));
  $("#asrQuality").addEventListener("change", (e) => updateSettings({ asrQuality: e.target.value }));
  $("#asrLanguage").addEventListener("change", (e) => updateSettings({ asrLanguage: e.target.value }));
  $("#uiLang").addEventListener("change", (e) => { updateSettings({ uiLang: e.target.value }); location.reload(); });
  $("#asrPrepare").addEventListener("click", async (e) => {
    e.target.disabled = true;
    const out = $("#asrPrepStatus");
    try {
      const device = await prepareAsr(state.settings.asrQuality || "fast", (p) => { if (out.isConnected) out.textContent = progressText(p); });
      out.textContent = device === "webgpu" ? t("Ready. It runs on your graphics chip (WebGPU) and works offline now.") : t("Ready. It runs on your processor (WebAssembly) and works offline now.");
    } catch (err) {
      out.textContent = err.message;
      e.target.disabled = false;
    }
  });
  main.querySelectorAll("[data-setmode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.setmode)));
  $("#noSamples")?.addEventListener("click", async (e) => { await removeSamples(); e.target.remove(); toast(t("Samples removed")); });
  $("#speak").addEventListener("change", (e) => updateSettings({ speak: e.target.checked }));
  const drawDevices = () => { const box = $("#setDevices"); if (!box) return; box.innerHTML = devicesListHtml(); wireForget(box, drawDevices); };
  drawDevices();
  const offDevices = onStatus(drawDevices);
  const offAccount = renderAccount($("#accountPanel"));
  const off = () => { offDevices(); offAccount(); };
  $("#setConnect").addEventListener("click", () => window.dispatchEvent(new Event("seekto:connect")));
  $("#saveIce").addEventListener("click", () => {
    const v = $("#ice").value.trim();
    try { if (v && !JSON.parse(v).every((x) => x.urls)) throw new Error(); } catch { return toast(t('That isn\'t a valid list. Use [{ "urls": "turn:…" }].')); }
    updateSettings({ iceServers: v });
    toast(t("Saved. New connections will use these servers."));
  });
  $("#saveSignal").addEventListener("click", () => { updateSettings({ signalServer: $("#signal").value.trim() || "https://ntfy.sh" }); toast(t("Saved. Reload to use it.")); });
  $("#backup").addEventListener("click", async () => {
    const data = { app: "seekto", version: 1, exported: new Date().toISOString(), notes: await all("notes"), events: await all("events"), projects: await all("projects") };
    download(`seekto-backup-${data.exported.slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
  });
  $("#restore").addEventListener("change", async (e) => {
    try {
      const data = JSON.parse(await readFile(e.target.files[0]));
      if (data.app !== "seekto") throw new Error();
      for (const store of ["notes", "events", "projects"]) for (const item of data[store] || []) await put(store, item);
      await loadAll();
      toast(t("Backup restored"));
    } catch {
      toast(t("That isn't a Seekto backup file"));
    }
  });
  $("#wipe").addEventListener("click", async (e) => {
    if (e.target.dataset.sure !== "1") { e.target.dataset.sure = "1"; e.target.textContent = t("Tap again to delete everything"); return; }
    await clearAll();
    disconnect({ forgetKey: true });
    await loadAll();
    toast(t("Everything was deleted from this device. Your storage copy, if you have one, is untouched."));
    e.target.dataset.sure = ""; e.target.textContent = t("Delete everything");
  });
  $("#openResearch").addEventListener("click", () => go("research"));
  if (section === "ai") requestAnimationFrame(() => $("#aiPanel")?.scrollIntoView({ block: "start" }));
  if (section === "storage") requestAnimationFrame(() => $("#accountPanel")?.scrollIntoView({ block: "start" }));
  return off;
}
