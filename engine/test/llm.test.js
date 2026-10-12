import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, readReply, isReady, chat } from "../src/llm.js";

test("knows when a model is ready", () => {
  assert.equal(isReady({ provider: "none" }), false);
  assert.equal(isReady({ provider: "ollama", model: "llama3.2" }), true);
  assert.equal(isReady({ provider: "openrouter", model: "x" }), false);
  assert.equal(isReady({ provider: "openrouter", model: "x", apiKey: "k" }), true);
  assert.equal(isReady({ provider: "custom", model: "x" }), false);
});

test("builds OpenAI-compatible requests with a system message", () => {
  const { url, init } = buildRequest({ provider: "ollama", model: "llama3.2" }, { system: "Be brief.", messages: [{ role: "user", content: "Hi" }] });
  assert.equal(url, "http://localhost:11434/v1/chat/completions");
  const body = JSON.parse(init.body);
  assert.deepEqual(body.messages, [{ role: "system", content: "Be brief." }, { role: "user", content: "Hi" }]);
  assert.equal(init.headers.authorization, undefined);
});

test("builds Anthropic requests for the browser", () => {
  const { url, init } = buildRequest({ provider: "anthropic", model: "m", apiKey: "k" }, { system: "S", messages: [{ role: "user", content: "Hi" }] });
  assert.equal(url, "https://api.anthropic.com/v1/messages");
  assert.equal(init.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(JSON.parse(init.body).system, "S");
});

test("reads replies from both APIs", () => {
  assert.equal(readReply("openai", { choices: [{ message: { content: "Yes" } }] }), "Yes");
  assert.equal(readReply("anthropic", { content: [{ type: "text", text: "Yes" }] }), "Yes");
});

test("chat surfaces readable errors", async () => {
  const fail = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "Invalid key" } }) });
  await assert.rejects(chat({ provider: "openai", model: "m", apiKey: "bad" }, { messages: [] }, fail), /Invalid key/);
  const ok = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "Done" } }] }) });
  assert.equal(await chat({ provider: "openai", model: "m", apiKey: "k" }, { messages: [] }, ok), "Done");
});
