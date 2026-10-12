// "Connect a device": show a code on one device, type it on the other.
import { $, html, raw, openOverlay, closeOverlay, toast } from "./ui.js";
import { me, paired, connected, hostPairing, joinPairing, onStatus, forget, renameMe } from "./devices.js";

let cancel = null;

function since(ts) {
  if (!ts) return "not synced yet";
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? "synced just now" : m < 60 ? `synced ${m} min ago` : `synced ${new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

export function devicesListHtml() {
  const on = new Set(connected().map((p) => p.id));
  const list = paired();
  if (!list.length) return `<p class="empty">No devices connected yet.</p>`;
  return list.map((p) => html`<div class="event"><span class="when">${on.has(p.id) ? "● Connected" : "Offline"}</span><span>${p.name} <span class="note-small">${since(p.lastSync)}</span></span><button class="btn ghost small" data-forget="${p.id}">Remove</button></div>`).join("");
}

export function wireForget(root, redraw) {
  root.querySelectorAll("[data-forget]").forEach((b) => b.addEventListener("click", () => { forget(b.dataset.forget); toast("Device removed"); redraw(); }));
}

export function openConnect(mode = "choose") {
  cancel?.();
  cancel = null;
  let off = () => {};
  const sheet = openOverlay("", () => { cancel?.(); cancel = null; off(); });
  const close = () => closeOverlay();

  function choose() {
    sheet.innerHTML = html`
      <div class="view-head"><h2>Connect a device</h2><button class="btn ghost small" data-close>Close</button></div>
      <p class="sub">Connect your phone, laptop or any other device in a few seconds. Your notes, recordings, calendar and assignments sync between them directly.</p>
      <div class="steps">
        <button class="step" data-mode="show"><b>Show a code</b><span>Use this on the device you'll keep your work on, like your computer.</span></button>
        <button class="step" data-mode="enter"><b>Enter a code</b><span>Use this on the device you're adding, like your phone.</span></button>
      </div>
      <span class="label">This device</span>
      <div class="row"><input type="text" id="myName" value="${me().name}" aria-label="This device's name" style="flex:1"><button class="btn ghost small" id="saveName">Rename</button></div>
      <span class="label">Your devices</span>
      <div class="agenda" id="devList">${raw(devicesListHtml())}</div>`;
    wire();
    sheet.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => (b.dataset.mode === "show" ? show() : enter())));
    $("#saveName", sheet).addEventListener("click", () => { renameMe($("#myName", sheet).value); toast("Renamed"); });
    wireForget(sheet, () => { $("#devList", sheet).innerHTML = devicesListHtml(); wireForget(sheet, choose); });
  }

  function show() {
    sheet.innerHTML = html`
      <div class="view-head"><h2>Show a code</h2><button class="btn ghost small" data-close>Close</button></div>
      <p class="sub">On your other device, open Seekto, choose <b>Connect a device</b>, then <b>Enter a code</b>.</p>
      <div id="codeBox" class="mono" style="font-size:44px;letter-spacing:0.18em;text-align:center;padding:12px 0">······</div>
      <p class="note-small" id="codeStatus" style="text-align:center">Getting a code…</p>
      <div id="request"></div>`;
    wire();
    cancel = hostPairing({
      onCode(code) {
        $("#codeBox", sheet).textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
        $("#codeStatus", sheet).textContent = "Waiting for your other device. The code works for 10 minutes.";
      },
      onRequest({ name }) {
        return new Promise((resolve) => {
          $("#request", sheet).innerHTML = html`<div class="qcard"><b>${name} wants to connect.</b><p class="sub">Only allow it if it's your device. It will get a copy of your notes, recordings, calendar and assignments.</p><div class="row"><button class="btn" data-allow>Allow</button><button class="btn ghost" data-deny>Don't allow</button></div></div>`;
          $("[data-allow]", sheet).addEventListener("click", () => { $("#request", sheet).innerHTML = `<p class="note-small">Connecting…</p>`; resolve(true); });
          $("[data-deny]", sheet).addEventListener("click", () => { $("#request", sheet).innerHTML = ""; resolve(false); });
        });
      },
      onPaired(peer) { done(peer); },
      onError(err) { $("#codeStatus", sheet).textContent = err.message; },
    });
  }

  function enter() {
    sheet.innerHTML = html`
      <div class="view-head"><h2>Enter a code</h2><button class="btn ghost small" data-close>Close</button></div>
      <p class="sub">On your other device, open Seekto, choose <b>Connect a device</b>, then <b>Show a code</b>.</p>
      <form id="codeForm" class="row"><input type="text" id="codeIn" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7M 2P9" aria-label="Code" class="mono" style="flex:1;font-size:24px;letter-spacing:0.15em;text-transform:uppercase"><button class="btn">Connect</button></form>
      <p class="note-small" id="joinStatus"></p>`;
    wire();
    $("#codeIn", sheet).focus();
    $("#codeForm", sheet).addEventListener("submit", (e) => {
      e.preventDefault();
      cancel?.();
      $("#joinStatus", sheet).textContent = "Looking for the other device…";
      cancel = joinPairing($("#codeIn", sheet).value, {
        onWaiting() { $("#joinStatus", sheet).textContent = "Found the code. Tap Allow on the other device."; },
        onPaired(peer) { done(peer); },
        onError(err) { $("#joinStatus", sheet).textContent = err.message; },
      });
    });
  }

  function done(peer) {
    cancel = null;
    sheet.innerHTML = html`
      <div class="view-head"><h2>Connected</h2><button class="btn ghost small" data-close>Done</button></div>
      <p style="font-size:18px">This device and <b>${peer.name}</b> are connected.</p>
      <p class="sub">They sync now and whenever both have Seekto open. Recordings from your phone show up on your computer by themselves.</p>`;
    wire();
  }

  function wire() {
    sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  }

  off = onStatus(() => { const list = $("#devList", sheet); if (list) { list.innerHTML = devicesListHtml(); wireForget(sheet, choose); } });
  if (mode === "show") show(); else if (mode === "enter") enter(); else choose();
}
