// Speech in and out, using what the browser provides.
// Note: in Chrome and Edge, speech recognition is processed by the browser maker's servers.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = Boolean(Recognition);
export const canSpeak = "speechSynthesis" in window;

/** Speak text aloud. Resolves when done. */
export function speak(text) {
  return new Promise((resolve) => {
    if (!canSpeak || !text) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[*_#`]/g, ""));
    u.rate = 1.02;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.speak(u);
  });
}

/** Listen for one phrase. Resolves with the text, or "" if nothing was heard. */
export function listenOnce({ lang = "en-US" } = {}) {
  return new Promise((resolve, reject) => {
    if (!canListen) return reject(new Error("This browser can't listen. Try Chrome, Edge or Safari."));
    const r = new Recognition();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    let heard = "";
    r.onresult = (e) => { heard = e.results[0][0].transcript; };
    r.onerror = (e) => (e.error === "no-speech" || e.error === "aborted" ? resolve("") : reject(new Error(micMessage(e.error))));
    r.onend = () => resolve(heard);
    r.start();
  });
}

function micMessage(code) {
  if (code === "not-allowed" || code === "service-not-allowed") return "Microphone access was blocked. Allow it in your browser's site settings.";
  if (code === "network") return "Speech recognition needs an internet connection in this browser.";
  return `Speech recognition stopped (${code}).`;
}

/**
 * Continuous transcription for recording a class. Calls onLine({ text, final }) as words arrive.
 * Browsers stop recognition after silence, so it restarts itself until stop() is called.
 */
export function transcribe({ onLine, onError, lang = "en-US" }) {
  if (!canListen) return null;
  let active = true;
  const r = new Recognition();
  r.lang = lang;
  r.continuous = true;
  r.interimResults = true;
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      onLine({ text: e.results[i][0].transcript.trim(), final: e.results[i].isFinal });
    }
  };
  r.onerror = (e) => {
    if (["no-speech", "aborted"].includes(e.error)) return;
    active = false;
    onError?.(new Error(micMessage(e.error)));
  };
  r.onend = () => { if (active) try { r.start(); } catch { /* already started */ } };
  r.start();
  return { stop() { active = false; try { r.stop(); } catch { /* ignore */ } } };
}
