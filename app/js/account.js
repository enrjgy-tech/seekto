// Settings > Account and storage: set up your own storage, join with a key, or get the
// account from a connected device. Seekto doesn't host anyone's data.
import { $, html, raw, toast, download, copy, openOverlay, closeOverlay } from "./ui.js";
import { account, onCloud, testStorage, newKey, connectAccount, disconnect, deleteCloudCopy, changeKey, recoveryKit, syncNow, startCloud } from "./cloud.js";
import { connected, requestAccount, onStatus } from "./devices.js";
import { isValidAccountKey, normalizeAccountKey, formatAccountKey } from "../engine/index.js";

function ago(ts) {
  if (!ts) return "not synced yet";
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? "synced just now" : m < 60 ? `synced ${m} min ago` : `synced ${new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}
const host = (url) => String(url || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const lastGroup = (key) => formatAccountKey(key).split("-").pop();

/** Draw the panel into `box`; returns a cleanup function. */
export function renderAccount(box) {
  const draw = () => {
    if (!box.isConnected) return;
    const a = account();
    const devices = connected();
    if (!a?.key) {
      box.innerHTML = html`
        <h2>Account and storage</h2>
        <p class="sub">Optional. Keep an encrypted copy of your notes, recordings, calendar and assignments in storage you own, so your devices stay in sync even when they aren't on at the same time. There's no sign-up: your account is a key that only you hold. Seekto never hosts your data.</p>
        <div class="row">
          <button class="btn" data-acct="setup">Set up storage</button>
          <button class="btn ghost" data-acct="join">I have an account key</button>
          ${raw(devices.length ? `<button class="btn ghost" data-acct="device">Get it from a connected device</button>` : "")}
        </div>`;
    } else if (a.enabled) {
      const status = a.gone
        ? `<p class="sub" role="alert">${html`${a.error}`} Enter the new key, or set this device up again.</p>`
        : a.error
          ? `<p class="sub" role="alert">Couldn't sync: ${html`${a.error}`}</p>`
          : `<p class="sub">On. Encrypted copy in <b>${html`${host(a.url)}`}</b> · ${a.syncing ? "syncing…" : ago(a.lastSync)}</p>`;
      box.innerHTML = html`
        <h2>Account and storage</h2>
        ${raw(status)}
        <div class="row">
          ${raw(a.gone
            ? `<button class="btn" data-acct="join">Enter the new key</button><button class="btn ghost" data-acct="forget">Forget the old key</button>`
            : `<button class="btn" data-acct="sync">Sync now</button><button class="btn ghost" data-acct="show">Show account key</button><button class="btn ghost" data-acct="kit">Download recovery kit</button>`)}
        </div>
        <details><summary class="note-small" style="cursor:pointer">More</summary>
          <div class="row" style="margin-top:10px">
            <button class="btn ghost small" data-acct="change">Change account key</button>
            <button class="btn ghost small" data-acct="off">Turn off on this device</button>
            <button class="btn ghost small" data-acct="delete">Delete the storage copy</button>
          </div>
          <p class="note-small" style="margin-top:8px">Changing the key encrypts everything again and deletes the old copy, so a lost device or a key someone saw stops working. Your other devices will ask for the new key.</p>
        </details>`;
    } else {
      box.innerHTML = html`
        <h2>Account and storage</h2>
        <p class="sub">Off on this device. Your storage at <b>${host(a.url)}</b> still has its copy.</p>
        <div class="row"><button class="btn" data-acct="on">Turn back on</button><button class="btn ghost" data-acct="forget">Forget the key on this device</button></div>`;
    }
    wire();
  };

  function wire() {
    const on = (name, fn) => box.querySelector(`[data-acct="${name}"]`)?.addEventListener("click", fn);
    on("setup", () => setupWizard());
    on("join", () => joinWizard());
    on("device", () => fromDevice());
    on("sync", () => syncNow());
    on("show", () => showKey());
    on("kit", () => download("seekto-recovery-kit.txt", recoveryKit()));
    on("change", () => changeKeyFlow());
    on("on", async () => { const a = account(); try { await connectAccount(a); toast("Storage sync is on"); } catch (err) { toast(err.message); } });
    on("off", () => { disconnect(); toast("Storage sync is off on this device"); });
    on("forget", () => { disconnect({ forgetKey: true }); toast("The key was removed from this device"); });
    on("delete", (e) => {
      const b = e.target;
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Tap again: delete it for good"; return; }
      deleteCloudCopy().then(() => toast("The storage copy was deleted. Your devices keep theirs.")).catch((err) => toast(err.message));
    });
  }

  draw();
  const offA = onCloud(draw);
  const offB = onStatus(draw);
  return () => { offA(); offB(); };
}

