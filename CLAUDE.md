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
| Weredragon | 30 ft, fly 40 ft (hybrid) / fly 50 ft (animal) | Antler / Claw / Jaws / Tail | 1d8 piercing / 1d8 slashing / 1d8 piercing / 1d8 bludgeoning | Shove / Agile / — / Reach 10 ft, Trip | Must begin and end each turn on solid ground while flying, or fall (same rule as Werebat) |

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

## Seventh+ homebrew items: Monstrosity Form (Cave Worm/Phoenix/Sea Serpent) + Spine Rake

Unlike Kaiju, the other three Monstrosity Form options (Cave Worm,
Phoenix, Sea Serpent) are **one shared vanilla item** upstream —
`Spell Effect: Monstrosity Form` (no per-form suffix) — with a single
`ChoiceSet` (`rollOption: "monstrosity-form"`) and three separately
predicated `BattleForm` REs (`monstrosity-form:cave-worm` /
`:phoenix` / `:sea-serpent`), not three separate files. So this module
patches that one shared item (`spell-effect-monstrosity-form.json`,
note: no `-kaiju` suffix) rather than creating three parallel files —
matches upstream's own structure instead of fighting it. Added: three
`TokenImage` REs, each predicated on its own `monstrosity-form:<slug>`
option, pointing at `cave-worm-form.webp` / `phoenix-form.webp` /
`sea-serpent-form.webp`.

Phoenix's own special ability (Shroud of Flame) was already fully
automated in the vanilla item (`Aura` RE + toggleable `RollOption`) —
nothing to add there. Cave Worm's Inexorable (auto-recovers from
paralyzed/slowed/stunned each turn) is partially automated upstream
(`immunities: [{"type": "immobilized"}]`) but the per-turn condition
auto-removal isn't; left as-is, matching vanilla, since it wasn't part
of this round's ask.

Sea Serpent's **Spine Rake** was in the same under-automated state
Kaiju's Breath Weapon was: described in prose only, no actual
action/spell item. Given the same "action triggers spell" treatment:
`spine-rake-sea-serpent.json` (action, "Activate → Cast a Spell"
wrapper) and `spine-rake-sea-serpent-spell.json` (the real spell).
One structural difference from Breath Weapon: Spine Rake's area is
"every creature you're adjacent to during a Swim or Stride," which
has no matching `system.area` geometry (only burst/cone/line/
emanation exist) — so the spell omits `area` entirely (confirmed by
checking a real non-area spell, Shocking Grasp, which omits the field
rather than nulling it) and keeps `system.damage`/`system.defense.save`
for a working save button, while the movement mechanic itself stays
descriptive text, same as the vanilla item leaves it. Both new items
are granted from the shared spell effect via `GrantItem` REs
predicated on `monstrosity-form:sea-serpent` — this predicate-gated
conditional-grant pattern is directly copied from the vanilla file's
own existing `GrantItem` for Phoenix's "Blazing Conflagration" (only
granted when `feat:phoenixs-flight` + `monstrosity-form:phoenix`), not
guessed.

## Animal Form, Dragon Form, and Aerial Form token swaps

`src/packs/feats/spell-effect-animal-form-{ape,bear,bull,canine,cat,
crab,crocodile,deer,frog,orca,seal,shark,snake}.json` — patched
copies of the real per-animal Animal Form spell effects (each animal
is its own upstream file, same as Kaiju, unlike Monstrosity Form's
shared-item design). Each just adds one unconditional `TokenImage` RE
(no predicate needed — the form's own presence on the actor is the
condition) pointing at its matching asset. All 13 Animal Form options
now have art and a patch — full coverage.

Note: canine's asset was originally `wolf-form.webp` but was later
renamed to `canine-form.webp` for consistency with the other
filenames (which all match their compendium option name) — if a
memory or old note says `wolf-form.webp`, it's stale; check the actual
filenames in `assets/tokens/` rather than trusting a name from
earlier in this file.

`src/packs/feats/spell-effect-dragon-form.json` — Dragon Form is a
single large shared item (40 dragon-type choices via one `ChoiceSet`,
confirmed directly against the downloaded upstream source, not a
summary). Only one dragon type has art (`dragon-form.webp`, for
Stormcrown), so this patch adds exactly one `TokenImage` RE, predicated
on `["dragon-form:stormcrown"]` — verified against the file's own
existing roll-option RE (`"dragon-form:{item|flags.system.
rulesSelections.dragonForm.dragonType}"`) and several other REs in the
same file already using the identical `dragon-form:<type>` predicate
pattern for other dragon-specific overrides (burrow/climb/swim speed
by type), so this isn't guessed syntax.

`src/packs/feats/spell-effect-aerial-form.json` — also a single
shared item (like Dragon Form/Monstrosity Form), with a `ChoiceSet`
(`rollOption: "aerial-form"`) offering Bat/Bird/Wasp/Pterosaur, each
gated by its own predicated `BattleForm`. Only one piece of art exists
for this spell (`aerial-form.webp`, not one per creature), so unlike
Dragon Form's single-predicated addition, this patch adds one
**unconditional** `TokenImage` RE with no predicate — applies
regardless of which of the four aerial creatures is chosen.

**How these were built**: for files this large (Dragon Form is 768
lines upstream, Aerial Form 637), don't hand-type a reconstruction —
`curl` the exact upstream JSON to a scratch file first, then edit it
programmatically (a throwaway Node script) to inject the new RE(s) and
rename/re-ID/add the wrapper fields (`_key`/`sort`/`ownership`/
`flags`/`_stats`/`effects`), so the untouched bulk of the file is
guaranteed byte-exact rather than transcribed by hand. Same round-trip
verification (compile → extract → diff) as every other item in this
repo still applies before committing.

