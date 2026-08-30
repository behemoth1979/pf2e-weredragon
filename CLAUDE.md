# CLAUDE.md — pf2e-weredragon module

Context for Claude Code sessions working on this repo. Read this before
making changes.

## What this module is

A Foundry VTT module (`phil-pf2e-weredragon`) for the Pathfinder 2e
system. It patches the **real Werecreature Dedication feat** (Howl of
the Wild, pg. 76) to add a homebrew **Weredragon** type directly into
the feat's own type picker — alongside Werebat, Werebear, Wereboar,
etc. — rather than shipping Weredragon as a separate bolt-on item.

Owner/GM: Phil. Runs the game on Forge VTT.

**Weredragon stat block:**
| Type | Speed | Attack | Damage | Traits | Special |
|---|---|---|---|---|---|
| Weredragon | 25 ft, fly 10 ft | Jaws / Claw | 1d8 piercing / 1d6 slashing | — / Agile | Must begin and end each turn on solid ground while flying, or fall (same rule as Werebat) |

## Repo layout

```
module.json              # Foundry module manifest — id, version, manifest/download URLs
src/packs/feats/
  werecreature-dedication.json   # SOURCE OF TRUTH — edit this, never packs/
packs/feats/              # COMPILED LevelDB — generated, never hand-edit
build.mjs                 # compiles src/packs/ -> packs/ via @foundryvtt/foundryvtt-cli
rebuild-from-upstream.py  # regenerates src/ from a fresh pf2e system pull (see below)
assets/tokens/            # token art for form changes (webp/png, square, e.g. 512x512+)
README.md
```

**Golden rule:** always edit `src/packs/feats/werecreature-dedication.json`,
then run `node build.mjs` to regenerate `packs/feats/`. Never hand-edit
anything under `packs/` — it's a compiled LevelDB and gets clobbered on
every build.

## Build workflow

```bash
npm install        # first time only
node build.mjs      # compiles src/packs/ -> packs/ (LevelDB)
```

Verify changes round-trip cleanly (compile → extract → diff) before
committing if the edit touches rule-element structure, not just values.

## How the patch works technically

The feat's `system.rules` array has Weredragon-specific rule elements
appended near the end (search for `"weredragon"`). Pattern to follow
for any new Weredragon-only mechanic:

- Gate on this predicate (mirrors how official types are gated):
  ```json
  ["werecreature:weredragon", {"or": ["change-shape:hybrid", "change-shape:animal"]}]
  ```
- Existing rule elements using this pattern: `BaseSpeed` (land 25/fly 10),
  `Strike` (Jaws, Claw).
- The feat's own `ChoiceSet` includes `"weredragon"` as an option —
  don't touch this unless changing the type's name/id.
- The feat's own `change-shape` RollOption has a `"humanoid"` suboption
  added directly (predicate `[{"not":"non-humanoid-change-shape"}]`) —
  this was a deliberate fix so the Actions-tab dropdown shows
  Humanoid/Hybrid/Animal without depending on a separately-granted
  shared item merging it in. Don't remove this without understanding
  why it was added (see git history / README).

## Pending / in-progress work

- **Token image swap on form change**: adding `TokenImage` rule
  elements gated the same way as `BaseSpeed`/`Strike` above, pointing
  at art in `assets/tokens/`. One RE per form (hybrid, animal). Art
  files not yet finalized as of this writing — check `assets/tokens/`
  for what's actually present before assuming names.
- **Sound effect on transform**: discussed but NOT implemented. No
  native pf2e rule element for this. Options if picked back up: Item
  Macro module dependency, or a small script hooking
  `preUpdateActor`/`updateActor` watching the change-shape roll option
  flag, calling Foundry's `AudioHelper.play()`.

## Keeping in sync with upstream pf2e system updates

If the pf2e system reworks Werecreature Dedication (errata, new
automation), re-sync before re-applying homebrew changes:

```bash
git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/foundryvtt/pf2e.git /tmp/pf2e-repo
cd /tmp/pf2e-repo
git sparse-checkout set --no-cone packs/pf2e/feats/archetype/werecreature
cd -
python3 rebuild-from-upstream.py /tmp/pf2e-repo
node build.mjs
```

## Release process (how updates reach Forge)

Forge auto-updates via `module.json`'s `manifest`/`download` URLs,
which point at this repo's GitHub Releases (not raw branch files).

1. Bump `"version"` in `module.json`.
2. Update the `"download"` URL in `module.json` to match the new
   version tag (the `"manifest"` URL stays constant — it always
   resolves to `releases/latest`).
3. Commit + push.
4. Run `node build.mjs` if source changed, and re-zip the module
   contents (module.json, packs/, src/, assets/, build.mjs,
   rebuild-from-upstream.py, README.md — NOT node_modules or .git).
5. On github.com: repo → Releases → "Create a new release" → tag it
   `vX.Y.Z` matching `module.json` → attach both the zip and a
   standalone copy of `module.json` → publish.
6. Forge will offer an "Update" button once it next checks.

Repo: https://github.com/behemoth1979/pf2e-weredragon

## Environment

- Built/tested against Foundry v14.366, pf2e system v8.4.1.
- Base feat text/rule structure sourced from the pf2e system's own
  compendium (ORC-licensed, Community Use content), extended not
  rewritten. Unofficial homebrew, not affiliated with Paizo or the
  PF2e Foundry team.
