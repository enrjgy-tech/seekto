// "Connect a device": show a code on one device, type it on the other.
import { $, html, raw, openOverlay, closeOverlay, toast } from "./ui.js";
import { me, paired, connected, hostPairing, joinPairing, onStatus, forget, renameMe } from "./devices.js";
import { t, uiLocale } from "./i18n.js";

let cancel = null;

function since(ts) {
  if (!ts) return t("not synced yet");
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? t("synced just now") : m < 60 ? t("synced {n} min ago", { n: m }) : t("synced {date}", { date: new Date(ts).toLocaleString(uiLocale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) });
}

export function devicesListHtml() {
  const on = new Set(connected().map((p) => p.id));
  const list = paired();
  if (!list.length) return `<p class="empty">${t("No devices connected yet.")}</p>`;
  return list.map((p) => html`<div class="event"><span class="when">${on.has(p.id) ? `● ${t("Connected")}` : t("Offline")}</span><span>${p.name} <span class="note-small">${since(p.lastSync)}</span></span><button class="btn ghost small" data-forget="${p.id}">${t("Remove")}</button></div>`).join("");
}

export function wireForget(root, redraw) {
  root.querySelectorAll("[data-forget]").forEach((b) => b.addEventListener("click", () => { forget(b.dataset.forget); toast(t("Device removed")); redraw(); }));
}

