// On-device transcription: Whisper in the browser (checked so far in Chrome and Edge on Windows),
// offline after the first download, in about 100 languages. Audio is decoded here and handed to a background thread.
import { whisperCues, toMono16k } from "../engine/index.js";
import { t } from "./i18n.js";

// Download sizes: with a graphics card (WebGPU) Transformers.js loads full-precision weights, which
// are bigger than the compressed ones it uses otherwise.
const gpu = typeof navigator !== "undefined" && "gpu" in navigator;
export const MODELS = {
  fast: { id: "Xenova/whisper-tiny", label: t("Fast (about {size})", { size: gpu ? "150 MB" : "40 MB" }) },
  better: { id: "Xenova/whisper-base", label: t("Better (about {size})", { size: gpu ? "300 MB" : "80 MB" }) },
  best: { id: "Xenova/whisper-small", label: t("Best, for fast computers (about {size})", { size: gpu ? "1 GB" : "250 MB" }) },
};

export const supported = typeof Worker !== "undefined" && typeof WebAssembly !== "undefined" && typeof (globalThis.AudioContext || globalThis.webkitAudioContext) !== "undefined";

/**
 * Private by default: transcribe on this device when it can do it comfortably (a graphics chip
 * for WebGPU, or a computer rather than a phone). Otherwise use the browser's live speech service.
 */
export function defaultTranscriber(canListen) {
  // Many school Chromebooks have little memory and slow processors; there the live service is
  // the default unless the device clearly has room (8 GB or more). Private stays one tap away.
  const lowEndChromebook = typeof navigator !== "undefined" && /CrOS/.test(navigator.userAgent) && !(navigator.deviceMemory >= 8);
  // A computer (mouse or trackpad). Phones and tablets default to the live service, since a 40–150 MB
  // download and transcribing after the class are a poor fit there; on-device stays one tap away.
  const strong = typeof navigator !== "undefined" && !lowEndChromebook && Boolean(globalThis.matchMedia?.("(pointer: fine)").matches);
  return supported && (strong || !canListen) ? "device" : "browser";
}

let worker = null;
function getWorker() {
  if (!worker) worker = new Worker(new URL("./asr-worker.js", import.meta.url), { type: "module" });
  return worker;
}

/** Decode a recording to 16 kHz mono samples. */
export async function decode(blob) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
    return toMono16k(channels, audio.sampleRate);
  } finally {
    ctx.close?.();
  }
}

function run(message, onProgress) {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    w.onmessage = ({ data }) => {
      if (data.type === "progress") onProgress?.(data);
      else if (data.type === "ready") { onProgress?.({ status: "ready", device: data.device }); if (message.type === "load") resolve(data.device); }
      else if (data.type === "result") resolve(data.output);
      else if (data.type === "error") reject(new Error(friendly(data.message)));
    };
    w.onerror = (e) => reject(new Error(friendly(e.message || "")));
    w.postMessage(message, message.audio ? [message.audio.buffer] : []);
  });
}

function friendly(message) {
  if (/fetch|network|Failed to load|import/i.test(message)) return t("Couldn't download the transcription model. Check your connection; after the first download it works offline.");
  if (/memory|OOM|allocation/i.test(message)) return t("This device ran out of memory. Try the Fast model or a shorter recording.");
  return t("On-device transcription failed: {message}", { message });
}

/** Download the model ahead of time. */
export function prepare(quality = "fast", onProgress) {
  return run({ type: "load", model: MODELS[quality]?.id || MODELS.fast.id }, onProgress);
}

/** Transcribe a recording on this device. Returns timed lines [{ start, end, text }]. */
export async function transcribeOnDevice(blob, { quality = "fast", language = null, onProgress } = {}) {
  onProgress?.({ status: "decoding" });
  const audio = await decode(blob);
  if (!audio.length) throw new Error(t("This recording is empty."));
  const output = await run({ type: "run", model: MODELS[quality]?.id || MODELS.fast.id, audio, language }, onProgress);
  return whisperCues(output);
}

/** "Downloading model… 42%" style text for progress events. */
export function progressText(p) {
  if (p.status === "decoding") return t("Reading the recording…");
  if (p.status === "progress" && p.total) return t("Downloading the model (first time only)… {pct}%", { pct: Math.round(p.progress || 0) });
  if (p.status === "ready") return t("Transcribing on this device…");
  if (p.status === "initiate" || p.status === "download") return t("Downloading the model (first time only)…");
  return t("Transcribing on this device…");
}
