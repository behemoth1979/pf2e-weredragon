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
| Weredragon | 25 ft, fly 10 ft | Jaws / Claw | 1d8 piercing / 1d6 slashing | — / Agile | Must begin and end each turn on a solid surface while flying, or fall (as Werebat) |

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
