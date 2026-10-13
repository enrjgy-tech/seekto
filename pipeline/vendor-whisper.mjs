// For self-hosting: copy the Whisper models into ./site, so on-device transcription needs nothing
// from Hugging Face either (Transformers.js is already served from the site). Run after
// `npm run build && npm run vendor`, on a machine with internet access:
//
//   node pipeline/vendor-whisper.mjs                 # fast and better models (about 120 MB)
//   node pipeline/vendor-whisper.mjs tiny base small # pick models (small is about 250 MB more)
//
// It rewrites site/js/config.js to point at the copies.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "3.0.2";
const site = fileURLToPath(new URL("../site/", import.meta.url));
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ["tiny", "base"];
const MODELS = { tiny: "Xenova/whisper-tiny", base: "Xenova/whisper-base", small: "Xenova/whisper-small" };
// The files Transformers.js reads for Whisper: settings, tokenizer, and the encoder and decoder
// in full precision (used with WebGPU) and 8-bit (used with WebAssembly).
const MODEL_FILES = /^(?:(?:config|generation_config|preprocessor_config|tokenizer|tokenizer_config|normalizer|added_tokens|special_tokens_map|vocab)\.json|merges\.txt|onnx\/(?:encoder_model|decoder_model_merged)(?:_quantized)?\.onnx)$/;

async function save(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  console.log(`  ${(bytes.length / 1e6).toFixed(1).padStart(6)} MB  ${path.slice(site.length)}`);
  return bytes.length;
}

try { await readFile(`${site}index.html`); } catch { console.error("Run `npm run build` first."); process.exit(1); }

// Transformers.js itself is already copied in by pipeline/vendor-transformers.mjs (part of every build).
let total = 0;
for (const name of wanted) {
  const id = MODELS[name];
  if (!id) { console.error(`Unknown model "${name}". Use: ${Object.keys(MODELS).join(", ")}`); process.exit(1); }
  console.log(id);
  const info = await (await fetch(`https://huggingface.co/api/models/${id}`)).json();
  for (const file of info.siblings.map((s) => s.rfilename).filter((f) => MODEL_FILES.test(f))) total += await save(`https://huggingface.co/${id}/resolve/main/${file}`, `${site}models/${id}/${file}`);
}

await writeFile(`${site}js/config.js`, `// Written by pipeline/vendor-whisper.mjs: everything is served from this site.
export const WHISPER = {
  library: "../vendor/transformers/transformers.js",
  models: "../models/",
  wasm: "../vendor/transformers/",
};
`);
console.log(`Done: models ${(total / 1e6).toFixed(0)} MB. site/js/config.js now points at the local copies.`);
