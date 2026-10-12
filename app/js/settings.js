// Settings: which AI model to use (or none), voice, and your data.
import { $, html, raw, toast, download, readFile } from "./ui.js";
import { state, updateSettings, loadAll } from "./state.js";
import { all, put, clearAll } from "./store.js";
import { PROVIDERS, isReady, chat } from "../engine/index.js";
import { devicesListHtml, wireForget } from "./connect.js";
import { onStatus } from "./devices.js";

const GROUPS = [
  ["No AI", ["none"]],
  ["On your computer (private, free)", ["ollama"]],
  ["Free or paid cloud", ["openrouter"]],
  ["Paid cloud", ["openai", "anthropic"]],
  ["Advanced", ["custom"]],
];

export function render(main) {
  const s = state.settings;
  const p = PROVIDERS[s.provider];
  main.innerHTML = html`
    <div class="view">
      <h1>Settings</h1>
      <section class="panel">
        <h2>AI model</h2>
        <p class="sub">Seekto works without AI: recording, notes, the calendar, quizzes from definitions and answers from your notes. An AI model adds open questions, summaries, better quizzes, research plans and briefs. Your key stays on this device and is sent only to the service you choose.</p>
        <label class="field"><span class="label">Provider</span>
          <select id="provider">${raw(GROUPS.map(([label, ids]) => `<optgroup label="${label}">${ids.map((id) => html`<option value="${id}" ${id === s.provider ? "selected" : ""}>${PROVIDERS[id].label}${id === "openrouter" ? " (free models available)" : ""}</option>`).join("")}</optgroup>`).join(""))}</select></label>
        <div id="providerFields" ${raw(s.provider === "none" ? "hidden" : "")} style="display:grid;gap:12px">
          <label class="field"><span class="label">Model</span><input type="text" id="model" value="${s.model}" placeholder="${p.modelHint || ""}"></label>
          <label class="field" id="keyField" ${raw(p.needsKey || s.provider === "custom" ? "" : "hidden")}><span class="label">API key</span><input type="password" id="apiKey" value="${s.apiKey}" autocomplete="off" placeholder="Stored only on this device"></label>
          <label class="field" id="urlField" ${raw(s.provider === "custom" || s.provider === "ollama" ? "" : "hidden")}><span class="label">Address</span><input type="url" id="baseUrl" value="${s.baseUrl}" placeholder="${p.baseUrl || "https://…/v1"}"></label>
          <p class="note-small" id="providerHelp"></p>
          <div class="row"><button class="btn" id="saveModel">Save</button><button class="btn ghost" id="testModel">Test connection</button><span id="testResult" class="note-small"></span></div>
        </div>
      </section>
      <section class="panel">
        <h2>Devices</h2>
        <p class="sub">Connect your phone, laptop and other devices with a short code. They sync directly with each other.</p>
        <div class="agenda" id="setDevices"></div>
        <div class="row"><button class="btn" id="setConnect">Connect a device</button></div>
        <details><summary class="note-small" style="cursor:pointer">Connection server</summary>
          <p class="note-small" style="margin:8px 0">Devices find each other through a public message service. Only connection setup passes through it; your data goes directly between devices, encrypted. You can use your own ntfy server instead.</p>
          <div class="row"><input type="url" id="signal" value="${s.signalServer}" style="flex:1"><button class="btn ghost small" id="saveSignal">Save</button></div>
        </details>
      </section>
      <section class="panel">
        <h2>Voice</h2>
        <label class="row"><input type="checkbox" id="speak" ${raw(s.speak !== false ? "checked" : "")}> Read answers aloud in talk mode</label>
      </section>
      <section class="panel">
        <h2>Your data</h2>
        <p class="sub">Everything is stored in this browser on this device. Back it up to move it to another device.</p>
        <div class="row">
          <button class="btn ghost" id="backup">Download backup</button>
          <label class="btn ghost" style="cursor:pointer">Restore backup<input type="file" id="restore" accept=".json" hidden></label>
          <button class="btn danger" id="wipe">Delete everything</button>
        </div>
        <p class="note-small">Recordings aren't included in backups yet.</p>
      </section>
      <p class="note-small">Seekto is free and open source. <a href="https://github.com/enrjgy-tech/seekto" target="_blank" rel="noopener">Source code</a></p>
    </div>`;

  const help = () => {
    const id = $("#provider").value;
    const hints = {
      ollama: "Install Ollama, run a model (for example: ollama run llama3.2), and allow this site: set OLLAMA_ORIGINS to this site's address, then restart Ollama.",
      openrouter: "Create a free key at openrouter.ai. Models ending in :free cost nothing (with daily limits). Paid models need credits.",
      openai: "Use an API key from your OpenAI account. Usage is billed by OpenAI.",
      anthropic: "Use an API key from console.anthropic.com. Usage is billed by Anthropic.",
      custom: "Any service with an OpenAI-compatible /chat/completions endpoint, such as LM Studio or a self-hosted server.",
    };
    $("#providerHelp").textContent = hints[id] || "";
  };
  $("#provider").addEventListener("change", (e) => {
    const id = e.target.value;
    const prov = PROVIDERS[id];
    $("#providerFields").hidden = id === "none";
    $("#keyField").hidden = !(prov.needsKey || id === "custom");
    $("#urlField").hidden = !(id === "custom" || id === "ollama");
    $("#model").placeholder = prov.modelHint || "";
    $("#baseUrl").placeholder = prov.baseUrl || "https://…/v1";
    if (id === "none") { updateSettings({ provider: "none" }); window.dispatchEvent(new Event("seekto:model")); toast("AI turned off"); }
    help();
  });
  help();
  const read = () => ({ provider: $("#provider").value, model: $("#model").value.trim(), apiKey: $("#apiKey").value.trim(), baseUrl: $("#baseUrl").value.trim() });
  $("#saveModel").addEventListener("click", () => {
    updateSettings(read());
    window.dispatchEvent(new Event("seekto:model"));
    toast(isReady(state.settings) ? "Saved" : "Saved, but a model name (and key, if needed) is still missing");
  });
  $("#testModel").addEventListener("click", async () => {
    const out = $("#testResult");
    out.textContent = "Testing…";
    try {
      const reply = await chat(read(), { messages: [{ role: "user", content: "Reply with the single word: ready" }], maxTokens: 10 });
      out.textContent = `Connected. The model said: "${reply.trim().slice(0, 40)}"`;
    } catch (err) {
      out.textContent = err.message;
    }
  });
  $("#speak").addEventListener("change", (e) => updateSettings({ speak: e.target.checked }));
  const drawDevices = () => { const box = $("#setDevices"); if (!box) return; box.innerHTML = devicesListHtml(); wireForget(box, drawDevices); };
  drawDevices();
  const off = onStatus(drawDevices);
  $("#setConnect").addEventListener("click", () => window.dispatchEvent(new Event("seekto:connect")));
  $("#saveSignal").addEventListener("click", () => { updateSettings({ signalServer: $("#signal").value.trim() || "https://ntfy.sh" }); toast("Saved. Reload to use it."); });
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
      toast("Backup restored");
    } catch {
      toast("That isn't a Seekto backup file");
    }
  });
  $("#wipe").addEventListener("click", async (e) => {
    if (e.target.dataset.sure !== "1") { e.target.dataset.sure = "1"; e.target.textContent = "Tap again to delete everything"; return; }
    await clearAll();
    await loadAll();
    toast("Everything was deleted from this device");
    e.target.dataset.sure = ""; e.target.textContent = "Delete everything";
  });
  return off;
}
