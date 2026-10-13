// The interface in English, Spanish and Portuguese. Strings are written in English in the code
// and wrapped in t(); app/i18n/<lang>.js maps each English string to its translation.
// `npm run i18n` lists strings that are missing a translation (CI fails on any).
import { loadSettings } from "./store.js";
import es from "../i18n/es.js";
import pt from "../i18n/pt.js";

export const LANGUAGES = [["en", "English"], ["es", "Español"], ["pt", "Português"]];
const DICTS = { es, pt };

function pick() {
  const chosen = loadSettings().uiLang;
  if (chosen && chosen !== "auto") return chosen;
  const nav = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  return nav.startsWith("es") ? "es" : nav.startsWith("pt") ? "pt" : "en";
}

export let lang = pick();
document.documentElement.lang = lang;

/** Re-read the language after it changes in Settings. */
export function refreshLang() {
  lang = pick();
  document.documentElement.lang = lang;
  translatePage();
}

/** Translate an English string; {name} placeholders are filled from `vars`. */
export function t(text, vars) {
  const out = (lang !== "en" && DICTS[lang]?.[text]) || text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

/** The locale for dates and numbers in the interface, like "es-MX" or "pt-BR". */
export function uiLocale() {
  const nav = String(navigator.languages?.[0] || navigator.language || "en-US").split(/[@.]/)[0].replace("_", "-");
  let valid = nav;
  try { [valid] = Intl.getCanonicalLocales(nav); } catch { valid = ""; }
  if (valid && valid.toLowerCase().startsWith(lang)) return valid;
  return { en: "en-US", es: "es", pt: "pt-BR" }[lang];
}

/** The language for the browser's speech service. */
export function speechLang() {
  return uiLocale().includes("-") ? uiLocale() : { es: "es-ES", pt: "pt-BR", en: "en-US" }[lang];
}

/** Static text in index.html: elements with data-i18n (text) or data-i18n-label (aria-label). */
export function translatePage(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.dataset.en ??= el.lastChild?.nodeType === 3 ? el.lastChild.textContent : el.textContent;
    const target = el.lastChild?.nodeType === 3 ? el.lastChild : el;
    target.textContent = t(el.dataset.en.trim());
  }
  for (const el of root.querySelectorAll("[data-i18n-label]")) el.setAttribute("aria-label", t(el.dataset.i18nLabel));
}

/** A line for AI prompts, so the model answers in the interface language. */
export function replyIn() {
  return { en: "", es: " Reply in Spanish.", pt: " Reply in Brazilian Portuguese." }[lang] || "";
}
