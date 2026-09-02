/**
 * Automates the "Healing Transformation" spellshape feat (analyzed on
 * request, same as Bizarre Transformation before it): its real rules are
 * only a toggleable RollOption ("spellshape:healing-transformation") and
 * an ItemAlteration that appends a reminder line to the next-cast
 * polymorph spell's own description -- no rule element anywhere actually
 * rolls or applies healing. This fills that gap specifically for Untamed
 * Form (Weredragon Homebrew) (this module's patched, actually-castable
 * copy of the real spell): whenever it's cast while the Healing
 * Transformation toggle is on, roll 1d6 per the rank it was cast at,
 * plus a flat +10 house-rule bonus ("Overflowing Life", per the user's
 * own naming -- see the item description), and apply it as healing
 * automatically -- no click-through needed.
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
 * The actual roll/heal is done directly by this script (a plain Roll,
 * not routed through pf2e's own spell-damage/heightening pipeline) and
 * applied to HP immediately with no manual "Apply Healing" click needed
 * -- matching this module's own aeon-stone-healing.js precedent for
 * fully-automatic healing, not the click-required pattern used for
 * player-triggered damage spells like Breath Weapon/Spine Rake
 * elsewhere in this module. A compendium item, "Healing Transformation
 * (Weredragon Homebrew)" (type spell, vitality trait), exists purely for
 * a proper browsable/flavor reference -- it is not itself cast or rolled
 * by this script.
 *
 * Second trigger path: the createChatMessage hook only fires from an
 * actual spell cast (sheet Spellcasting tab), never from the "Untamed
 * Form" hotbar macro (untamed-form-toggle.json) -- that macro creates
 * the "Spell Effect: Untamed Form" item directly via
 * createEmbeddedDocuments, bypassing SpellPF2e#toMessage()/spellcasting
 * entirely (no chat message, nothing for this hook to see), the exact
 * same "two different trigger paths needed" situation
 * bizarre-transformation.js already has for battle forms vs. Weredragon
 * Hybrid/Animal. Fixed the same way: applyHealingTransformation(actor,
 * rank) is factored out and exposed on
 * game.modules.get("phil-pf2e-weredragon") at "init", so
 * untamed-form-toggle.json can call it directly after creating the
 * effect, deriving rank from the actor's own embedded "Untamed Form
 * (Weredragon Homebrew)" spell item (already present whenever this
 * character can use the macro at all, since v2.15.0's live testing
 * confirmed casting it from the sheet already works) rather than from
 * a cast message that doesn't exist on this path.
 */

(() => {

const MODULE_ID = "phil-pf2e-weredragon";

async function applyHealingTransformation(actor, rank) {
  if (!actor) return;
  if (!actor.rollOptions?.all?.["spellshape:healing-transformation"]) return;

  // House rule on top of the base 1d6/rank: a flat +10, named "Overflowing
  // Life" (per the item description), folded directly into the roll formula
  // rather than added afterward, so it shows up in the roll breakdown too.
  const roll = await new Roll(`${rank ?? 1}d6 + 10`).evaluate();

  const hp = actor.system.attributes.hp;
  const healed = Math.min(roll.total, hp.max - hp.value);
  if (healed > 0) {
    await actor.update({ "system.attributes.hp.value": hp.value + healed });
  }

  const flavor = healed > 0
    ? `<p><i class="fa-solid fa-heart"></i> <strong>Healing Transformation</strong> (vitality, +10 Overflowing Life): ${actor.name} restores ${healed} Hit Points.</p>`
    : `<p><i class="fa-solid fa-heart"></i> <strong>Healing Transformation</strong> (vitality, +10 Overflowing Life): ${actor.name} is already at full Hit Points.</p>`;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
  });
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

  await applyHealingTransformation(actor, item.rank);
});

})();
