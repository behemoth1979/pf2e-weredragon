/**
 * Automates the "Healing Transformation" spellshape feat (analyzed on
 * request, same as Bizarre Transformation before it): its real rules are
 * only a toggleable RollOption ("spellshape:healing-transformation") and
 * an ItemAlteration that appends a reminder line to the next-cast
 * polymorph spell's own description -- no rule element anywhere actually
 * rolls or applies healing. This fills that gap specifically for Untamed
 * Form (Weredragon Homebrew) (this module's patched, actually-castable
 * copy of the real spell): whenever it's cast while the Healing
 * Transformation toggle is on, roll 1d6 per the rank it was cast at and
 * apply it as healing automatically -- no click-through needed.
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
 */

(() => {

Hooks.on("createChatMessage", async (message, _options, userId) => {
  if (userId !== game.user.id) return;

  const item = message.item;
  if (item?.type !== "spell" || item.slug !== "untamed-form") return;

  const actor = message.actor;
  if (!actor) return;

  if (!actor.rollOptions?.all?.["spellshape:healing-transformation"]) return;

  const rank = item.rank ?? 1;
  const roll = await new Roll(`${rank}d6`).evaluate();

  const hp = actor.system.attributes.hp;
  const healed = Math.min(roll.total, hp.max - hp.value);
  if (healed > 0) {
    await actor.update({ "system.attributes.hp.value": hp.value + healed });
  }

  const flavor = healed > 0
    ? `<p><i class="fa-solid fa-heart"></i> <strong>Healing Transformation</strong> (vitality): ${actor.name} restores ${healed} Hit Points.</p>`
    : `<p><i class="fa-solid fa-heart"></i> <strong>Healing Transformation</strong> (vitality): ${actor.name} is already at full Hit Points.</p>`;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
  });
});

})();
