// Builds the release zip for GitHub Releases (see CLAUDE.md's "Release
// process" section). Replaces the previous manual `Compress-Archive`
// (PowerShell) step, which stores every nested path with a literal
// backslash separator instead of the forward slash the zip spec
// requires -- harmless on extractors that normalize it, but a latent
// portability bug worth not shipping regardless. `archiver` always
// writes forward-slash entry names, independent of the host OS.

import { ZipArchive } from "archiver";
import { createWriteStream, existsSync } from "node:fs";
import { rm } from "node:fs/promises";

const OUTPUT = "pf2e-weredragon.zip";

// Matches the file list documented in CLAUDE.md's release process.
const ENTRIES = [
  { path: "module.json", type: "file" },
  { path: "packs", type: "dir" },
  { path: "src", type: "dir" },
  { path: "assets", type: "dir" },
  { path: "scripts", type: "dir" },
  { path: "build.mjs", type: "file" },
  { path: "rebuild-from-upstream.py", type: "file" },
  { path: "README.md", type: "file" },
];

if (existsSync(OUTPUT)) await rm(OUTPUT);

const output = createWriteStream(OUTPUT);
const archive = new ZipArchive({ zlib: { level: 9 } });

const done = new Promise((resolve, reject) => {
  output.on("close", resolve);
  archive.on("error", reject);
});

archive.pipe(output);

for (const entry of ENTRIES) {
  if (!existsSync(entry.path)) {
    throw new Error(`Expected release entry not found: ${entry.path}`);
  }
  if (entry.type === "dir") {
    archive.directory(entry.path, entry.path);
  } else {
    archive.file(entry.path, { name: entry.path });
  }
}

await archive.finalize();
await done;

console.log(`Wrote ${OUTPUT}`);
