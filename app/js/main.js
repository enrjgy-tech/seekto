// App shell: loads data, routes between views by the URL hash, and keeps the nav in sync.
import { $, $$ } from "./ui.js";
import { go } from "./nav.js";
import { state, loadAll } from "./state.js";
import { PROVIDERS, isReady } from "../engine/index.js";
import * as chat from "./chat.js";
import * as home from "./home.js";
import * as record from "./record.js";
import * as notes from "./notes.js";
import * as calendar from "./calendar.js";
import * as research from "./research.js";
import * as settings from "./settings.js";
import * as shared from "./shared.js";
import { applyChrome } from "./profile.js";
import { initDevices, onStatus, connected, paired } from "./devices.js";
import { openConnect } from "./connect.js";
import { startCloud, askToShareAccount } from "./account.js";
import { toast, closeOverlay, clearToast } from "./ui.js";
import { t, translatePage } from "./i18n.js";

const views = {
  home: home.render,
  chat: chat.render,
  record: record.render,
  notes: notes.renderList,
  note: notes.renderDetail,
  calendar: calendar.render,
  research: research.renderList,
  project: research.renderDetail,
  settings: settings.render,
  shared: shared.render,
};

let cleanup = null;

// Someone who hasn't recorded, pasted or chatted yet starts on the demo; everyone else on the assistant.
function firstVisit() {
  let chatted = false;
  try { chatted = JSON.parse(sessionStorage.getItem("seekto.chat") || "[]").length > 0; } catch { /* not available */ }
  return !chatted && !state.notes.some((n) => !n.sample);
}

function route() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("s=")) return ["shared", hash.slice(2)]; // a shared practice test
  return (hash || (firstVisit() ? "home" : "chat")).split("/");
}

function render(e) {
  const [name, param] = route();
  if (document.querySelector("#overlay .overlay")) closeOverlay();
  clearToast();
  const view = views[name] ? name : "chat";
  const top = { note: "notes", project: "settings", research: "settings" }[view] || view;
  for (const b of $$("[data-go]")) {
    if (b.dataset.go === top) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  if (typeof cleanup === "function") cleanup();
  const main = $("#main");
  main.innerHTML = "";
  main.className = view === "chat" ? "chat" : view === "home" ? "home-main" : "";
  main.scrollTop = 0;
  cleanup = views[view](main, param ? (view === "shared" ? param : decodeURIComponent(param)) : undefined) || null;
  updateModelPill();
  // Tell screen readers the page changed: name the tab after the view and, when the person moved
  // to another screen, put focus on its heading.
  const heading = main.querySelector("h1, h2");
  const label = heading?.textContent.trim();
  document.title = label && !["chat", "home"].includes(view) ? `${label} · Seekto` : "Seekto";
  if (e?.type === "hashchange") {
    const target = heading || main;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}

function updateModelPill() {
  const s = state.settings;
  $("#modelPill").textContent = isReady(s) ? t("AI: {name}", { name: PROVIDERS[s.provider].label }) : t("AI: off (works offline)");
}

for (const b of $$("[data-go]")) b.addEventListener("click", () => go(b.dataset.go));
window.addEventListener("hashchange", render);
window.addEventListener("seekto:render", render);
window.addEventListener("seekto:model", updateModelPill);

function updateDevicePill() {
  const n = connected().length;
  const total = paired().length;
  $("#devicePill").textContent = total ? (n ? (n > 1 ? t("{n} devices connected", { n }) : t("1 device connected")) : t("Devices offline")) : "";
}

$("#connectBtn").addEventListener("click", () => openConnect());
window.addEventListener("seekto:account-request", (e) => askToShareAccount(e.detail));
window.addEventListener("seekto:connect", () => openConnect());
onStatus(updateDevicePill);

// When another device sends changes, refresh list views (not while someone is typing).
let syncToast = null;
window.addEventListener("seekto:synced", async (e) => {
  await loadAll();
  clearTimeout(syncToast);
  syncToast = setTimeout(() => toast(t("Synced with {name}", { name: e.detail.from })), 400);
  const name = (location.hash.slice(1) || "chat").split("/")[0];
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (["notes", "calendar", "research"].includes(name) && !typing && !document.querySelector(".overlay")) render();
});

await loadAll();
translatePage();
applyChrome();
render();
initDevices();
updateDevicePill();
startCloud();

// Keep a copy of the app for offline use (not on localhost, so development always sees fresh files).
if ("serviceWorker" in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
