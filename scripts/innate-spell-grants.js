/**
 * Fixes granted spells (Dragon Breath x40, Breath Weapon (Kaiju), Spine
 * Rake (Sea Serpent)) not appearing in the Spellcasting tab despite being
 * genuinely present on the actor (confirmed in play: `actor.items` has
 * them, but the sheet shows nothing).
 *
 * Root cause, confirmed by reading the compiled pf2e source directly:
 * `CharacterSheetPF2e#prepareSpellcasting()` only ever iterates
 * `actor.spellcasting.collections`, which is built by every embedded
 * `spellcastingEntry` item's own `prepareSiblingData()` filtering
 * `actor.itemTypes.spell` for `system.location.value === this.id` (the
 * entry's own actual item id). A spell with no `location.value` matching
 * a real entry has nowhere to render -- it exists, but is orphaned.
 *
 * `GrantItemRuleElement#preCreate` was checked directly too: it clones
 * the source item, applies `this.alterations` (ItemAlteration objects),
 * and creates it -- nothing in that path ever resolves `{item|...}`-style
 * injected strings against arbitrary fields of the granted item's own
 * source, and `ItemAlteration`'s ~35 valid `property` values (exhaustively
 * enumerated from `ItemAlterationHandler`) do not include `location` at
 * all. So a bare `GrantItem` can genuinely never place a spell into any
 * spellcasting entry -- this isn't a config mistake, it's a real gap in
 * what that rule element can do.
 *
 * Checked how real vanilla content grants spells via bare `GrantItem`
 * (four examples found across the feats compendium: Read the Land, Awaken
 * Others, Undead Creator, Harrower Dedication) -- every single one grants
 * a *ritual*, never a normal spell. Rituals are special-cased in
 * `SpellSource#prepareBaseData` (`this.system.location.value = "rituals"`,
 * a hardcoded sentinel the Rituals tab always recognizes), which is why
 * bare-GrantItem "just works" for them and nowhere else. No vanilla feat
 * grants a normal attack/heal spell this way -- the always-manual
 * "drag the spell onto an existing entry" flow is the only path official
 * content relies on.
 *
 * That manual-drop flow was read too (`CreatureSheetPF2e#_handleDroppedItem`
 * -> `SpellcastingEntryPF2e#addSpell` -> `SpellCollection#addSpell`), and
 * for a spell already on the actor it turns out to do nothing more than:
 *   spell.update({
 *     "system.location.value": entry.id,
 *     "system.location.heightenedLevel": spell.rank,
 *   })
 * That's the actual, complete mechanism -- no special rule element, no
 * resolvable-string magic. This script replicates exactly that, once per
 * grant, against a dedicated shared "innate" spellcasting entry created
 * on demand (find-or-create by name, since spellcastingEntry items don't
 * support an explicit `system.slug` field the way spells/effects do).
 *
 * `ability`/`tradition` on that entry are mostly cosmetic for a character:
 * `SpellcastingEntryPF2e#prepareStatistic` uses the actor's own
 * `"base-spellcasting"` statistic (or `system.proficiency.slug` if set,
 * which this entry deliberately leaves unset) to compute DC/attack, and
 * overwrites `ability.value` from that statistic's own attribute -- so
 * the initial values here just need to be valid, not perfectly matched
 * per dragon type.
 */

(() => {

const MODULE_ID = "phil-pf2e-weredragon";
const INNATE_ENTRY_NAME = "Weredragon Homebrew (Innate Spells)";

const DRAGON_BREATH_TYPES = [
  "adamantine", "barrage", "bog", "brine", "cinder", "cloud", "conspirator",
  "coral", "crystal", "delight", "despair", "diabolic", "empyreal",
  "executor", "forest", "fortune", "horned", "magma", "mirage", "mocking",
  "oath", "omen", "phase", "requiem", "resurrection", "rime", "rune",
  "sage", "sea", "sky", "sovereign", "stormcrown", "time", "umbral",
  "underworld", "vizier", "vorpal", "wailing", "whisper", "wish",
];

const TRACKED_SLUGS = new Set([
  "breath-weapon-kaiju",
  "spine-rake-sea-serpent",
  ...DRAGON_BREATH_TYPES.map((type) => `dragon-breath-${type}`),
]);

async function getOrCreateInnateEntry(actor) {
  const existing = actor.itemTypes.spellcastingEntry.find(
    (e) => e.name === INNATE_ENTRY_NAME
  );
  if (existing) return existing;

  const [created] = await actor.createEmbeddedDocuments("Item", [{
    name: INNATE_ENTRY_NAME,
    type: "spellcastingEntry",
    system: {
      ability: { value: "wis" },
      spelldc: { value: 0, dc: 0 },
      tradition: { value: "primal" },
      prepared: { value: "innate" },
    },
  }]);
  return created;
}

Hooks.on("createItem", async (item, _options, userId) => {
  if (userId !== game.user.id) return;
  if (!(item.parent instanceof Actor)) return;
  if (item.type !== "spell") return;
  if (!item.slug || !TRACKED_SLUGS.has(item.slug)) return;
  if (item.system.location?.value) return;

  const entry = await getOrCreateInnateEntry(item.actor);
  await item.update({
    "system.location.value": entry.id,
    "system.location.heightenedLevel": item.rank,
  });
});

})();