export function openConnect(mode = "choose") {
  cancel?.();
  cancel = null;
  let off = () => {};
  const sheet = openOverlay("", () => { cancel?.(); cancel = null; off(); });
  const close = () => closeOverlay();

  function choose() {
    sheet.innerHTML = html`
      <div class="view-head"><h2>${t("Connect a device")}</h2><button class="btn ghost small" data-close>${t("Close")}</button></div>
      <p class="sub">${t("Connect your phone, laptop or any other device in a few seconds. Your notes, recordings, calendar and assignments sync between them directly.")}</p>
      <div class="steps">
        <button class="step" data-mode="show"><b>${t("Show a code")}</b><span>${t("Use this on the device you'll keep your work on, like your computer.")}</span></button>
        <button class="step" data-mode="enter"><b>${t("Enter a code")}</b><span>${t("Use this on the device you're adding, like your phone.")}</span></button>
      </div>
      <span class="label">${t("This device")}</span>
      <div class="row"><input type="text" id="myName" value="${me().name}" aria-label="${t("This device's name")}" style="flex:1"><button class="btn ghost small" id="saveName">${t("Rename")}</button></div>
      <span class="label">${t("Your devices")}</span>
      <div class="agenda" id="devList">${raw(devicesListHtml())}</div>`;
    wire();
    sheet.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => (b.dataset.mode === "show" ? show() : enter())));
    $("#saveName", sheet).addEventListener("click", () => { renameMe($("#myName", sheet).value); toast(t("Renamed")); });
    wireForget(sheet, () => { $("#devList", sheet).innerHTML = devicesListHtml(); wireForget(sheet, choose); });
  }

  function show() {
    sheet.innerHTML = html`
      <div class="view-head"><h2>${t("Show a code")}</h2><button class="btn ghost small" data-close>${t("Close")}</button></div>
      <p class="sub">${raw(t("On your other device, open Seekto, choose <b>Connect a device</b>, then <b>Enter a code</b>."))}</p>
      <div id="codeBox" class="mono" style="font-size:44px;letter-spacing:0.18em;text-align:center;padding:12px 0">······</div>
      <p class="note-small" id="codeStatus" style="text-align:center">${t("Getting a code…")}</p>
      <div id="request"></div>`;
    wire();
    cancel = hostPairing({
      onCode(code) {
        $("#codeBox", sheet).textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
        $("#codeStatus", sheet).textContent = t("Waiting for your other device. The code works for 10 minutes.");
      },
      onRequest({ name, check }) {
        return new Promise((resolve) => {
          $("#request", sheet).innerHTML = html`<div class="qcard"><b>${t("{name} wants to connect.", { name })}</b><p class="sub">${t("Check that it shows the same number:")}</p><div class="mono check-number">${check}</div><p class="sub">${t("Allow only if the numbers match and it's your device. It will get a copy of your notes, recordings, calendar and assignments.")}</p><div class="row"><button class="btn" data-allow>${t("The numbers match, allow")}</button><button class="btn ghost" data-deny>${t("Don't allow")}</button></div></div>`;
          $("[data-allow]", sheet).focus();
          $("[data-allow]", sheet).addEventListener("click", () => { $("#request", sheet).innerHTML = `<p class="note-small">${t("Waiting for the other device to confirm the number…")}</p>`; resolve(true); });
          $("[data-deny]", sheet).addEventListener("click", () => { $("#request", sheet).innerHTML = ""; resolve(false); });
        });
      },
      onPaired(peer) { done(peer); },
      onError(err) { $("#codeStatus", sheet).textContent = err.message; },
    });
  }

  function enter() {
    sheet.innerHTML = html`
      <div class="view-head"><h2>${t("Enter a code")}</h2><button class="btn ghost small" data-close>${t("Close")}</button></div>
      <p class="sub">${raw(t("On your other device, open Seekto, choose <b>Connect a device</b>, then <b>Show a code</b>."))}</p>
      <form id="codeForm" class="row"><input type="text" id="codeIn" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7M 2P9" aria-label="${t("Code")}" class="mono" style="flex:1;font-size:24px;letter-spacing:0.15em;text-transform:uppercase"><button class="btn">${t("Connect")}</button></form>
      <p class="note-small" id="joinStatus" role="status" aria-live="polite" style="display:grid;gap:6px"></p>`;
    wire();
    $("#codeIn", sheet).focus();
    $("#codeForm", sheet).addEventListener("submit", (e) => {
      e.preventDefault();
      cancel?.();
      $("#joinStatus", sheet).textContent = t("Looking for the other device…");
      cancel = joinPairing($("#codeIn", sheet).value, {
        onWaiting() { $("#joinStatus", sheet).textContent = t("Looking for the device showing the code…"); },
        onCheck(check) {
          return new Promise((resolve) => {
            $("#joinStatus", sheet).innerHTML = html`<span class="sub">${t("Check that the other device shows the same number:")}</span><span class="mono check-number">${check}</span><span class="row"><button type="button" class="btn" data-same>${t("The numbers match")}</button><button type="button" class="btn ghost" data-differ>${t("They don't match")}</button></span>`;
            $("[data-same]", sheet).focus();
            $("[data-same]", sheet).addEventListener("click", () => { $("#joinStatus", sheet).textContent = t("Now tap Allow on the other device."); resolve(true); });
            $("[data-differ]", sheet).addEventListener("click", () => { $("#joinStatus", sheet).textContent = t("Not connected. Nothing was shared. Try again with a new code."); resolve(false); });
          });
        },
        onPaired(peer) { done(peer); },
        onError(err) { $("#joinStatus", sheet).textContent = err.message; },
      });
    });
  }

  function done(peer) {
    cancel = null;
    sheet.innerHTML = html`
      <div class="view-head"><h2>${t("Connected")}</h2><button class="btn ghost small" data-close>${t("Done")}</button></div>
      <p style="font-size:18px">${raw(t("This device and <b>{name}</b> are connected.", { name: html`${peer.name}` }))}</p>
      <p class="sub">${t("They sync now and whenever both have Seekto open. Recordings from your phone show up on your computer by themselves.")}</p>`;
    wire();
  }

  function wire() {
    sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  }

  off = onStatus(() => { const list = $("#devList", sheet); if (list) { list.innerHTML = devicesListHtml(); wireForget(sheet, choose); } });
  if (mode === "show") show(); else if (mode === "enter") enter(); else choose();
}
