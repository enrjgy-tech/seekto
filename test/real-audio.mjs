// Runs one whole real recording through the same pipeline the app uses: Whisper (Transformers.js)
// -> Seekto's cue cleanup -> the engine. It writes the transcript and what the engine found, so a
// person can label the lecture by hand and add it to the benchmark. Run by the "Real audio"
// workflow (manual only); needs `npm i @huggingface/transformers` and a 16 kHz mono WAV.
//   node test/real-audio.mjs lecture.wav out-dir [model]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { whisperCues, findEvents, findDefinitions } from "../engine/src/index.js";

const [wav, outDir, model = "Xenova/whisper-base"] = process.argv.slice(2);
if (!wav || !outDir) throw new Error("usage: node test/real-audio.mjs lecture.wav out-dir [model]");

/** A 16-bit PCM mono 16 kHz WAV -> Float32 samples. */
function readWav(path) {
  const b = readFileSync(path);
  let at = 12;
  while (at + 8 <= b.length) {
    const id = b.toString("ascii", at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === "data") {
      const n = Math.floor(Math.min(size, b.length - at - 8) / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(at + 8 + i * 2) / 32768;
      return out;
    }
    at += 8 + size + (size % 2);
  }
  throw new Error("no data chunk in WAV");
}

const { pipeline } = await import("@huggingface/transformers");
const audio = readWav(wav);
console.log(`audio: ${(audio.length / 16000 / 60).toFixed(1)} min, model ${model}`);
const asr = await pipeline("automatic-speech-recognition", model);
const started = Date.now();
const output = await asr(audio, {
  language: "english",
  task: "transcribe",
  chunk_length_s: 30,
  stride_length_s: 5,
  return_timestamps: true,
});
const seconds = Math.round((Date.now() - started) / 1000);
const cues = whisperCues(output);
const text = cues.map((c) => c.text).join(" ");
const today = new Date().toISOString().slice(0, 10);
const events = findEvents(text, { today }).map((e) => ({ date: e.date, title: e.title, sentence: e.sentence }));
const definitions = findDefinitions(text).map((d) => ({
  term: d.term,
  definition: d.definition,
  sentence: d.sentence,
}));

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/transcript.json`, JSON.stringify({ model, seconds, cues }, null, 1));
writeFileSync(`${outDir}/transcript.txt`, cues.map((c) => c.text).join("\n"));
writeFileSync(`${outDir}/engine.json`, JSON.stringify({ today, events, definitions }, null, 1));
console.log(
  `transcribed in ${seconds}s: ${cues.length} cues, ${events.length} dates, ${definitions.length} definitions`,
);
for (const e of events) console.log(`DATE ${e.date} ${e.title} <- ${e.sentence}`);
for (const d of definitions) console.log(`DEF ${d.term}: ${d.definition}`);