// ---------- Step 1: storage ----------
function storageFields(sheet, { url = "", apiKey = "" } = {}) {
  return html`
    <label class="field"><span class="label">Project URL</span><input type="url" id="sbUrl" value="${url}" placeholder="https://abcd1234.supabase.co" autocomplete="off" spellcheck="false"></label>
    <label class="field"><span class="label">Publishable key (or anon key)</span><input type="text" id="sbKey" value="${apiKey}" placeholder="sb_publishable_…" autocomplete="off" spellcheck="false"></label>`;
}

async function runTest(sheet) {
  const out = $("#sbTest", sheet);
  out.innerHTML = `<p class="note-small">Checking…</p>`;
  try {
    const lines = await testStorage($("#sbUrl", sheet).value, $("#sbKey", sheet).value.trim());
    out.innerHTML = lines.map((l) => html`<p class="note-small">${l.ok ? "✓" : "⚠"} ${l.text}</p>`).join("");
    return lines.every((l) => l.ok);
  } catch (err) {
    out.innerHTML = html`<p class="note-small" role="alert">${err.message}</p>`;
    return false;
  }
}

function setupWizard() {
  const sheet = openOverlay("");
  const state = { url: "", apiKey: "", key: newKey() };

  function step1() {
    sheet.innerHTML = html`
      <div class="view-head"><h2>Set up your storage</h2><button class="btn ghost small" data-close>Close</button></div>
      <p class="sub">Step 1 of 2. Your data goes to a free Supabase project that you own. It takes about three minutes, once.</p>
      <ol class="sub" style="padding-left:20px;display:grid;gap:6px">
        <li>Create a free project at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com</a>.</li>
        <li>Open <b>SQL Editor</b>, paste the setup script and press <b>Run</b>.</li>
        <li>Copy the <b>Project URL</b> and the <b>publishable key</b> (under Connect, or Project Settings → API Keys) into the boxes below.</li>
      </ol>
      <div class="row"><button class="btn ghost small" id="copySql">Copy setup script</button><a class="btn ghost small" href="supabase.sql" download="seekto-supabase.sql">Download it</a></div>
      ${raw(storageFields(sheet, state))}
      <div id="sbTest"></div>
      <div class="row"><button class="btn" id="next">Test and continue</button></div>`;
    wireClose();
    $("#copySql", sheet).addEventListener("click", async () => {
      try { copy(await (await fetch("supabase.sql")).text(), "Setup script copied"); } catch { toast("Couldn't load the script. Use Download instead."); }
    });
    $("#next", sheet).addEventListener("click", async () => {
      if (!(await runTest(sheet))) return;
      state.url = $("#sbUrl", sheet).value.trim();
      state.apiKey = $("#sbKey", sheet).value.trim();
      step2();
    });
  }

  function step2() {
    sheet.innerHTML = html`
      <div class="view-head"><h2>Your account key</h2><button class="btn ghost small" data-close>Close</button></div>
      <p class="sub">Step 2 of 2. This key is your account: no email, no password. It encrypts everything before it leaves this device, so your storage can't read it either.</p>
      <div class="mono" id="theKey" style="font-size:22px;letter-spacing:0.08em;text-align:center;padding:14px 0;word-break:break-word">${state.key}</div>
      <div class="row" style="justify-content:center"><button class="btn ghost small" id="copyKey">Copy</button><button class="btn ghost small" id="kit">Download recovery kit</button></div>
      <p class="sub"><b>Save it somewhere safe now.</b> If you lose this key and all your devices, nobody, including Seekto, can get your data back. Anyone who has it can read your notes.</p>
      <label class="field"><span class="label">To check you saved it, type the last four characters</span><input type="text" id="confirmKey" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" class="mono" style="text-transform:uppercase;letter-spacing:0.15em"></label>
      <p class="note-small" id="connectStatus"></p>
      <div class="row"><button class="btn" id="turnOn" disabled>Turn on sync</button><button class="btn ghost" id="back">Back</button></div>`;
    wireClose();
    const draft = { key: state.key, url: state.url, apiKey: state.apiKey };
    $("#copyKey", sheet).addEventListener("click", () => copy(state.key, "Key copied"));
    $("#kit", sheet).addEventListener("click", () => download("seekto-recovery-kit.txt", recoveryKit(draft)));
    $("#back", sheet).addEventListener("click", step1);
    $("#confirmKey", sheet).addEventListener("input", (e) => { $("#turnOn", sheet).disabled = normalizeAccountKey(e.target.value) !== lastGroup(state.key); });
    $("#turnOn", sheet).addEventListener("click", async (e) => {
      e.target.disabled = true;
      $("#connectStatus", sheet).textContent = "Encrypting and uploading…";
      try {
        const a = await connectAccount(draft);
        if (a.error) throw new Error(a.error);
        done("Storage sync is on", "Your notes, recordings, calendar and assignments are now kept encrypted in your storage. To add another device, connect it with a code and choose Get it from a connected device in Settings, or enter your key there.");
      } catch (err) {
        $("#connectStatus", sheet).textContent = err.message;
        e.target.disabled = false;
      }
    });
  }

  function done(title, text) {
    sheet.innerHTML = html`<div class="view-head"><h2>${title}</h2><button class="btn ghost small" data-close>Done</button></div><p class="sub">${text}</p>`;
    wireClose();
  }
  function wireClose() { sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeOverlay)); }
  step1();
}

