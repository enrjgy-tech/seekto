// Small helpers shared by every view.
import { t, uiLocale } from "./i18n.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/** Tagged template that escapes interpolated values unless they are wrapped with raw(). */
export function html(strings, ...values) {
  return strings.reduce((out, s, i) => {
    if (i >= values.length) return out + s;
    const v = values[i];
    const text =
      v && v.__raw !== undefined
        ? v.__raw
        : Array.isArray(v)
          ? v.map((x) => (x && x.__raw !== undefined ? x.__raw : esc(x))).join("")
          : esc(v);
    return out + s + text;
  }, "");
}
export const raw = (value) => ({ __raw: String(value) });

/** Say something to screen readers without showing it. */
export function announce(message) {
  const el = $("#sr");
  if (!el) return;
  el.textContent = "";
  setTimeout(() => (el.textContent = message), 50);
}

let toastTimer;
/** Hide the current message, for example when the person moves to another screen. */
// A message shown right before moving ("Saved. Added 2 dates…") stays; older ones go.
let toastAt = 0;
export function clearToast(force = false) {
  // A toast shown a moment ago (just before a screen change it caused) stays, unless forced
  if (!force && Date.now() - toastAt < 800) return;
  clearTimeout(toastTimer);
  const el = $("#toast");
  if (el) el.hidden = true;
}
/** A short message at the top of the screen, also read out by screen readers. */
export function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  announce(message); // the toast appears and fills in the same moment, which some screen readers skip
  toastAt = Date.now();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), Math.max(2400, message.length * 60));
}

/** Save text as a file (works on the hosted site). */
export function download(filename, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copy(text, ok = t("Copied")) {
  try {
    await navigator.clipboard.writeText(text);
    toast(ok);
  } catch {
    toast(t("Couldn't copy. Select the text and copy it yourself."));
  }
}

let onOverlayClose = null;
let opener = null;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * Open a dialog. Focus moves into it, Tab stays inside it, Esc closes it, and focus goes back
 * to whatever opened it. The dialog is named by its first heading.
 */
let namer = null;
export function openOverlay(content, onClose = null) {
  clearToast(true); // a message about the screen behind doesn't belong on a new dialog
  onOverlayClose?.();
  onOverlayClose = onClose;
  if (!document.querySelector(".overlay")) opener = document.activeElement;
  const root = $("#overlay");
  root.innerHTML = `<div class="overlay" role="dialog" aria-modal="true"><div class="sheet" tabindex="-1">${content}</div></div>`;
  const dialog = $(".overlay", root);
  const sheet = $(".sheet", root);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeOverlay();
  });
  document.addEventListener("keydown", onKey);
  for (const el of document.querySelectorAll(".app")) el.inert = true;
  // Name the dialog after its heading, whenever its content changes.
  const name = () => {
    const h = sheet.querySelector("h1, h2, h3");
    if (h) {
      h.id ||= "dialogTitle";
      dialog.setAttribute("aria-labelledby", h.id);
    }
  };
  namer?.disconnect();
  namer = new MutationObserver(name);
  namer.observe(sheet, { childList: true });
  name();
  requestAnimationFrame(() => {
    if (!sheet.contains(document.activeElement)) (sheet.querySelector("input, textarea, select") || sheet).focus();
  });
  return sheet;
}

function onKey(e) {
  if (e.key === "Escape") return closeOverlay();
  if (e.key !== "Tab") return;
  const sheet = $(".overlay .sheet");
  if (!sheet) return;
  const items = [...sheet.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) {
    e.preventDefault();
    return sheet.focus();
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function closeOverlay() {
  namer?.disconnect();
  namer = null;
  const fn = onOverlayClose;
  onOverlayClose = null;
  fn?.();
  $("#overlay").innerHTML = "";
  document.removeEventListener("keydown", onKey);
  for (const el of document.querySelectorAll(".app")) el.inert = false;
  window.speechSynthesis?.cancel();
  if (opener && document.contains(opener)) opener.focus();
  opener = null;
}

export function friendlyDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(uiLocale(), { weekday: "short", month: "short", day: "numeric" });
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
