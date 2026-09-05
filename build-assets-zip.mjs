// Builds a zip of just assets/tokens and assets/sounds, for manually
// uploading into Forge VTT's Assets Library (see CLAUDE.md's "Forge-hosted
// instance errors" section -- a module's own bundled assets/ folder isn't
// reliably served on Forge for a custom, non-Bazaar-listed module, while
// files uploaded to the Assets Library are). Run this as part of every
// release alongside build-release-zip.mjs; re-upload the result to Forge's
// Assets Library whenever assets/tokens or assets/sounds actually changed.
//
// Zipped with no "assets/" wrapper folder -- extracting/uploading this
// gives you "tokens/" and "sounds/" directly, so the resulting Assets
// Library URLs are predictable: https://assets.forge-vtt.com/<your-id>/tokens/...
// and .../sounds/...

import { ZipArchive } from "archiver";
import { createWriteStream, existsSync } from "node:fs";
import { rm } from "node:fs/promises";

const OUTPUT = "pf2e-weredragon-assets.zip";
const ENTRIES = ["assets/tokens", "assets/sounds"];

if (existsSync(OUTPUT)) await rm(OUTPUT);

const output = createWriteStream(OUTPUT);
const archive = new ZipArchive({ zlib: { level: 9 } });

const done = new Promise((resolve, reject) => {
  output.on("close", resolve);
  archive.on("error", reject);
});

archive.pipe(output);

for (const entry of ENTRIES) {
  if (!existsSync(entry)) {
    throw new Error(`Expected asset folder not found: ${entry}`);
  }
  const name = entry.split("/").pop();
  archive.directory(entry, name);
}

await archive.finalize();
await done;

console.log(`Wrote ${OUTPUT}`);
