// Where on-device transcription gets its code and models. A self-hosted copy can serve both
// itself (see docs/SELF-HOSTING.md and pipeline/vendor-whisper.mjs), so no request leaves your server.
export const WHISPER = {
  // Transformers.js, pinned
  library: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2",
  // null: download models from Hugging Face. A path like "./models/": serve them yourself.
  models: null,
  // null: the library's default. A path like "./vendor/transformers/": serve the WebAssembly files yourself.
  wasm: null,
};
