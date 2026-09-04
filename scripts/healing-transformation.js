/**
 * Automates the "Healing Transformation" spellshape feat (analyzed on
 * request, same as Bizarre Transformation before it): its real rules are
 * only a toggleable RollOption ("spellshape:healing-transformation") and
 * an ItemAlteration that appends a reminder line to the next-cast
 * polymorph spell's own description -- no rule element anywhere actually
 * rolls or applies healing. This fills that gap specifically for Untamed
 * Form (Weredragon Homebrew) (this module's patched, actually-castable
 * copy of the real spell): whenever it's cast while the Healing
 * Transformation toggle is on, cast the real "Healing Transformation
 * (Weredragon Homebrew)" spell (a directly castable duplicate of Heal,
 * see healing-transformation-spell.json) on the actor's behalf.
 *
 * On request, switched from this script rolling and applying its own
 * plain `Roll` (fully automatic, no click needed) to actually casting
 * that spell instead -- reuses the exact same "temporary, unembedded
 * item parented to the actor, then `.rollDamage({})`" pattern already
 * proven working in this module for shroud-of-flame.js (see that
 * script's own docstring for why `rollDamage({})` -- not `toMessage()`
 * -- is what produces a real, clickable Apply Healing button on the
 * resulting chat card, matching how a normal spell's damage/healing
 * roll actually gets applied). The roll itself still isn't a separate
 * click -- `rollDamage()` executes it immediately -- but applying the
 * result now requires the normal click, same as any other spell.
 *
 * Detecting "Untamed Form was just cast, at what rank" without guessing:
 * `ChatMessagePF2e#get item()` (real source, client/documents/chat-
 * message.mjs internally) resolves flags.pf2e.origin.uuid back to the
 * actual cast item and, for spells specifically, calls
 * `item.loadVariant({ castRank: flags.pf2e.origin.castRank ?? item.rank })`
 * -- meaning `message.item` on the createChatMessage hook already IS the
 * correctly-heightened spell instance, no manual castRank parsing out of
 * rendered chat-card HTML needed.
 *
 * Matching by `message.item.slug === "untamed-form"` required first
 * adding an explicit `system.slug: "untamed-form"` to
 * untamed-form-spell.json -- it had none, and (per the aeon-stone-
 * healing.js precedent already documented in CLAUDE.md) `ItemPF2e#slug`
 * has no name-derived fallback at runtime, only `system.slug` directly,
 * so without that addition `message.item.slug` would have been `null`
 * and this would never have matched.
 *
 * Reading the toggle's live state: `actor.rollOptions.all["spellshape:
 * healing-transformation"]` -- `actor.rollOptions.all` is a real,
 * commonly-used pf2e pattern for checking a currently-set roll option
 * (confirmed against many other uses of this exact shape in the compiled
 * system source, e.g. `rollOptions.all["self:effect:parry"]`), and the
 * option string here is exactly what the feat's own RollOption RE adds
 * when its "healing-transformation" suboption is toggled on (`option:
 * "spellshape"` + `suboptions: [{value: "healing-transformation"}]`
 * combine to the roll option `spellshape:healing-transformation`).
 * Deliberately does NOT auto-clear the toggle after use -- no evidence
 * found that real spellshape toggles are single-use/auto-consumed
 * elsewhere in the system, so it's left as a persistent toggle the
 * player manages themselves, same as any other spellshape.
 *
 * Casting the real spell this way means its own damage/healing formula
 * is what actually determines the amount -- this script no longer hardcodes
 * "1d6 per rank + 10" itself; whatever healing-transformation-spell.json's
 * own `system.damage` formula says is what gets rolled and posted.
 *
 * Second trigger path: the createChatMessage hook only fires from an
 * actual spell cast (sheet Spellcasting tab), never from the "Untamed
 * Form" hotbar macro (untamed-form-toggle.json) -- that macro creates
 * the "Spell Effect: Untamed Form" item directly via
 * createEmbeddedDocuments, bypassing SpellPF2e#toMessage()/spellcasting
 * entirely (no chat message, nothing for this hook to see), the exact
 * same "two different trigger paths needed" situation
 * bizarre-transformation.js already has for battle forms vs. Weredragon
 * Hybrid/Animal. Fixed the same way: applyHealingTransformation(actor)
 * is factored out and exposed on
 * game.modules.get("phil-pf2e-weredragon") at "init", so
 * untamed-form-toggle.json can call it directly after creating the
 * effect.
 */

(() => {

const MODULE_ID = "phil-pf2e-weredragon";
const HEALING_TRANSFORMATION_SPELL_UUID = "Compendium.phil-pf2e-weredragon.weredragon-feats.Item.HealTrnsfrmSpell";

async function applyHealingTransformation(actor) {
  if (!actor) return;
  if (!actor.rollOptions?.all?.["spellshape:healing-transformation"]) return;

  const source = await fromUuid(HEALING_TRANSFORMATION_SPELL_UUID);
  if (!source) return;

  const tempSpell = new Item.implementation(source.toObject(), { parent: actor });
  await tempSpell.rollDamage({});
}

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.applyHealingTransformation = applyHealingTransformation;
});

Hooks.on("createChatMessage", async (message, _options, userId) => {
  if (userId !== game.user.id) return;

  const item = message.item;
  if (item?.type !== "spell" || item.slug !== "untamed-form") return;

  const actor = message.actor;
  if (!actor) return;

  await applyHealingTransformation(actor);
});

})();