// ---------- Joining with a key ----------
function joinWizard() {
  const prev = account() || {};
  const sheet = openOverlay("");
  sheet.innerHTML = html`
    <div class="view-head"><h2>Use your account key</h2><button class="btn ghost small" data-close>Close</button></div>
    <p class="sub">Your recovery kit has all three of these.</p>
    <label class="field"><span class="label">Account key</span><input type="text" id="acctKey" autocomplete="off" autocapitalize="characters" spellcheck="false" class="mono" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" style="text-transform:uppercase;letter-spacing:0.06em"></label>
    ${raw(storageFields(sheet, prev))}
    <div id="sbTest"></div>
    <div class="row"><button class="btn" id="joinGo">Connect</button></div>`;
  sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeOverlay));
  $("#joinGo", sheet).addEventListener("click", async (e) => {
    const key = $("#acctKey", sheet).value;
    if (!isValidAccountKey(key)) { $("#sbTest", sheet).innerHTML = `<p class="note-small" role="alert">That key isn't right. It's 24 letters and numbers; check each one.</p>`; return; }
    e.target.disabled = true;
    if (!(await runTest(sheet))) { e.target.disabled = false; return; }
    try {
      const a = await connectAccount({ key, url: $("#sbUrl", sheet).value, apiKey: $("#sbKey", sheet).value });
      if (a.error) throw new Error(a.error);
      closeOverlay();
      toast("Connected to your account");
    } catch (err) {
      $("#sbTest", sheet).innerHTML = html`<p class="note-small" role="alert">${err.message}</p>`;
      e.target.disabled = false;
    }
  });
}

