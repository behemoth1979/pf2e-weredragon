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
  (plus every other patched item — see sections below)
src/packs/macros/
  untamed-form-toggle.json       # SOURCE OF TRUTH for the hotbar macro — see below
packs/feats/              # COMPILED LevelDB (Item pack) — generated, never hand-edit
packs/macros/             # COMPILED LevelDB (Macro pack) — generated, never hand-edit
build.mjs                 # compiles both src/packs/{feats,macros} -> packs/ via @foundryvtt/foundryvtt-cli
rebuild-from-upstream.py  # regenerates src/ from a fresh pf2e system pull (see below)
assets/tokens/            # token art for form changes (webp/png, square, e.g. 512x512+)
README.md
```

**Golden rule:** always edit the `src/packs/{feats,macros}/*.json` source
files, then run `node build.mjs` to regenerate both `packs/feats/` and
`packs/macros/`. Never hand-edit anything under `packs/` — it's compiled
LevelDB and gets clobbered on every build.

## Build workflow

```bash
npm install        # first time only
node build.mjs      # compiles src/packs/{feats,macros} -> packs/{feats,macros} (LevelDB)
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
**In-game display name is "Gauntlets of the Obsidian Terror"** (renamed
on request) — this section keeps referring to it by its mechanical
basis (Handwraps of Mighty Blows) since that's what's actually relevant
to how it works, not what it's currently called.

**The problem it solves:** real "battle forms" (Wild Shape's Wolf/
Dinosaur/Dragon Form/etc.) use the `BattleForm` rule element, which
overrides attack modifier and damage with the form's own fixed
per-level bracket values and actively strips out most other damage
modifiers (`BattleFormRuleElement#applyDamageExclusion`). This is a
different code path from Werecreature's `Strike` rule element (which
Weredragon uses).

**Correction (found in play): the "no patch needed for Weredragon"
claim below was wrong for property rune damage.** This section
originally claimed Weredragon's `Strike` RE "automatically inherits
handwraps runes via the actor's `unarmedRunes` merge — no patch needed
there," and on that assumption every rule element on this item
(`FlatModifier`, all six `DamageDice`, the `Note`) was predicated
`["battle-form", "item:category:unarmed"]` — gated behind the
`battle-form` roll option `BattleFormRuleElement` sets, which
Weredragon's `Strike` RE never sets at all (Weredragon doesn't go
through `BattleFormRuleElement` in the first place). Live testing
confirmed the split: the +3 potency attack bonus *does* come through
correctly in Weredragon Hybrid/Animal form (the numeric `unarmedRunes`
merge covers plain potency/striking numbers fine), but every property
rune's bonus damage (Brilliant, Holy, Shock) showed up in the damage
roll dialog as an available toggle and stayed permanently unchecked —
`unarmedRunes` merges the actor's rune *numbers* onto a synthetic
unarmed strike, it doesn't run the property runes' own rule-element
generation the way an actual physical item with those runes attached
would, so property rune effects specifically never applied for
Weredragon at all, regardless of form.

**Fix**: every affected predicate (`FlatModifier` and all six
`DamageDice`/the `Note`) was extended from a bare `"battle-form"` to
`{"or": ["battle-form", {"and": ["werecreature:weredragon", {"or":
["change-shape:hybrid", "change-shape:animal"]}]}]}` — the same
`werecreature:weredragon` + hybrid/animal predicate pattern already
used throughout `werecreature-dedication.json` for every other
Weredragon-specific rule element (see "How the patch works
technically" above). This lets the bonuses apply in *either* a true
`BattleForm`-driven form *or* Weredragon's own Hybrid/Animal forms.
Leaving the (now-likely-redundant) `FlatModifier` enabled for
Weredragon too is harmless even though potency already comes through
naturally: it's still `type: "item"`, so PF2E's same-type-doesn't-
stack rule means it can only ever match or be eclipsed by the natural
value, never double-count.

**How the fix works:** `applyDamageExclusion` explicitly skips
excluding any modifier whose own `predicate` array already contains
`"battle-form"` (the roll option `BattleFormRuleElement` sets while
any battle form is active) — this is the actual bypass mechanism,
confirmed from the pf2e system source, not a documented feature.
There's no equivalent exclusion for attack-roll modifiers, so a
same-predicate `FlatModifier` just stacks normally. So the item's
rules are: one `FlatModifier` (attack, `type: "item"`) and several
`DamageDice` entries (each property rune's bonus damage), each
predicated on the `battle-form`-or-Weredragon-hybrid/animal clause
described above (plus `target:trait:fiend`/`undead`/`unholy` where the
rune's bonus is conditional). A `Note` RE reminds about rider effects
that aren't automatable this way (Brilliant's crit blind save, Shock's
crit arc, Holy's reaction heal, resistance-ignoring).

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

**Precious material extension (cold iron):** `system.material` is set
to `{"type": "cold-iron", "grade": "high"}` (valid grade keys
confirmed against `WEAPON_MATERIAL_VALUATION_DATA` in
`src/module/item/physical/materials.ts` upstream: low/standard/high).
Making battle-form unarmed strikes count as cold iron needed a
different mechanism than the rune bonuses above — materials aren't a
numeric modifier or extra damage dice, they're a structural property
of the strike that pf2e's IWR (resistance/weakness) system reads
directly, so `FlatModifier`/`DamageDice` don't apply here. Used the
real official pattern instead: `AdjustStrike` with `property:
"materials"`, `mode: "add"` — copied from how the actual Oread
ancestry feat "Metal-veined Strikes" makes unarmed attacks count as a
chosen material (`packs/pf2e/feats/ancestry/versatile-heritages/
oread/metal-veined-strikes.json` upstream), not invented from
scratch. `AdjustStrike` operates via `actor.synthetics
.strikeAdjustments` — a generic list applied whenever *any* strike/
weapon gets constructed, confirmed (by reading
`adjust-strike.ts`) to run in `beforePrepareData()` on
already-constructed weapon objects, entirely separate from
`applyDamageExclusion`'s modifier-list filtering (which only touches
`DamageDicePF2e`/`Modifier` instances). So unlike every other RE on
this item, this one isn't "bypassing an exclusion" — material
composition was never subject to that exclusion in the first place.

**Correction (found in play):** the `definition` field on
`AdjustStrike` is **not** a general predicate like every other RE's
`predicate` field — its own source (`adjust-strike.ts`) tests it via
`definition.test(weapon.getRollOptions("item"))`, i.e. *only* the
weapon's own item-scoped roll options (`item:category:unarmed`,
`item:trait:X`, etc.), never the actor's general roll-option bag. So
the originally-shipped `["battle-form", "item:category:unarmed"]`
never matched anything — `"battle-form"` is an actor-level option and
can never appear in a weapon's own `getRollOptions("item")` output,
so the rule silently never fired, in or out of battle form. Fixed to
`definition: ["item:category:unarmed"]` (no battle-form scoping — it
isn't reachable at this field, so the RE now applies to *all* unarmed
strikes, battle-form or not, which is harmless since real unarmed
strikes should already be cold iron from the equipped item's own
material through the ordinary system path). **Don't reuse
`["battle-form", ...]` in a `definition` field on any future
`AdjustStrike`** — that pattern only works on `predicate` fields
(`FlatModifier`, `DamageDice`, etc.), not `definition`.

**Second `AdjustStrike`, same unconditional pattern, added after live
play found Holy's weakness bonus wasn't triggering.** The Holy rune's
bonus damage (`DamageDice`, `damageType: "spirit"`) was applying fine,
but a target's *weakness to holy* specifically never triggered.
Confirmed against the real Holy weapon property rune's own CONFIG
entry (`CONFIG.PF2E.runes.weapon.property.holy` in the compiled
system source) that this is expected: Holy doesn't just add bonus
spirit damage, it also carries `traits: ["holy", "magical"]` and a
`strikeAdjustments: [{ adjustTraits: (e, t) => t.push("holy") }]`
entry specifically so the *strike itself* carries the `holy` trait —
weakness-to-holy checks that trait on the attack, not the `spirit`
damage type of any one damage partial. (Checked Greater Brilliant's
own real CONFIG entry for comparison: it has no such trait or
`strikeAdjustments` at all — `traits: ["magical"]` only — so its
fire/spirit/vitality weakness-triggering is purely damage-type-based
and was already working correctly; it isn't part of this bug.) Since
our item's `Strike`-RE-driven battle-form/Weredragon strikes never go
through the real rune's own `strikeAdjustments`, the `holy` trait
never got added there. Fixed with a second `AdjustStrike`
(`property: "traits"`, `mode: "add"`, `value: "holy"`,
`definition: ["item:category:unarmed"]`) — unconditional, same as the
cold-iron one just above it, for the identical reason: for a normal
(non-battle-form) unarmed strike, the real Holy rune should already be
adding this trait through the ordinary system path, so pushing it a
second time is a harmless no-op there, while for battle-form/Weredragon
strikes it's the only thing that adds it at all.

## Third homebrew item: Black Dragon Hide Armor

`src/packs/feats/black-dragon-hide-armor.json` — a third item in the
same `weredragon-feats` pack, a custom suit of armor for this
character, built from a real Hide Armor base item (`baseItem:
"hide-armor"`, ORC/remaster). **In-game display name is "Hide of the
Obsidian Terror"** (renamed on request) — this section (and the source
filename) keep referring to it by its mechanical basis.

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

**Damage type is now dynamic, matching the real "Heart of the Kaiju"
feat's own choice, not hardcoded.** Originally shipped as
`system.damage.0.type: "untyped"`. The real feat (untouched, used
as-is from the compendium) has the player choose acid/cold/
electricity/fire/sonic via a `ChoiceSet` RE (`flag: "damageType"`)
when they first take it — confirmed directly against this character's
own copy of the item, whose `system.rules[0]` shows the real,
already-made `selection: "electricity"`, and whose own description
text uses this exact resolvable path in an inline `@Damage[]` roll:
`@Damage[15d6[@item.flags.system.rulesSelections.damageType]
|options:area-damage]`. Since our spell is a *separate* item from the
feat, no `{item|...}`-style resolvable string can reach across to
read the feat's choice — that syntax only ever resolves relative to
the item hosting the rule element. `scripts/kaiju-breath-weapon-
damage-type.js` bridges this with a `createItem` hook: whenever
"Breath Weapon (Kaiju)" (matched by its own explicit `system.slug`,
added specifically for this — see the aeon-stone-healing.js precedent
for why an explicit slug is needed for reliable runtime matching) is
granted onto an actor, it looks up that actor's own "Heart of the
Kaiju" feat (`slug: "heart-of-the-kaiju"`) and copies
`flags.system.rulesSelections.damageType` (the same `.system` alias
for `flags.pf2e`, confirmed via `ItemPF2e#prepareBaseData`'s own
`Object.defineProperty` earlier in this file) onto the newly-granted
spell's `system.damage.0.type`. A one-time copy at grant time, not an
ongoing sync — correct because the feat's choice is permanent ("You
can't change this later," per its own description), so nothing needs
re-checking on every cast.

## Inexorable: automated per-turn condition recovery for Cave Worm

`src/packs/feats/inexorable-effect.json` + `scripts/inexorable.js` —
automates the remaining un-automated half of Cave Worm Monstrosity
Form's "Inexorable" ability (see the Cave Worm/Phoenix/Sea Serpent
section below for the immobilized-immunity half, already handled
upstream). Real ability text: "You automatically recover from the
Paralyzed, Slowed, and Stunned conditions at the end of each of your
turns. You're also immune to being Immobilized and ignore difficult
terrain and greater difficult terrain." The terrain-ignoring part
still isn't automated — no rule-element hook exists in Foundry for
movement-cost exceptions, so it stays a manual reminder in the
granted effect's own description.

**Applied automatically, not dragged on manually**: a new `GrantItem`
rule element on the shared `spell-effect-monstrosity-form.json`
(predicate: `monstrosity-form:cave-worm`, same pattern already used
for Phoenix's Blazing Conflagration and Sea Serpent's Spine Rake
grants) grants `inexorable-effect.json` automatically whenever Cave
Worm form is active, and removes it automatically when the form ends
(non-physical granted items default to `onDelete: "cascade"`,
confirmed via `ItemPF2e#prepareBaseData` — no manual cleanup coded).

**Mechanism**: `Hooks.on("pf2e.endTurn", ...)` — a real hook, confirmed
directly from `Combatant#onEndTurn()` in the compiled system source,
which calls `Hooks.callAll("pf2e.endTurn", this, encounter, game.user
.id)` at the end of every combatant's turn. The `game.user.id` third
argument is the same multi-client guard convention already used by
this module's other `createItem`/`deleteItem` hooks (`kaiju-roar.js`,
`bizarre-transformation.js`) — gating on `userId === game.user.id`
ensures only the one client that actually ended the turn performs the
removal. When it fires, the actor whose turn ended is checked for the
`inexorable`-slugged effect; if present, `actor.conditions.bySlug
(slug)` (a real, widely-used pattern in the compiled system source,
e.g. `conditions.bySlug("encumbered")`) finds and deletes any active
Paralyzed/Slowed/Stunned condition outright — not decremented, deleted
entirely, matching "automatically recover from."

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

**Correction: Phoenix's Shroud of Flame was not actually fully
automated — this was checked more carefully later and found wrong.**
The original assessment here was that the vanilla item's `Aura` RE +
toggleable `RollOption` fully handled it, "nothing to add there." That
was incomplete: the `Aura` RE's own `effects` array — the field that
actually grants something to creatures matching its `affects`/`events`
criteria, confirmed against `AuraRuleElement`'s real schema in the
compiled system source — was empty (`"effects": []`). An empty array
grants nothing, so the vanilla item only ever implemented the visual
aura ring and the on/off toggle; the actual "2d6 fire damage" never
had any automation at all. **Automated later, see the Shroud of Flame
section below.** Cave Worm's Inexorable (auto-recovers from paralyzed/
slowed/stunned each turn) is partially automated upstream (`immunities:
[{"type": "immobilized"}]`); the per-turn condition auto-removal was
left un-automated at the time, since it wasn't part of that round's
ask — **automated later, see the Inexorable section above.**

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

## Shroud of Flame: automated damage for Phoenix Monstrosity Form

`src/packs/feats/shroud-of-flame-spell.json` (compendium item name:
"Shroud of Flame Damage (Weredragon Homebrew)") + `src/packs/feats/
shroud-of-flame-active-effect.json` + `scripts/shroud-of-flame.js` —
automates the damage half of Phoenix's aura, which the vanilla item
never actually implemented (see the correction note above). Only the
turn-end trigger is automated, not "enters the aura" mid-movement —
confirmed as the right scope with the user directly before building,
since reliably detecting a token's path crossing the aura ring during
movement is a materially harder problem than a simple turn-based
check.

**Lifecycle**: same auto-grant/auto-remove pattern as Inexorable — a
new `GrantItem` RE on the shared `spell-effect-monstrosity-form.json`
(predicate: `monstrosity-form:phoenix`) grants `shroud-of-flame-
active-effect.json` while in Phoenix form, cascading away
automatically when the form ends. **This effect's own name had to be
distinct from the damage spell's name** — `GrantItem`'s `uuid` field
resolves by name (an already-established, working pattern elsewhere in
this repo), so giving both new items the identical name "Shroud of
Flame (Weredragon Homebrew)" (the first pass) would have made which
one actually got resolved ambiguous. The effect kept that name; the
spell was renamed to "Shroud of Flame Damage (Weredragon Homebrew)"
specifically to avoid the collision.

**Trigger**: `Hooks.on("pf2e.endTurn", ...)`, the same real hook
`inexorable.js` uses, with the same `userId === game.user.id` guard.
For every token on the ending combatant's scene whose actor carries
`shroud-of-flame-active` *and* has the `shrouded` roll option
currently on (the pre-existing vanilla toggle — this script checks it,
doesn't replace it), measures distance to the ending token via
`tokenA.object.distanceTo(tokenB.object)` (confirmed as a real, widely
-used pattern in the compiled system source) and deals damage if
within 20 ft.

**Self-damage is deliberately excluded** — the Phoenix never damages
itself when its own turn ends, via an `actor === combatant.actor`
exclusion in the token filter. This was a judgment call, not a
confirmed rule (the ability text doesn't say either way); if it turns
out wrong in play, that's the line to remove.

**Getting a real, clickable Apply Damage button, not just an announced
number, per what was asked**: confirmed directly from
`SpellPF2e#rollDamage()` in the compiled system source that it reads
`game.user.targets` — the *live* target selection — to determine the
resulting damage roll's `context.target`, which is what a normal pf2e
damage chat card's Apply Damage button actually reads. There's no
argument to `rollDamage()` that lets you pass a target explicitly. So
the script: saves the user's current target selection, targets only
the creature that just ended its turn, constructs a temporary,
unembedded copy of the damage spell parented to the Phoenix's actor
(`new Item.implementation(data, {parent: actor})` — the same pattern
already confirmed working elsewhere in this module for `ChatMessagePF2e
#item`'s own `embeddedSpell` reconstruction), calls `.rollDamage({})`
on it, then restores whatever the user had targeted before — so this
doesn't silently clobber the GM's own target selection mid-combat. The
damage spell item itself is fetched by its real `_id`
(`ShroudFlameSpl01`), not by name, and is never granted onto any actor
or shown on a character sheet — it's constructed fresh and discarded
each time it's needed, existing as a real compendium item purely so
the damage has an inspectable, documented definition rather than being
invisible script-only magic.

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

## Dragon Breath: 40 real spells, one per Dragon Form type

`src/packs/feats/dragon-breath-<type>-spell.json` (40 files, one per
dragon type — `type` is the lowercase slug, e.g. `dragon-breath-
adamantine-spell.json`) — real castable `type: "spell"` items named
"Dragon Breath (\<Type\>)", one for every dragon type in the shared
`spell-effect-dragon-form.json`'s own `ChoiceSet`.

**Correction, found mid-implementation: unlike Kaiju's Breath Weapon
and Sea Serpent's Spine Rake, Dragon Breath was NOT actually
unautomated — this was checked too shallowly at first.** The initial
plan was to build these 40 spells *and* replace the shared item's
existing `GrantItem` (which grants the real
`Compendium.pf2e.actionspf2e.Item.Dragon Breath (Dragon Form)` action)
with a patched action pointing at the new spells instead — the same
"replace the vanilla item with a patched copy" pattern used everywhere
else in this repo. Reading further into the shared item's own rule
set (58+ rules, not just the `ChoiceSet` skimmed the first time)
turned up a chain immediately after that `GrantItem`, all keyed off
`{item|flags.system.itemGrants.dragonBreath.id}` (a resolvable
reference to "whatever got granted under the `dragonBreath` flag"):
two `ItemAlteration`s that dynamically rewrite the granted action's
own description (via a localized string keyed by `breathShape`+
`saveType`) and add the correct tradition/damage-type traits (the
second one predicated `nor` against exactly the 7 dragon types whose
damage type has no matching trait — bludgeoning/piercing types,
confirming the "if applicable" exclusion is already handled
precisely), and two `DamageAlteration`s targeting a special selector,
`"{granted-item-id}-inline-damage"` — a real, working mechanism for
altering the *inline* `@Damage[...]` roll embedded in an item's own
description text, not something invented for this repo. One overrides
that inline roll's damage type to the chosen dragon's real type; the
other adds +4 dice when `parent:level >= 8`, matching "Heightened
(8th)... an additional 4d6 damage" exactly. So the granted action
*already* rolls the correct damage type and amount, already scales
correctly at 8th, and already shows correctly customized description
text — none of that needed rebuilding.

**The one genuine gap**: the granted action's description has no
`@Check[...]` enricher for the save at all — "with a basic save
against your spell DC" is plain text, so there's no clickable save
button; the GM/player has to already know (or look up) which save
type applies and roll it manually on the other side. That's the real,
narrow gap these 40 spells fill. Given that, the shared item's
original `GrantItem`/`ItemAlteration`/`DamageAlteration` chain for the
vanilla action was left **completely untouched** — replacing it would
have thrown away real, working, dynamic automation to reproduce a
strictly smaller subset of it. Instead, the 40 spells are granted
*alongside* the existing action (see below), as a genuine alternative
that has a real, clickable save button — not a replacement.

**All data pulled directly from Dragon Form's own `ChoiceSet` and
prose, not invented**: `rules[0].choices` on the shared item already
gives `{breathShape, damageType, dragonType, saveType, tradition}` per
type in fully structured form (confirmed by reading all 40 entries
directly, not summarized) — that's where each spell's `area.type`
(cone/line), `damage.type`, `defense.save.statistic`, and
`traits.traditions` come from. The actual damage amount, area size,
and heightening tier aren't in the ChoiceSet (only shape/type/save/
tradition are) — those came from the shared item's own description
prose: "dealing 10d6 damage... The shape is a 30-foot cone or a
100-foot line... Heightened (8th) Your Dragon Breath deals an
additional 4d6 damage." Recharge ("can't be used again for 1d4
rounds") is a rollable inline link in the description, same pattern
as Kaiju's Breath Weapon.

**Traits**: per the shared item's own text — "Dragon Breath has the
tradition trait matching the type of dragon and the damage trait
matching the type of damage it deals, if applicable" — each spell's
`traits.value` includes the tradition word itself (not just
`traditions`, which is the usual spell-list-only field; this ability
explicitly wants it as a visible trait too) plus the damage type, but
only when that damage type is a real PF2E trait (acid/cold/
electricity/fire/sonic/force/mental/poison/spirit/void) — physical
types (bludgeoning/piercing/slashing, which several dragon types
actually deal) have no matching trait to add, confirmed by their
absence anywhere in the system as a trait.

**Heightening uses `type: "fixed"`, not `"interval"`** — confirmed
from a real official spell with the identical "single higher tier,
not per-rank" shape ("Deity's Strike": base 7d12 at rank 7,
`heightening: {type: "fixed", levels: {"9": {damage: {<key>: {formula:
"8d12", ...}}}}, damage: {}}` at rank 9) — pulled directly from the
real `spells` compendium pack (downloaded via SFTP to the host-side
volume mount path, `/mnt/user/foundry/data/...` — not the in-container
`/data/...` path, which SFTP can't see, since SFTP resolves against
the Docker *host's* filesystem, not `docker exec`'s container
namespace — then extracted locally with this repo's own
`@foundryvtt/foundryvtt-cli`, since compendium `.ldb` files are
Snappy-compressed SSTables that plain `grep` can't read the way the
world's own recent-write `.log` files could earlier in this document).
**The critical, easy-to-get-wrong detail**: each `levels["8"].damage`
entry holds the *complete replacement* damage object for that rank
(formula `"14d6"`), not an increment (`"4d6"`) — confirmed directly
from the real example (base `7d12` → heightened level shows the full
`8d12`, not `1d12`). Getting this backward would have silently made
every heightened Dragon Breath deal only 4d6 total instead of 14d6.

**Wiring — automatically granted, per type, alongside the vanilla
action, not manually found**: the shared `spell-effect-dragon-form.json`
gets 40 new `GrantItem` REs added (each `predicate: ["dragon-form:
<type>"]`, matching the exact predicate convention this file already
uses for its own per-type overrides — e.g. the existing Stormcrown
`TokenImage`), each granting the one matching "Dragon Breath (\<Type\>)"
spell by real `_id`. Since only one dragon type's predicate is ever
true at a time, only the one matching spell is ever actually granted
— it shows up in the Spellcasting tab and disappears automatically
when the form ends (`GrantItem`'s default `onDelete: "cascade"` for
non-physical items, same mechanism relied on for Inexorable/Shroud of
Flame), same lifecycle as the vanilla action it sits alongside.

**Built via a throwaway Node generator script**, not by hand — 40
files sharing one schema with only shape/type/save/tradition varying
per type is exactly the "large repetitive content" case this repo
already has a convention for (see the token-swap section above).
Random 16-character alphanumeric `_id`s were generated per file
(Foundry document IDs are opaque; no need for them to be
human-readable), and `system.slug` was set explicitly on every one
(`dragon-breath-<type>`) as a matter of course, even though nothing in
this module currently scripts against them — consistent with this
repo's standing practice of always setting an explicit slug on any
new/renamed item rather than relying on a name-derived fallback that
may not exist or may include an unwanted suffix.

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
`8AMvNVOUEtxBCDvJ`, Aerial Form `NzXpEzcZAjuDTZjK`, and (confirmed
broken too, same fix applied) Heart of the Kaiju — a *feat*
(`feats-srd` pack, not `spells-srd`) — `1ul2dasQBdlaMEC5`.

**Update, after the Untamed Form picker bug (see the `ChoiceSet`
section below): "RE `uuid` fields are fine by name" is not a blanket
rule — `GrantItem`'s `uuid` field genuinely does resolve by name, but
`ChoiceSet`'s `choices[].value` (also nominally a `uuid` field) does
NOT — it silently overwrites the label to `"???"` instead. Don't
assume any given RE's UUID-ish field resolves by name just because
`GrantItem`'s does; when in doubt, use the real `_id` — it always
works, for every field, in every RE, with no downside.**

**When adding any new patched spell effect**: any `@UUID[...]`
*content link* in its description, and any `ChoiceSet` choice whose
`value` is an item reference, needs a real ID (+ explicit `{label}`
for content links specifically) — not just a copied name. Check
upstream for the ID rather than assuming a name-based reference will
resolve correctly anywhere outside `GrantItem`.

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
in-module-compendium item **by real `_id`**, not name
(`Compendium.phil-pf2e-weredragon.weredragon-feats.Item.<_id>`).
Selecting one grants that item via the same `GrantItem`
`"{item|flags.system.rulesSelections.formEffect}"` dynamic-UUID
pattern vanilla already uses — untouched from the original.

**Every `value` in this choices array must be a real `_id`, never a
name** — this bit twice already. First pass used name-based UUIDs
(matching the style used everywhere else in this repo for `GrantItem`,
which *does* resolve names fine), and every option in the in-game
picker showed as literal "???". Root cause, confirmed by reading
`ChoiceSetRuleElement`'s `inflateChoices()` directly
(`src/module/rules/rule-element/choice-set/rule-element.ts`): for each
choice it resolves `value` via `fromUuidSync`, and if the result isn't
an `ItemPF2e` instance, it **unconditionally overwrites** whatever
`label`/`img` was authored with `label = "???"` / `img =
"broken.jpeg"` — this is a third, independent place (beyond `GrantItem`
and `@UUID[...]` content links) where name-based UUIDs silently fail
in this codebase. All vanilla `ChoiceSet` content confirms this the
same way: every real choices array in the pf2e system uses either a
localization key or (for item references) a real ID, never a bare
item name.

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

`src/packs/feats/untamed-form-spell.json` — patched copy of the real
"Untamed Form" spell itself (`type: "spell"`, not `"effect"`), added
after the user specifically asked for it separately from the spell
effect above — a castable spell in the Spellcasting tab with real
focus-point cost tracking, rather than only having the picker as a
manually-dragged effect. Casting it doesn't auto-apply anything
(matches vanilla — the real spell doesn't automate that either,
`system.rules: []` both here and upstream); its description just
links to `Spell Effect: Untamed Form (Weredragon Homebrew)` (this
module's patched picker) instead of the vanilla one, same manual
"drag/open the linked effect after casting" step as always.

Fixed the same name-vs-ID content-link issue as everywhere else in
this file for its three @UUID references (Pest Form
`gfPjmG6Fe6D3MFjl`, Animal Form `wp09USMB3GIW1qbp`, and the link to
our own patched effect item by its real in-module `_id`
`UntamedFrmWeredr`, not by name).

One gotcha specific to fetching a *spell* (as opposed to every other
item type in this repo so far): the vanilla source carries a stray
`"folder"` field referencing a folder ID internal to the pf2e system's
own compendium structure — meaningless (and potentially confusing) in
our own module's pack, so it gets stripped. None of this repo's other
patched items had this field; check for it when patching any future
spell specifically.

## Weredragon Breath Weapon spell (Chain Lightning duplicate)

`src/packs/feats/weredragon-breath-weapon-spell.json` — a mechanical
duplicate of the real Chain Lightning spell (8d12 electricity, basic
Reflex, chains to additional creatures within 30 ft, +1d12 per rank
heightening) — all numbers/fields unchanged from the original. First
built with the name changed only, per the literal ask; a follow-up
request reflavored the description prose to read as a draconic breath
(exhale/arcs-of-breath language) while explicitly keeping the chain
mechanic intact rather than rewriting it as a cone (the real mechanic
is single-target-plus-arcing-chain, not an AoE burst — the flavor
text was written to match that, not to imply a shape it doesn't have).
Traits (including `manipulate`) were deliberately left untouched even
though a "breath" conceptually shouldn't need somatic components —
that would be a mechanical change, and only the text was asked to
change; revisit only if asked. Standalone item, not wired into any
other homebrew mechanism (no grants, no predicates referencing it).

## Hotbar macro: one-click Untamed Form toggle

The first non-JSON-content addition to this module: a **Macro**
document (`type: "script"`), the user asked for a hotbar button
instead of always having to drag the spell effect onto the sheet
manually. Source at `src/packs/macros/untamed-form-toggle.json`,
compiled into a *separate* pack (`packs/macros`, declared as
`"type": "Macro"` in `module.json` — a compendium pack can only hold
one document type, so this couldn't live in the existing `Item` pack
alongside everything else). `build.mjs` now compiles both
`src/packs/feats` and `src/packs/macros`.

The macro's `command` (plain JS, runs client-side when clicked):
resolves the acting character (selected token, falling back to
`game.user.character`), checks `actor.items` for an existing item
with `type === "effect"` and `system.slug === "untamed-form"` — reusing
the explicit slug override already set on `spell-effect-untamed-form.json`
(see the slug-drift section above) as a reliable identity check — and
if found, deletes it (revert); otherwise fetches this module's patched
"Spell Effect: Untamed Form (Weredragon Homebrew)" by its real
in-pack UUID via `fromUuid()` and creates it on the actor via
`createEmbeddedDocuments`, i.e. the exact same effect a manual drag
would produce. No GM privileges needed — a player can create an item
on an actor they own.

To use: open the module's **Homebrew: Weredragon Macros** compendium,
drag "Untamed Form (Weredragon Homebrew)" onto the hotbar.

## Hotbar macros: Weredragon form switch (Humanoid/Hybrid/Animal)

Three more macros in `src/packs/macros/weredragon-form-{humanoid,
hybrid,animal}.json` — one-click alternative to the Actions-tab
Change Shape dropdown. Werecreature Dedication's own `change-shape`
`RollOption` RE (in `werecreature-dedication.json`) is `toggleable:
true` with `suboptions` for `humanoid`/`hybrid`/`animal`; pf2e exposes
a public actor method for driving this exact kind of toggle
programmatically: `actor.toggleRollOption(domain, option, itemId,
value, suboption)` — confirmed by reading its real implementation in
`src/module/actor/base.ts`, and it's the same method pf2e's own
hotbar-drop handling and the character sheet's own toggle checkboxes
call, not a workaround.

**Getting the `domain` right matters and isn't obvious**: our
`change-shape` `RollOption` RE never sets an explicit `"domain"`
field, and `RollOptionRuleElement`'s schema defaults that field to
`"all"` (confirmed in `roll-option/rule-element.ts`) — so the actual
call is `actor.toggleRollOption("all", "change-shape", null, true,
"<humanoid|hybrid|animal>")`. Guessing a domain like `"action"` or
matching against the option name would silently fail to find the
rule (returns `null`, not an error) — if `werecreature-dedication.json`
is ever edited to add an explicit `domain` to that RollOption RE,
these three macros need the same string.

To use: open **Homebrew: Weredragon Macros**, drag all three
("Weredragon Form: Humanoid/Hybrid/Animal") onto the hotbar.

## Sound effect on Kaiju transform

Second piece of actual runtime JS (alongside the hotbar macro) — no
rule element exists for "play a sound when this predicate becomes
true," so this needed a real script. `scripts/kaiju-roar.js`, loaded
via `module.json`'s `"scripts"` array, hooks `createItem` and checks
for `item.type === "effect"` + `item.system.slug ===
"monstrosity-form-kaiju"` (same slug-based identity pattern as the
hotbar macro) — that slug is only ever created by getting the patched
Kaiju spell effect onto an actor, however it got there (manual drag,
the Untamed Form picker, a future macro), so this fires correctly
regardless of path. Plays `assets/sounds/kaiju-roar.ogg` via
`foundry.audio.AudioHelper.play(..., true)` — the `true` broadcasts to
every connected client, not just the one who transformed, so the
whole table hears it.

**Important guard**: `createItem` fires on every client that receives
the document sync, not just the one who created it — without checking
`userId !== game.user.id` and returning early, every observing client
would independently detect the same creation and each broadcast their
own copy of the sound, causing overlapping/duplicate playback. Only
the client that actually performed the creation should trigger the
(already-broadcasting) play call.

Scoped to Kaiju only, per what was actually asked — no sound wired up
for any other form yet. If extended to other forms, reuse this same
`createItem` + slug-check pattern rather than inventing a new
mechanism, and remember each new form needs its own slug check (all
the patched slugs are listed in the `system.slug` overrides section
above).

## Pearly White Spindle aeon stone: 1 HP/minute out-of-combat healing

`scripts/aeon-stone-healing.js`, third piece of runtime JS. The real
official "Aeon Stone (Pearly White Spindle)" item's own description
says "restoring 1 HP every minute" while invested — but its granted
effect (`Effect: Aeon Stone Resonance (Pearly White Spindle)`, vanilla
pf2e content, not something this repo patches/owns) has **zero**
automation for that: checked the actual upstream source, its
`system.rules` contains only a `Resistance` RE for void 1, nothing
else. Pure flavor text describing a mechanic that was never built.

Reuses the exact mechanism the pf2e system itself uses to expire
timed effects: `Hooks.on("updateWorldTime", (worldTime, dt) => ...)`
— the same hook `EffectTracker` listens to
(`src/scripts/hooks/update-world-time.ts` →
`game.pf2e.effectTracker.refresh()` upstream) — rather than a custom
polling timer. `dt` is the elapsed seconds; `Math.floor(dt / 60)`
gives whole minutes, healed directly onto `system.attributes.hp.value`
(clamped to max). Out-of-combat only per what was asked — skipped
while `game.combat?.started`. Fractional minutes aren't carried
between calls (deliberate simplification, not a bug).

**Identification gotcha, different from every other item this repo
checks by slug**: the vanilla effect has no explicit `system.slug`
set, and — confirmed by reading `ItemPF2e`'s actual `get slug()`
getter in `src/module/item/base/document.ts` — `item.slug` is *only*
`system.slug`, with **no name-derived fallback**. That fallback
(`this.slug ?? sluggify(this.name)`) exists solely inside
`getRollOptions()` for generating predicate strings like
`item:slug:X` — it does not apply to reading `.slug` directly in
script code. So this script matches by the item's exact `name`
instead. Don't copy the slug-matching pattern used elsewhere in this
repo (Kaiju's roar script, the Untamed Form macro) for *this* kind of
check against an unmodified vanilla item with no explicit slug — name
matching is the correct approach here specifically because there's no
slug to check.

**Permission model**: `actor.primaryUpdater !== game.user` guard,
same pattern `EffectTracker` itself uses (confirmed in its source) —
ensures exactly one connected client applies the healing per actor
(whichever client is that actor's designated primary updater, usually
its owning player — not GM-gated), rather than every client
double-applying it.

## Bizarre Transformation: automated damage-type swap on form change

`scripts/bizarre-transformation.js` — automates the "Bizarre
Transformation" druid feat, which official content leaves entirely to
the player (see the earlier analysis: its own rules are just an
`ItemAlteration` adding a reminder to Untamed Form's description, and
a `RollOption` flag toggle — no actual damage-type change; checked
directly against the real item, not assumed).

**Why this needed three different rule elements, and how each was
picked (not guessed):**

- `ItemAlteration` (`property: "damage-type"`) can't be used — its own
  iteration logic only reaches the actor's *real embedded items*
  (`actor.items`/`itemTypes`/`inventory`), confirmed by reading
  `item-alteration/rule-element.ts` directly. Synthetic battle-form
  strikes live in `actor.system.actions`, a separate, non-embedded
  collection — invisible to `ItemAlteration` entirely. This is *why*
  the real feat only manages a reminder note: the engine genuinely
  can't do more with this RE.
- `AdjustStrike` (`property: "damage-type"`) doesn't exist — its
  schema only supports `materials`, `property-runes`,
  `range-increment`, `traits`, `weapon-traits` (same RE already used
  for the cold iron house rule, whose `traits` support is reused here
  for the "gains the appropriate trait" half of the effect).
- `DamageAlteration` (a *different* RE from `DamageDice`) is the
  correct tool, found by tracing what `DamageDicePF2e`'s own
  `applyAlterations()` actually consumes. Copied its exact shape from
  a real official effect that does the identical thing — "Stance: Asp
  Stance" (`packs/pf2e/feat-effects/stance-asp-stance.json` upstream),
  which overrides all unarmed strikes to piercing damage while active.
  Its `predicate` field is the normal kind (unlike `AdjustStrike`'s
  narrower `definition`) — it does see actor-level roll options — so
  `item:slug:<chosen-strike>` correctly scopes it to one specific
  attack.

**How it's triggered** — two different paths, since Weredragon and
the druid battle forms activate differently:
- Battle forms (Kaiju, Monstrosity Form, all 13 Animal Form animals,
  Aerial Form, Dragon Form): a `createItem` hook (same guard pattern
  as `kaiju-roar.js` — `userId === game.user.id`) checks the created
  effect's `system.slug` against a hardcoded set matching every
  tracked form (the same slugs documented in the `system.slug`
  overrides section above).
- Weredragon Hybrid/Animal: these aren't item creations, they're a
  toggle on the existing Werecreature Dedication item, and reliably
  detecting "the toggle just changed to hybrid/animal" from a generic
  actor/item-update hook wasn't something this session could verify
  with confidence — so instead, the two relevant hotbar macros
  (`weredragon-form-hybrid.json`, `weredragon-form-animal.json`) call
  the prompt directly after a successful `toggleRollOption()`, via a
  small API the script exposes on `Hooks.once("init", ...)`:
  `game.modules.get("phil-pf2e-weredragon").promptBizarreTransformation`.
  (Humanoid's macro doesn't call it — no unarmed attacks to reflavor.)

**Mechanics**: prompts a `Dialog.wait()` listing the actor's current
unarmed strikes (read from `actor.system.actions`, filtered on
`strike.item.system.category === "unarmed"` — confirmed `.slug`/
`.label` exist directly on the strike object by reading
`StrikeData`/`BasicAttackAction` in `actor/data/base.ts`, not
assumed) and the 8 RAW-listed damage types, with a Skip option. On
Apply, deletes any previous Bizarre Transformation effect (only one
active at a time — matches "a single unarmed attack," reset each
transformation) and creates a new temporary effect item carrying the
`DamageAlteration` + `AdjustStrike` pair scoped to the chosen strike.
A 100ms delay before reading `system.actions` exists because the hook
firing doesn't guarantee the actor has finished re-deriving strikes
for the just-applied form yet — a pragmatic buffer, not a guaranteed
fix; if this proves flaky in play, needs a more deterministic wait
(e.g. polling `actor.system.actions` for the expected strike, or a
dedicated post-prepare hook if pf2e exposes one).

**Bug found in play, fixed in v2.14.1: cross-module global-scope
collision broke this script entirely.** This file's top-level `const
MODULE_ID = "phil-pf2e-weredragon"` collided with the sibling
`pf2e-hero-points` module's own identically-named top-level `const
MODULE_ID` — Foundry loads every enabled module's plain `"scripts"`
entries as classic `<script>` tags sharing one global page scope, not
isolated per module, so two modules independently declaring the same
top-level identifier throws `Uncaught SyntaxError: Identifier
'MODULE_ID' has already been declared` for whichever one loads second,
and that entire file silently fails to execute — no other symptom.
Fixed by wrapping the whole file's body in an IIFE (`(() => { ... })
();`), which is now standing practice for every script in this module
(see `kaiju-roar.js`/`aeon-stone-healing.js`, left unwrapped since
neither declares any top-level identifier and so carries no collision
risk — but any *new* script here should still be wrapped from the
start regardless, since a future sibling module could collide with
any name).

**Cleanup gap found in play, fixed in v2.14.2: reverting to Humanoid
(or a battle form's effect simply going away) never removed the
Bizarre Transformation effect.** The original implementation only
handled the "gain a form" half — `promptBizarreTransformation()`
deletes any *previous* Bizarre Transformation effect before creating a
new one, so switching directly between two tracked forms was already
self-cleaning, but there was no code path at all for "lose a form and
don't gain a new one," so the damage-type override just stayed active
indefinitely once you reverted to Humanoid. Fixed with a new exported
`removeBizarreTransformation(actor)` function (alongside the existing
`promptBizarreTransformation`, both exposed on
`game.modules.get("phil-pf2e-weredragon")` at `init`), wired into two
places:
- `weredragon-form-humanoid.json`'s macro command now calls
  `mod.removeBizarreTransformation(actor)` after successfully toggling
  to Humanoid, mirroring how the Hybrid/Animal macros already call
  `promptBizarreTransformation` — Humanoid's own macro deliberately
  still doesn't *prompt* (no unarmed attacks to reflavor while
  Humanoid), it only cleans up.
- A new `Hooks.on("deleteItem", ...)` handler (same guard shape as the
  existing `createItem` one — `userId === game.user.id`, `item.parent
  instanceof Actor`, `item.type === "effect"`, slug in
  `BATTLE_FORM_SLUGS`) calls the same cleanup whenever a tracked battle
  form's own effect is deleted — covers dismissing/expiring a battle
  form, and (harmlessly, since `promptBizarreTransformation` already
  self-cleans on the creation side) the Untamed Form picker's
  delete-then-create form-switch flow, which now fires cleanup twice
  in a row without issue.
`promptBizarreTransformation`'s own inline "delete any previous
effect" step was refactored to call this same new function rather than
duplicating the lookup, so there's exactly one place that knows how to
find and remove the effect.

**Damage-type-override scope bug found in play: it was overriding
every damage partial on the strike, not just the base weapon die.**
Property rune bonus dice from Gauntlets of the Obsidian Terror (Greater
Brilliant/Holy/Greater Shock) were getting their own damage types
silently overridden to whatever Bizarre Transformation had chosen too,
not just the base weapon damage as intended. Root cause, confirmed by
reading `extractDamageAlterations(source, domains, targetSlug)`
directly in the compiled system source
(`.filter((e) => [targetSlug, null].includes(e.slug))`): this function
runs once with `targetSlug = "base"` to gather alterations for the base
weapon damage die, and once *per other* `DamageDicePF2e` entry with
`targetSlug = <that dice's own slug>` (auto-derived from its `label` if
no explicit `slug` is set). A `DamageAlteration` rule element's own
`slug` field — separate from its `predicate` — has to equal whichever
target slug is being gathered for it to even be *attempted*, with one
exception: `null` always passes, regardless of target, since
`[targetSlug, null].includes(null)` is always true. This rule element
never set an explicit `slug`, so it defaulted to `null` and got
attempted against *every* damage partial unconditionally — its
`predicate` (`item:slug:<strike>`) only narrows which *strikes*
qualify, it says nothing about which *damage partial on that strike*.
Fixed with one field: `"slug": "base"` on the `DamageAlteration`,
restricting it to the base-damage extraction pass only. This
generalizes correctly to any future property rune dice added to this
character's gear too — it isn't a hardcoded exclusion list of today's
specific rune slugs, it works by construction.

## Healing Transformation: automated healing on casting Untamed Form

`scripts/healing-transformation.js` + `src/packs/feats/healing-
transformation-spell.json` — automates the "Healing Transformation"
spellshape feat, analyzed on request the same way Bizarre
Transformation was analyzed before it was automated: its real rules
(checked directly against the actual item, not assumed) are a
toggleable `RollOption` (adds `spellshape:healing-transformation` when
on) and an `ItemAlteration` that appends a reminder line to the next
polymorph spell's own description -- no rule element anywhere actually
rolls or applies healing. Scoped specifically to Untamed Form
(Weredragon Homebrew) (this module's own patched, actually-castable
copy of the real spell, from `untamed-form-spell.json`), not to
"any polymorph spell" generally, per what was actually asked.

**Detecting "Untamed Form was just cast, at what rank"**: confirmed
directly from `ChatMessagePF2e#get item()` in the compiled system
source that a chat message's `.item` getter already resolves back to
the correctly-heightened spell instance -- for a spell origin it calls
`item.loadVariant({ castRank: flags.pf2e.origin.castRank ?? item.rank
})` internally. So `message.item.rank` on a `createChatMessage` hook
is already the right cast rank, with no need to parse `data-cast-rank`
out of the rendered chat-card HTML (the only other place that value
appeared in the source read for this).

**Matching `message.item.slug === "untamed-form"` required a small fix
to `untamed-form-spell.json` first**: it had no explicit `system.slug`
set. Per the aeon-stone-healing.js precedent already documented
elsewhere in this file, `ItemPF2e#slug` is *only* `system.slug` with
no name-derived fallback outside `getRollOptions()` -- so without
adding one, `message.item.slug` would have resolved to `null` and this
would never have matched at all. Added `"slug": "untamed-form"`
directly to that item.

**Reading the toggle's current on/off state**: `actor.rollOptions.all
["spellshape:healing-transformation"]` -- `actor.rollOptions.all` is a
real, frequently-used pattern in pf2e's own compiled source for
reading a currently-set roll option (e.g. `rollOptions.all["self:
effect:parry"]`, `rollOptions.all["hp-percent:${n}"]`, several others
checked), and the specific option string here is exactly what the
feat's own `RollOption` rule element sets when its
`"healing-transformation"` suboption is toggled on (`option:
"spellshape"` + a `suboptions` entry with `value:
"healing-transformation"` combine to the roll option `spellshape:
healing-transformation`). Deliberately does **not** auto-clear the
toggle after one use -- no evidence was found that spellshape toggles
are single-use/auto-consumed anywhere else in the system, so it's left
as a persistent, player-managed toggle like any other spellshape.

**Fully automatic, no click-through** -- the roll is a plain `Roll`
this script builds and evaluates directly (not routed through pf2e's
own spell-damage/heightening pipeline), and the resulting HP change is
applied immediately via `actor.update()`, matching this module's own
`aeon-stone-healing.js` precedent for fully-automatic healing rather
than the click-to-apply pattern used for player-triggered damage
spells elsewhere in this module (Breath Weapon, Spine Rake). A chat
message still announces the roll and amount healed (or that the
character was already at full HP) for visibility, even though nothing
needs to be clicked.

**The compendium item exists for browsability/flavor only, per the
user's explicit request for "item type spell, item trait vitality"**
-- `healing-transformation-spell.json` is a real `type: "spell"` item
with `vitality`/`healing`/`druid` traits and a `primal` tradition, but
it is never itself cast, rolled, or referenced by UUID anywhere in the
script; the script rolls its own plain `Roll` independently. It exists
purely so the character has a proper, readable spell entry describing
what this house rule does, matching how the rest of this module treats
homebrew mechanics as real, inspectable items rather than invisible
script-only magic.

**Second trigger path, found in play (v2.15.1): the hotbar macro needed
its own call, same as Bizarre Transformation before it.** Live testing
confirmed casting Untamed Form from the sheet's Spellcasting tab
already worked, but using the `untamed-form-toggle.json` hotbar macro
did not -- that macro creates the "Spell Effect: Untamed Form" item
directly via `createEmbeddedDocuments`, entirely bypassing
`SpellPF2e#toMessage()`/spellcasting, so no chat message is ever
created and the `createChatMessage` hook has nothing to see. This is
the exact same "two different trigger paths" situation
`bizarre-transformation.js` already solved for battle forms (via
`createItem`) vs. Weredragon Hybrid/Animal (via a direct macro call) —
fixed the same way here: `applyHealingTransformation(actor, rank)` was
factored out of the hook handler and exposed on
`game.modules.get("phil-pf2e-weredragon")` at `init`, and
`untamed-form-toggle.json`'s command now calls it directly right after
creating the effect (only on the "gain form" branch, not on revert).
Rank is derived by looking up the actor's own embedded "Untamed Form
(Weredragon Homebrew)" spell item and reading `.rank` from it — a
reasonable source here specifically because that item is already
confirmed present on this character (they've already cast it
successfully from the sheet), falling back to `1` if it's ever absent
on some other character using the macro without that spell added.

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
   contents (module.json, packs/, src/, assets/, scripts/, build.mjs,
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
