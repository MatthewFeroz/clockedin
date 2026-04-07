import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const extensionId = process.argv[2];

if (!extensionId) {
  console.error("Usage: bun run install-native-host <brave-extension-id>");
  process.exit(1);
}

const root = path.resolve(import.meta.dir, "..");
const bridgePath = path.join(root, "dist", "native-host", "bridge.js");
if (!existsSync(bridgePath)) {
  console.error("Build the extension first with `bun run extension:build`.");
  process.exit(1);
}

chmodSync(bridgePath, 0o755);

const manifest = {
  name: "dev.clockedin.native",
  description: "Clockedin Brave bridge",
  path: bridgePath,
  type: "stdio",
  allowed_origins: [`chrome-extension://${extensionId}/`]
};

const braveManifestDir = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "BraveSoftware",
  "Brave-Browser",
  "NativeMessagingHosts"
);

mkdirSync(braveManifestDir, { recursive: true });
writeFileSync(
  path.join(braveManifestDir, "dev.clockedin.native.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);

console.log("Installed Brave native host manifest:");
console.log(path.join(braveManifestDir, "dev.clockedin.native.json"));