## `system.slug` overrides — required on every renamed spell effect

Every patched spell-effect item above appends `[Weredragon Homebrew]`
to the vanilla name for clarity in the compendium browser. That
rename is **not cosmetically free**: pf2e generates each effect's
`self:effect:<slug>` roll option from `this.slug ?? sluggify(this.name)`,
then strips a leading `spell-effect-`/`stance-`-style prefix
(`abstract-effect/document.ts`, `prepareBaseData()`). Rename the item
without an explicit `system.slug` override and the auto-slugified name
now includes the `-weredragon-homebrew` tail, which survives the
prefix-strip and produces the WRONG roll option — silently breaking
any predicate elsewhere that checks `self:effect:<original-slug>`.
This is real, not theoretical: Untamed Form's own Dragon Shape
resistance gate checks `self:effect:dragon-form`, and Monstrosity
Form's Phoenix choice-label gate checks `self:effect:untamed-form` —
both cross-reference *other* patched items in this exact set.

The fix: every renamed spell effect gets an explicit `"slug"` field
in `system` set to the vanilla item's natural roll-option slug (what
`self:effect:X` predicates elsewhere already expect) —
`untamed-form`, `dragon-form`, `monstrosity-form`,
`monstrosity-form-kaiju`, `aerial-form`, and `animal-form-<animal>`
for each of the 13 animals. **When adding any new patched spell
effect to this repo, set this field too** — don't rely on
auto-slugification once the name carries the homebrew suffix.

## `@UUID[...Item.<Name>]` content links need the real ID, not the name

Every patched spell effect's description opens with `Granted by
@UUID[Compendium.pf2e.spells-srd.Item.<Spell Name>]`, copied verbatim
from the vanilla item (official pf2e content universally uses names
here, not IDs — checked across dozens of files). That pattern works
fine for a `GrantItem` rule element's `uuid` field (pf2e's own RE
resolves by name reliably — confirmed working in this user's actual
game for Toughness/Change Shape and others), but **not** for a
`@UUID[...]` *content link* embedded in prose: Foundry's core text
enricher needs the literal document ID there. With a name in that
position it renders as "Granted by Unknown item" with a broken-link
icon. Confirmed in-session: the user copied the real UUID for their
installed Untamed Form spell and its ID (`8RWfKConLYFZpQ9X`) matched
the current v14-dev source exactly — so pf2e item IDs are stable
across versions and safe to fetch from upstream rather than asking
the user to copy each one by hand.

Fixed for all "Granted by" lines by swapping the name for the real ID
and adding an explicit `{Label}` so the link still displays the
readable name: `@UUID[Compendium.pf2e.spells-srd.Item.<id>]{<Spell
Name>}`. IDs used: Untamed Form `8RWfKConLYFZpQ9X`, Animal Form
`wp09USMB3GIW1qbp`, Dragon Form `5c692cCcTDXjSEzk`, Monstrosity Form
`8AMvNVOUEtxBCDvJ`, Aerial Form `NzXpEzcZAjuDTZjK`. Kaiju's own
"Granted by Heart of the Kaiju" line (a *feat*, `feats-srd` pack) was
left untouched — not confirmed broken, and fixing it would need its
own ID lookup.

**When adding any new patched spell effect**: any `@UUID[...]`
*content link* in its description (not RE `uuid` fields, those are
fine by name) needs a real ID + explicit label, not just a copied name
— check upstream for the ID rather than assuming a name-based link
will render correctly.

## Sixth-ish homebrew item: Untamed Form picker

`src/packs/feats/spell-effect-untamed-form.json` — patched copy of
`Spell Effect: Untamed Form` (the effect the Wild Shape order's
Untamed Form focus spell grants). The vanilla item's `ChoiceSet` uses
`"choices": "flags.system.wildShapeForms"` — a special string the
pf2e codebase recognizes to dynamically compute the player's actual
available-forms list from which druid feats they hold (Insect Shape,
Soaring Shape, Plant Shape, etc.). That computation isn't something a
module can safely extend or override, so this patch replaces it
outright with a **static, hand-authored** `choices` array listing all
17 forms this module has patched with token-swap art (13 Animal Form
animals + Aerial Form + Dragon Form + Monstrosity Form + Monstrosity
Form (Kaiju)), each `value` pointing at the corresponding
in-module-compendium item by name UUID
(`Compendium.phil-pf2e-weredragon.weredragon-feats.Item.<exact name,
including the [Weredragon Homebrew] suffix>`). Selecting one grants
that item via the same `GrantItem`
`"{item|flags.system.rulesSelections.formEffect}"` dynamic-UUID
pattern vanilla already uses — untouched from the original.

Deliberately excludes Pest Form, Insect Form, Elemental Form, and
Plant Form (not patched, no custom art) — confirmed with the user
before building rather than assumed; if this character actually has
feats unlocking those, use the real Untamed Form for them instead, or
ask for them to be added here once art exists.

Also deliberately **not feat-gated** per choice the way vanilla is
(no `feat:soaring-shape`/`feat:dragon-shape`/etc. predicates on
individual entries) — this is a personal tool for a specific character
who has already demonstrated access to everything on the list; the
risk of a wrong/guessed feat slug silently hiding an option the
character does have outweighs the low cost of the list showing
something they wouldn't otherwise pick.

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
