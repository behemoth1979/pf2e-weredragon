# Homebrew: Weredragon (Werecreature Archetype)

A Foundry VTT module for the PF2e system that adds a homebrew
**Weredragon** type directly into the Werecreature Dedication feat's
own type picker (Howl of the Wild, pg. 76) — right alongside Werebat,
Werebear, Wereboar, Werecrocodile, Weremoose, Wererat, Wereshark,
Weretiger, and Werewolf.

## How it works

Rather than bolting a separate item onto the side, this module ships
a **patched copy of the actual Werecreature Dedication feat**, pulled
straight from the pf2e system's own compendium and edited to add one
more entry to its `ChoiceSet` plus the matching `BaseSpeed`/`Strike`
rule elements, gated on `werecreature:weredragon` exactly the way the
system gates its own official types. So when you take this version of
the feat, "Weredragon" shows up as a normal option in the same choice
prompt as the printed types, and Change Shape grants the right
attacks/speeds automatically.

**Weredragon stat block** (matches the printed table's format):

| Type | Speed | Attack | Damage | Traits | Special |
|---|---|---|---|---|---|
| Weredragon | 30 ft, fly 40 ft (hybrid) / fly 50 ft (animal) | Antler / Claw / Jaws / Tail | 1d8 piercing / 1d8 slashing / 1d8 piercing / 1d8 bludgeoning | Shove / Agile / — / Reach 10 ft, Trip | Must begin and end each turn on a solid surface while flying, or fall (as Werebat) |

## Install

1. Copy this folder into `Data/modules/phil-pf2e-weredragon/`.
2. Restart Foundry, enable the module in your world's Manage Modules.
3. Open **Compendium Packs** → "Homebrew: Werecreature Dedication
   (+Weredragon)".

## Using it at the table

Drag **this module's** copy of "Werecreature Dedication" onto a
character sheet instead of the system's built-in one. The choice
prompt will include Weredragon. (If a player already has the vanilla
version, delete it from their sheet first, then drag this one in —
same as the pf2e team's own guidance whenever they rework this feat's
automation.)

Everything else — Toughness, the silver weakness, the Change Shape
action, the beast/werecreature traits — is untouched; only the type
list and the type-specific rule elements are extended.

The feat's own `change-shape` toggle also explicitly includes a
"Humanoid" option (not just Hybrid/Animal), so the Actions-tab form
dropdown works the same as the vanilla feat's does, without depending
on a separately granted item to merge that option in.

The same compendium also includes **Handwraps of Mighty Blows +3
(Battle Form House Rule)** — a patched copy of Handwraps of Mighty
Blows for a character who also uses Wild Shape/Untamed Form. Drop it
onto that character's sheet in place of their normal Handwraps, and
its potency (attack roll) and property rune bonus damage (Brilliant
(Greater), Holy, Shock (Greater)) will keep applying on top of any
active battle form's fixed attack/damage, instead of being discarded
the way battle forms normally discard your gear. Striking-rune extra
dice are deliberately left out of that carry-over.

It also includes **Black Dragon Hide Armor** — a custom Hide Armor
built from Dragonhide (standard-grade), etched with +3 potency, major
resilient, Greater Fortification, Greater Dread, and Major Moonweave,
plus a house rule granting a flat +1 bonus to AC and to saving throws
against poison.

Finally, it includes a patched **Spell Effect: Monstrosity Form
(Kaiju)** that automates the Breath Weapon ability the vanilla effect
only describes in text: it grants a **Breath Weapon** action that
activates a real **Breath Weapon (Kaiju)** spell (60-foot cone, 15d6
damage, basic Reflex save that rolls against this character's actual
spell DC, 1d4-round recharge), sets fly Speed to 180 feet, and swaps
the token to `kaiju-form.webp`. Drag it onto the sheet in place of the
vanilla spell effect while transformed.

The module also patches the shared **Spell Effect: Monstrosity Form**
item covering the other three battle forms (Cave Worm, Phoenix, Sea
Serpent), adding a token swap for each (`cave-worm-form.webp`,
`phoenix-form.webp`, `sea-serpent-form.webp`) and, for Sea Serpent, a
**Spine Rake** action that activates a real **Spine Rake (Sea
Serpent)** spell (4d8+10 slashing, basic Reflex save vs. this
character's spell DC).

It also patches all 13 of Animal Form's per-animal spell effects (Ape,
Bear, Bull, Canine, Cat, Crab, Crocodile, Deer, Frog, Orca, Seal,
Shark, Snake) with matching token swaps, Dragon Form's Stormcrown
dragon type with a token swap to `dragon-form.webp`, and Aerial Form
(Bat/Bird/Wasp/Pterosaur) with a single token swap to
`aerial-form.webp` that applies regardless of which of the four
creatures you choose.

Finally, **Spell Effect: Untamed Form** is patched to replace the
vanilla dynamic form picker with a static list of exactly the 17
forms above — pick one from the dropdown and it grants that
token-swapped homebrew version directly, instead of needing to drag
individual patched items onto the sheet one at a time. Pest Form,
Insect Form, Elemental Form, and Plant Form aren't in this list (no
custom art yet) — use the real Untamed Form for those.

There's also a patched **Untamed Form** spell (a proper castable spell
with focus-point cost, not just the effect) — its description links to
the patched Spell Effect above instead of the vanilla one.

There's also a **Weredragon Breath Weapon** spell — a mechanical
duplicate of Chain Lightning (8d12 electricity, basic Reflex, chains
between nearby creatures), renamed and reflavored as a draconic
breath; the numbers are unchanged from the original.

## Hotbar macro

The module includes a second compendium, **Homebrew: Weredragon
Macros**, with a one-click "Untamed Form (Weredragon Homebrew)"
macro — drag it onto your hotbar. Click once to transform (applies
the patched Spell Effect: Untamed Form and prompts the form picker);
click again to revert. No need to drag the effect onto the sheet by
hand each time.

## Sound effect

Shifting into Kaiju form (however you get there — dragging the
patched spell effect on, or picking it from the homebrew Untamed
Form list) plays `kaiju-roar.ogg` for everyone at the table.

## Editing the design

Source lives at:

```
src/packs/feats/werecreature-dedication.json
```

Edit the Weredragon-specific rule elements near the end of
`system.rules` (search for `"weredragon"`), then rebuild:

```bash
npm install
node build.mjs
```

That regenerates `packs/feats/` (the actual LevelDB the system reads).
Always edit the source, never the compiled `packs/` folder — it gets
overwritten on every build.

## Keeping up with pf2e system updates

If the pf2e system later reworks Werecreature Dedication again (new
errata, more automation, etc.), you can re-sync against the latest
upstream version and re-apply the Weredragon patch automatically:

```bash
git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/foundryvtt/pf2e.git /tmp/pf2e-repo
cd /tmp/pf2e-repo
git sparse-checkout set --no-cone packs/pf2e/feats/archetype/werecreature
cd -
python3 rebuild-from-upstream.py /tmp/pf2e-repo
node build.mjs
```

## Notes

- Built/tested against Foundry v14.366 and pf2e system v8.4.1.
- The base feat text and rule-element structure are taken from the
  pf2e system's own compendium (ORC-licensed, Community Use content)
  and only extended, not rewritten — this is unofficial homebrew, not
  affiliated with Paizo or the PF2e Foundry team.
