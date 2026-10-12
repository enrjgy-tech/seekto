// Runs Whisper on this device, in a background thread, with Transformers.js.
// The library and the model are downloaded once (then cached by the browser); audio never leaves the device.
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";
let asr = null;
let loaded = "";

async function load(model) {
  if (asr && loaded === model) return asr;
  const { pipeline, env } = await import(LIB);
  env.allowLocalModels = false;
  const progress = (p) => self.postMessage({ type: "progress", status: p.status, file: p.file, progress: p.progress, loaded: p.loaded, total: p.total });
  let device = "wasm";
  try { if (self.navigator?.gpu && (await self.navigator.gpu.requestAdapter())) device = "webgpu"; } catch { /* no WebGPU */ }
  try {
    asr = await pipeline("automatic-speech-recognition", model, { device, progress_callback: progress });
  } catch (err) {
    if (device !== "webgpu") throw err;
    device = "wasm";
    asr = await pipeline("automatic-speech-recognition", model, { device, progress_callback: progress });
  }
  loaded = model;
  self.postMessage({ type: "ready", device });
  return asr;
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") { await load(data.model); return; }
    if (data.type === "run") {
      const run = await load(data.model);
      const options = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true };
      if (data.language) Object.assign(options, { language: data.language, task: "transcribe" });
      const output = await run(data.audio, options);
      self.postMessage({ type: "result", output });
    }
  } catch (err) {
    self.postMessage({ type: "error", message: String(err?.message || err) });
  }
};