// ---------- Getting the account from a connected device ----------
function fromDevice() {
  const sheet = openOverlay("");
  const devices = connected();
  sheet.innerHTML = html`
    <div class="view-head"><h2>Get your account from a device</h2><button class="btn ghost small" data-close>Close</button></div>
    <p class="sub">Choose the device that already has your account. It will ask you to allow this.</p>
    <div class="agenda">${raw(devices.map((d) => html`<button class="event" data-peer="${d.id}" style="cursor:pointer;text-align:left"><span class="when">● Connected</span><span>${d.name}</span></button>`).join(""))}</div>
    <div id="askStatus"></div>`;
  sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeOverlay));
  sheet.querySelectorAll("[data-peer]").forEach((b) => b.addEventListener("click", async () => {
    const out = $("#askStatus", sheet);
    try {
      const { code, result } = await requestAccount(b.dataset.peer);
      out.innerHTML = html`<p class="sub">On <b>${b.textContent.replace("● Connected", "").trim()}</b>, check that it shows</p><div class="mono" style="font-size:40px;letter-spacing:0.2em;text-align:center">${code}</div><p class="sub">then tap Allow there.</p>`;
      const got = await result;
      out.innerHTML = `<p class="note-small">Connecting to your storage…</p>`;
      const a = await connectAccount(got);
      if (a.error) throw new Error(a.error);
      closeOverlay();
      toast("Connected to your account");
    } catch (err) {
      out.innerHTML = html`<p class="note-small" role="alert">${err.message}</p>`;
    }
  }));
}

/** The prompt on the device that has the account. */
export function askToShareAccount({ name, code, respond }) {
  const sheet = openOverlay("", () => respond(false));
  sheet.innerHTML = html`
    <div class="view-head"><h2>${name} is asking for your account</h2></div>
    <p class="sub">It will be able to read and change everything in your storage. Only allow it if it's your device and it shows this number:</p>
    <div class="mono" style="font-size:40px;letter-spacing:0.2em;text-align:center;padding:8px 0">${code}</div>
    <div class="row"><button class="btn" data-allow>Allow</button><button class="btn ghost" data-deny>Don't allow</button></div>`;
  $("[data-allow]", sheet).addEventListener("click", () => { respond(true); closeOverlay(); toast(`Sent to ${name}`); });
  $("[data-deny]", sheet).addEventListener("click", () => closeOverlay());
}

// ---------- Showing and changing the key ----------
function showKey() {
  const a = account();
  const sheet = openOverlay("");
  sheet.innerHTML = html`
    <div class="view-head"><h2>Your account key</h2><button class="btn ghost small" data-close>Close</button></div>
    <p class="sub">Anyone with this key can read your Seekto data. Don't share it or post it.</p>
    <div class="mono" style="font-size:22px;letter-spacing:0.08em;text-align:center;padding:14px 0;word-break:break-word">${a.key}</div>
    <div class="row" style="justify-content:center"><button class="btn ghost small" id="copyKey">Copy</button><button class="btn ghost small" id="kit">Download recovery kit</button></div>`;
  sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeOverlay));
  $("#copyKey", sheet).addEventListener("click", () => copy(a.key, "Key copied"));
  $("#kit", sheet).addEventListener("click", () => download("seekto-recovery-kit.txt", recoveryKit()));
}

function changeKeyFlow() {
  const sheet = openOverlay("");
  sheet.innerHTML = html`
    <div class="view-head"><h2>Change your account key?</h2><button class="btn ghost small" data-close>Cancel</button></div>
    <p class="sub">Seekto makes a new key, encrypts everything again with it, uploads it and deletes the old copy. Anyone with the old key, including a lost device, loses access. Your other devices will ask for the new key.</p>
    <p class="note-small" id="chStatus"></p>
    <div class="row"><button class="btn" id="chGo">Change key</button></div>`;
  sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeOverlay));
  $("#chGo", sheet).addEventListener("click", async (e) => {
    e.target.disabled = true;
    $("#chStatus", sheet).textContent = "Encrypting everything with the new key…";
    try {
      await changeKey();
      showKey();
      toast("New key made. Save the new recovery kit.");
    } catch (err) {
      $("#chStatus", sheet).textContent = err.message;
      e.target.disabled = false;
    }
  });
}

export { startCloud };
