// Tries small on-device language models as a second opinion on definitions the engine found.
// For every judged candidate (engine/bench/judgments/definitions.jsonl) it asks the model whether the
// sentence defines the term, and prints how well the yes/no score separates real definitions from false ones.
// Runs on a GitHub runner (the sandbox can't reach the model hub): see .github/workflows/def-model.yml.
import { readFileSync, writeFileSync } from "node:fs";
import { AutoTokenizer, AutoModelForSeq2SeqLM, AutoModelForCausalLM, Tensor } from "@huggingface/transformers";

const rows = readFileSync("engine/bench/judgments/definitions.jsonl", "utf8").trim().split("\n").map(JSON.parse);
const [modelId = "Xenova/flan-t5-small"] = process.argv.slice(2);

const prompts = {
  sentence: (r) =>
    `Lecture sentence: "${r.sentence}"\nDoes the speaker explain what "${r.term}" means here, so that a student could use it as a flashcard? Answer yes or no.`,
  pair: (r) =>
    `Term: ${r.term}\nProposed meaning: ${r.definition}\nIs the proposed meaning a correct definition of the term, taken from a lecture? Answer yes or no.`,
  both: (r) =>
    `A student's notes from a lecture say: "${r.sentence}"\nIs "${r.definition}" what "${r.term}" means? Answer yes or no.`,
};

const tok = await AutoTokenizer.from_pretrained(modelId);
const causal = /qwen|smollm|llama|phi|gemma/i.test(modelId);
const model = causal
  ? await AutoModelForCausalLM.from_pretrained(modelId, { dtype: "q4" })
  : await AutoModelForSeq2SeqLM.from_pretrained(modelId, { dtype: "q8" });
const firstId = (w) => tok.encode(w, { add_special_tokens: false })[0];
const yes = firstId(causal ? "yes" : "yes");
const no = firstId("no");
const yes2 = causal ? firstId("Yes") : yes;
const no2 = causal ? firstId("No") : no;
const startId = model.config.decoder_start_token_id ?? 0;

async function score(text) {
  if (causal) {
    const chat = tok.apply_chat_template([{ role: "user", content: text }], {
      add_generation_prompt: true,
      tokenize: false,
    });
    const enc = await tok(chat);
    const out = await model(enc);
    const dims = out.logits.dims;
    const v = dims.at(-1);
    const row = (dims.at(-2) - 1) * v;
    const l = out.logits.data;
    const y = Math.max(Number(l[row + yes]), Number(l[row + yes2]));
    const n = Math.max(Number(l[row + no]), Number(l[row + no2]));
    return y - n;
  }
  const enc = await tok(text, { truncation: true, max_length: 384 });
  const out = await model({
    ...enc,
    decoder_input_ids: new Tensor("int64", BigInt64Array.from([BigInt(startId)]), [1, 1]),
  });
  const l = out.logits.data;
  const v = out.logits.dims.at(-1);
  return Number(l[(out.logits.dims.at(-2) - 1) * v + yes]) - Number(l[(out.logits.dims.at(-2) - 1) * v + no]);
}

function auc(s, y) {
  let w = 0,
    t = 0;
  for (let i = 0; i < s.length; i++)
    for (let j = 0; j < s.length; j++)
      if (y[i] && !y[j]) {
        t++;
        w += s[i] > s[j] ? 1 : s[i] === s[j] ? 0.5 : 0;
      }
  return w / t;
}

const result = { model: modelId, prompts: {} };
const all = {};
for (const [name, make] of Object.entries(prompts)) {
  const s = [];
  for (const r of rows) s.push(await score(make(r)));
  all[name] = s;
  const y = rows.map((r) => r.real);
  const order = s.map((v, i) => i).sort((a, b) => s[b] - s[a]);
  const at = {};
  for (const keep of [10, 20, 30, 40, 60, 80]) {
    const tp = order.slice(0, keep).filter((i) => y[i]).length;
    at[keep] = `${tp}/${keep}`;
  }
  result.prompts[name] = { auc: +auc(s, y).toFixed(3), topK_real: at };
}
console.log("RESULT " + JSON.stringify(result));
writeFileSync("scores.json", JSON.stringify({ model: modelId, ids: rows.map((r) => r.id), scores: all }));
