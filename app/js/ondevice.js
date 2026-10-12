// On-device transcription: Whisper in the browser. Works in any modern browser, offline after the
// first download, in about 100 languages. Audio is decoded here and handed to a background thread.
import { whisperCues, toMono16k } from "../engine/index.js";

export const MODELS = {
  fast: { id: "Xenova/whisper-tiny", label: "Fast (about 40 MB)" },
  better: { id: "Xenova/whisper-base", label: "Better (about 80 MB)" },
};

export const supported = typeof Worker !== "undefined" && typeof WebAssembly !== "undefined" && typeof (globalThis.AudioContext || globalThis.webkitAudioContext) !== "undefined";

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
  if (/fetch|network|Failed to load|import/i.test(message)) return "Couldn't download the transcription model. Check your connection; after the first download it works offline.";
  if (/memory|OOM|allocation/i.test(message)) return "This device ran out of memory. Try the Fast model or a shorter recording.";
  return `On-device transcription failed: ${message}`;
}

/** Download the model ahead of time. */
export function prepare(quality = "fast", onProgress) {
  return run({ type: "load", model: MODELS[quality]?.id || MODELS.fast.id }, onProgress);
}

/** Transcribe a recording on this device. Returns timed lines [{ start, end, text }]. */
export async function transcribeOnDevice(blob, { quality = "fast", language = null, onProgress } = {}) {
  onProgress?.({ status: "decoding" });
  const audio = await decode(blob);
  if (!audio.length) throw new Error("This recording is empty.");
  const output = await run({ type: "run", model: MODELS[quality]?.id || MODELS.fast.id, audio, language }, onProgress);
  return whisperCues(output);
}

/** "Downloading model… 42%" style text for progress events. */
export function progressText(p) {
  if (p.status === "decoding") return "Reading the recording…";
  if (p.status === "progress" && p.total) return `Downloading the model (first time only)… ${Math.round(p.progress || 0)}%`;
  if (p.status === "ready") return "Transcribing on this device…";
  if (p.status === "initiate" || p.status === "download") return "Downloading the model (first time only)…";
  return "Transcribing on this device…";
}
