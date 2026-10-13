// Lint rules that catch real mistakes (unused or undefined names, == vs ===, unreachable code).
// Formatting is Prettier's job (.prettierrc.json). Run: npx eslint .
import { browser, worker, node } from "./eslint.globals.mjs";

const rules = {
  "no-undef": "error",
  "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
  "no-redeclare": "error",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-unreachable": "error",
  "no-self-assign": "error",
  "no-self-compare": "error",
  "no-cond-assign": ["error", "except-parens"],
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-fallthrough": "error",
  "no-var": "error",
  "prefer-const": ["error", { destructuring: "all" }],
  eqeqeq: ["error", "smart"],
  "no-shadow-restricted-names": "error",
  "no-unsafe-finally": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
};

export default [
  { ignores: ["site/**", "node_modules/**", "eslint.globals.mjs"] },
  {
    files: ["app/**/*.js", "engine/src/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...browser, ...worker } },
    rules,
  },
  { files: ["app/sw.js"], languageOptions: { globals: { ...worker, __VERSION__: "readonly", __FILES__: "readonly" } } },
  {
    files: ["engine/test/**/*.js", "engine/bench/**/*.mjs", "pipeline/**/*.mjs", "test/**/*.mjs", "*.mjs"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...node } },
    rules,
  },
  { files: ["test/**/*.mjs"], languageOptions: { globals: { ...node, ...browser } } },
];
