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

## Second homebrew item: Handwraps of Mighty Blows (battle form house rule)

`src/packs/feats/handwraps-of-mighty-blows-battle-form.json` — a second
item in the same `weredragon-feats` pack, unrelated to Werecreature but
belonging to the same player character (a Druid who also uses Wild
Shape/Untamed Form). It's a patched copy of the real Handwraps of
Mighty Blows, pre-etched with this character's actual runes (+3
potency, major striking, Brilliant (Greater), Holy, Shock (Greater)).

**The problem it solves:** real "battle forms" (Wild Shape's Wolf/
Dinosaur/Dragon Form/etc.) use the `BattleForm` rule element, which
overrides attack modifier and damage with the form's own fixed
per-level bracket values and actively strips out most other damage
modifiers (`BattleFormRuleElement#applyDamageExclusion`). This is a
different code path from Werecreature's `Strike` rule element (which
Weredragon uses, and which *does* automatically inherit handwraps
runes via the actor's `unarmedRunes` merge — no patch needed there).

**How the fix works:** `applyDamageExclusion` explicitly skips
excluding any modifier whose own `predicate` array already contains
`"battle-form"` (the roll option `BattleFormRuleElement` sets while
any battle form is active) — this is the actual bypass mechanism,
confirmed from the pf2e system source, not a documented feature.
There's no equivalent exclusion for attack-roll modifiers, so a
same-predicate `FlatModifier` just stacks normally. So the item's
rules are: one `FlatModifier` (attack, `type: "item"`) and several
`DamageDice` entries (each property rune's bonus damage), each
predicated on `["battle-form", "item:category:unarmed"]` (plus
`target:trait:fiend`/`undead`/`unholy` where the rune's bonus is
conditional). A `Note` RE reminds about rider effects that aren't
automatable this way (Brilliant's crit blind save, Shock's crit arc,
Holy's reaction heal, resistance-ignoring).

Deliberately **not** included: extra damage dice from the striking
rune itself. The player found the +3 major-striking dice made battle
form damage too swingy at this table, so only the attack-roll potency
bonus and the property runes' bonus damage carry over — striking dice
stay excluded like any other battle form.

**Keeping it in sync:** if this character's handwraps' runes change,
update `system.runes` (potency/striking/property) *and* the matching
`FlatModifier`/`DamageDice` values in `system.rules` together — they
aren't derived from each other, both are hardcoded to match the
character's actual gear at time of writing.

## Third homebrew item: Black Dragon Hide Armor

`src/packs/feats/black-dragon-hide-armor.json` — a third item in the
same `weredragon-feats` pack, a custom suit of armor for this
character, built from a real Hide Armor base item (`baseItem:
"hide-armor"`, ORC/remaster).

Etched with +3 potency, major resilient, and three property runes
(Greater Fortification, Greater Dread, Major Moonweave), crafted from
Dragonhide (standard-grade) precious material (`material: {"type":
"dragonhide", "grade": "standard"}`). All of that is standard PF2E
automation the system already understands from `system.runes` and
`system.material` — no custom rule elements needed for any of it.

Note armor runes use a different shape than weapon runes: `property`
is a plain string array (not the `{"0": ..., "1": ...}` object
weapons use), and the fundamental rune field is `resilient` (not
`striking`).

The only actual homebrew automation is two `FlatModifier` rule
elements for a flat house-rule bonus (this suit's black dragon hide
grants +1 to AC and +1 to saves against poison): both use `type:
"untyped"` deliberately, not `"item"` — an "item" bonus would be the
same type as the armor's own potency-derived AC bonus and its
resilient-derived save bonus, so per PF2E's same-type-doesn't-stack
rule it would just get silently eclipsed by the larger existing item
bonus and have no effect. `"untyped"` always stacks regardless of
what else applies. The poison-save modifier is scoped with predicate
`"item:trait:poison"` (the standard predicate for "the effect
requiring this save has the poison trait" — confirmed against a real
official rule element using the same pattern, Iron Lung's
`AdjustDegreeOfSuccess` on `saving-throw`).

## Fourth/fifth/sixth homebrew items: Monstrosity Form (Kaiju), Breath Weapon action + spell

`src/packs/feats/spell-effect-monstrosity-form-kaiju.json` — a patched
copy of the real `Spell Effect: Monstrosity Form (Kaiju)` (the battle
form granted by the feat Heart of the Kaiju / the Monstrosity Form
spell). The vanilla item is a single `BattleForm` rule element with no
`GrantItem` and no automation for its Breath Weapon at all — the real
official item only *describes* Breath Weapon in prose, it doesn't
implement it. This patch adds:

- `overrides.speeds.fly: 180` — added directly into the existing
  `BattleForm` rule element's speed overrides (not a separate
  `BaseSpeed` RE — `BattleForm` owns/controls all speeds while active,
  so edit its data in place rather than layering another RE on top).
- Two `GrantItem` REs, both tied to this effect's lifetime: one for
  `breath-weapon-kaiju.json` ("Breath Weapon", the action) and one for
  `breath-weapon-kaiju-spell.json` ("Breath Weapon (Kaiju)", the
  spell) — both referenced by in-module compendium UUID
  (`Compendium.phil-pf2e-weredragon.weredragon-feats.Item.<name>`).
- A `TokenImage` RE pointing at `assets/tokens/kaiju-form.webp`.

**Action triggers spell, not description enrichers.** The action
(`breath-weapon-kaiju.json`) doesn't carry its own area/damage
automation — its description is just "**Activate** [2] (evocation,
primal); **Effect** You cast @UUID[...Breath Weapon (Kaiju)]", the
same "Activate → Cast a Spell → Effect: you cast X" text pattern every
real official item that triggers a specific spell uses (soaring
armor, snapleaf, the-fiend, gamtu-hat, dawnlight, flurrying — checked
several, all purely descriptive/manual, no functional auto-trigger
exists in the system for this). Clicking the action doesn't
programmatically roll anything; the player follows the link (or finds
the granted spell directly) and casts it themselves — that's how this
class of ability works everywhere in the real game, not a limitation
specific to this module.

**The actual automation lives on the spell**
(`breath-weapon-kaiju-spell.json`, `type: "spell"`), built from real
structured spell fields (`system.area`, `system.damage`,
`system.defense.save`) the same way an official spell like Cone of
Cold is — not text enrichers like the old action-only version had.
This is strictly better than the original action-only implementation:
a real `defense.save` field gives a genuine clickable save button that
resolves against this character's actual spell DC, which text
enrichers alone can never do. Granted as an "innate"-style spell via
bare `GrantItem` (same mechanism used elsewhere in this repo for
Toughness/Change Shape) — pf2e has no dedicated rule element for
spell-granting; `GrantItem` doesn't special-case spells at all, it
just adds the item, and the actor's own spellcasting-collection logic
is what places an entry-less granted spell somewhere usable. If it
doesn't show up cleanly in the Spellcasting tab in-session, that's the
part to debug — everything else here (area/damage/save, the action
wrapper) is fully verified against source.

As with the other homebrew items, actually getting this on the
character means dragging this patched spell effect onto the sheet in
place of the vanilla one (or in place of casting the real spell) —
there's no attempt here to intercept the actual Monstrosity Form spell
casting flow itself.

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
