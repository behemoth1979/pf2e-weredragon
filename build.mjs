import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, rmSync } from "fs";

const packs = [
  { src: "src/packs/feats", dest: "packs/feats" },
  { src: "src/packs/macros", dest: "packs/macros" },
];

for (const { src, dest } of packs) {
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  await compilePack(src, dest, { yaml: false });
  console.log(`Compiled ${src} -> ${dest}`);
}
