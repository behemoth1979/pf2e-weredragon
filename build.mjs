import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, rmSync } from "fs";

const src = "src/packs/feats";
const dest = "packs/feats";

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });

await compilePack(src, dest, { yaml: false });
console.log(`Compiled ${src} -> ${dest}`);
