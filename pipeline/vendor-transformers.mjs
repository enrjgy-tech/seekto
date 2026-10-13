// Copy Transformers.js (the library that runs Whisper in the browser) into site/vendor, so the
// app loads no script from another server and its Content Security Policy can say so.
// Run after `npm run build`; needs the npm registry. CI and the deploy run it on every build.
//
//   node pipeline/vendor-transformers.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, statSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "3.0.2"; // keep in step with app/js/config.js
const FILES = ["transformers.js", "ort-wasm-simd-threaded.jsep.wasm"];
const site = fileURLToPath(new URL("../site/", import.meta.url));
if (!existsSync(join(site, "index.html"))) {
  console.error("Run `npm run build` first.");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "seekto-tf-"));
try {
  const tgz = execFileSync(
    "npm",
    ["pack", `@huggingface/transformers@${VERSION}`, "--silent", "--pack-destination", tmp],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .pop();
  execFileSync("tar", ["-xzf", join(tmp, tgz), "-C", tmp]);
  const out = join(site, "vendor", "transformers");
  mkdirSync(out, { recursive: true });
  for (const f of FILES) {
    copyFileSync(join(tmp, "package", "dist", f), join(out, f));
    console.log(`  ${(statSync(join(out, f)).size / 1e6).toFixed(1).padStart(5)} MB  vendor/transformers/${f}`);
  }
  console.log(`Transformers.js ${VERSION} copied into site/vendor/transformers`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
