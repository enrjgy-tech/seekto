// App shell: loads data, routes between views by the URL hash, and keeps the nav in sync.
import { $, $$ } from "./ui.js";
import { go } from "./nav.js";
import { state, loadAll } from "./state.js";
import { PROVIDERS, isReady } from "../engine/index.js";
import * as chat from "./chat.js";
import * as record from "./record.js";
import * as notes from "./notes.js";
import * as calendar from "./calendar.js";
import * as research from "./research.js";
import * as settings from "./settings.js";

const views = {
  chat: chat.render,
  record: record.render,
  notes: notes.renderList,
  note: notes.renderDetail,
  calendar: calendar.render,
  research: research.renderList,
  project: research.renderDetail,
  settings: settings.render,
};

let cleanup = null;

function render() {
  const [name, param] = (location.hash.slice(1) || "chat").split("/");
  const view = views[name] ? name : "chat";
  const top = { note: "notes", project: "research" }[view] || view;
  for (const b of $$("[data-go]")) {
    if (b.dataset.go === top) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  if (typeof cleanup === "function") cleanup();
  const main = $("#main");
  main.innerHTML = "";
  main.className = view === "chat" ? "chat" : "";
  main.scrollTop = 0;
  cleanup = views[view](main, param ? decodeURIComponent(param) : undefined) || null;
  updateModelPill();
}

function updateModelPill() {
  const s = state.settings;
  $("#modelPill").textContent = isReady(s) ? `AI: ${PROVIDERS[s.provider].label}` : "AI: off (works offline)";
}

for (const b of $$("[data-go]")) b.addEventListener("click", () => go(b.dataset.go));
window.addEventListener("hashchange", render);
window.addEventListener("seekto:render", render);
window.addEventListener("seekto:model", updateModelPill);

await loadAll();
render();
