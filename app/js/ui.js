// Small helpers shared by every view.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Tagged template that escapes interpolated values unless they are wrapped with raw(). */
export function html(strings, ...values) {
  return strings.reduce((out, s, i) => {
    if (i >= values.length) return out + s;
    const v = values[i];
    const text = v && v.__raw !== undefined ? v.__raw : Array.isArray(v) ? v.map((x) => (x && x.__raw !== undefined ? x.__raw : esc(x))).join("") : esc(v);
    return out + s + text;
  }, "");
}
export const raw = (value) => ({ __raw: String(value) });

let toastTimer;
export function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2400);
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

export async function copy(text, ok = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(ok);
  } catch {
    toast("Couldn't copy. Select the text and copy it yourself.");
  }
}

export function openOverlay(content) {
  const root = $("#overlay");
  root.innerHTML = `<div class="overlay" role="dialog" aria-modal="true"><div class="sheet">${content}</div></div>`;
  const sheet = $(".sheet", root);
  root.querySelector(".overlay").addEventListener("click", (e) => { if (e.target.classList.contains("overlay")) closeOverlay(); });
  document.addEventListener("keydown", escClose);
  return sheet;
}

function escClose(e) { if (e.key === "Escape") closeOverlay(); }

export function closeOverlay() {
  $("#overlay").innerHTML = "";
  document.removeEventListener("keydown", escClose);
  window.speechSynthesis?.cancel();
}

export function friendlyDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
