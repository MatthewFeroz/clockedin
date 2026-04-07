import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const dist = path.join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(path.join(dist, "native-host"), { recursive: true });

await Bun.build({
  entrypoints: [path.join(root, "src/background.ts")],
  outdir: dist,
  target: "browser",
  format: "esm",
  minify: false
});

await Bun.build({
  entrypoints: [path.join(root, "native-host/bridge.ts")],
  outdir: path.join(dist, "native-host"),
  target: "bun",
  format: "esm",
  minify: false
});

for (const file of ["manifest.json", "block.html", "block.css", "block.js"]) {
  cpSync(path.join(root, "src", file), path.join(dist, file));
}

cpSync(path.join(root, "native-host", "manifest.template.json"), path.join(dist, "native-host", "manifest.template.json"));
