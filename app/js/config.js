// Where on-device transcription gets its code and models. Transformers.js is served from this
// site (pipeline/vendor-transformers.mjs copies it in at build time), so no script comes from another
// server. The Whisper models download from Hugging Face the first time, unless you serve them
// yourself too (see docs/SELF-HOSTING.md and pipeline/vendor-whisper.mjs).
export const WHISPER = {
  // Transformers.js 3.0.2, copied into ./vendor by the build
  library: "../vendor/transformers/transformers.js",
  // null: download models from Hugging Face. A path like "../models/": serve them yourself.
  models: null,
  // The WebAssembly runtime, next to the library
  wasm: "../vendor/transformers/",
};
