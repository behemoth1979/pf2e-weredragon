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
 * that spell instead -- constructs a temporary, unembedded item parented
 * to the actor, then calls `.rollDamage({})` on it (same shape
 * shroud-of-flame.js already uses, for why `rollDamage({})` -- not
 * `toMessage()` -- is what produces a real, clickable Apply Healing
 * button). The roll itself still isn't a separate click (`rollDamage()`
 * executes it immediately), but applying the result now needs the normal
 * click, same as any other spell.
 *
 * **Correction, found in play (v2.24.1): a bare temporary/unembedded copy
 * silently does nothing at all** -- confirmed live, via Chrome DevTools
 * Protocol connected directly to the user's own running Foundry session
 * (not just read from source): `rollDamage()` completed with no thrown
 * error, but posted no chat message either. Traced to `SpellPF2e
 * #getDamage()`'s own early return: `if (... || !n?.statistic) return
 * null;` where `n = this.spellcasting`, and `get spellcasting()` resolves
 * via `actor.spellcasting.get(this.system.location.value)` -- a
 * temporary copy has no `location.value` at all, so this is always null,
 * so `getDamage()`/`rollDamage()` always silently return nothing,
 * regardless of the spell's own damage/heightening data being completely
 * correct. Manually casting the spell from the sheet never hit this,
 * because Foundry's own drag-and-drop flow always assigns a real
 * `location.value` as part of adding the spell -- only this script's own
 * from-scratch temporary construction skipped that step. Fixed by
 * pointing the temp copy's `system.location.value` at the same shared
 * "Weredragon Homebrew (Innate Spells)" entry `innate-spell-grants.js`
 * already find-or-creates for granted spells (exposed via
 * `getOrCreateInnateEntry` on the module API for this reuse) -- without
 * needing to actually embed this spell on the actor at all. Re-verified
 * live after the fix: `spellcasting` resolves to that entry, `getDamage
 * ()` returns non-null, and a real chat card posts with an actual rolled
 * total.
 *
 * This same gap likely affects shroud-of-flame.js too (identical
 * temporary-copy-with-no-location construction) -- not fixed here since
 * it wasn't reported broken and reproducing/verifying it needs an actual
 * Phoenix Monstrosity Form test in play, but worth checking if it turns
 * out to have gone silently unused the same way.
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

  // A temporary, unembedded spell has no system.location.value, so
  // SpellPF2e#spellcasting resolves to null and getDamage()/rollDamage()
  // silently return nothing -- no error, just no chat card. Point it at
  // the same shared innate entry innate-spell-grants.js already
  // find-or-creates for granted spells, without actually embedding this
  // spell on the actor.
  const getOrCreateInnateEntry = game.modules.get(MODULE_ID)?.getOrCreateInnateEntry;
  const sourceData = source.toObject();
  if (getOrCreateInnateEntry) {
    const entry = await getOrCreateInnateEntry(actor);
    sourceData.system.location.value = entry.id;
  }

  const tempSpell = new Item.implementation(sourceData, { parent: actor });
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
