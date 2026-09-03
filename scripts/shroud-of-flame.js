/**
 * Automates the damage half of the Phoenix Monstrosity Form's "Shroud of
 * Flame" aura, which the vanilla item never actually implemented despite
 * looking automated at a glance: it has a real `Aura` rule element (20 ft
 * radius, correct traits) and a real toggleable `RollOption` ("shrouded")
 * for the Sustain-action on/off control -- but the Aura RE's own
 * `effects` array (the field that actually grants something to creatures
 * matching its `affects`/`events` criteria) is empty. Confirmed directly
 * against `AuraRuleElement`'s schema in the compiled system source: each
 * `effects` entry is `{uuid, affects, events, save, removeOnExit, ...}`,
 * i.e. it grants a *separate effect item* to whoever qualifies -- an
 * empty array grants nothing, so no damage was ever actually dealt.
 *
 * Real ability text: "A creature that ends its turn within the aura
 * takes 2d6 fire damage. A creature can take this damage only once per
 * turn. You can activate or deactivate this aura with a Sustain action."
 * Scope, confirmed with the user before building: only the turn-end
 * trigger is automated here, not "enters the aura" mid-movement (a
 * materially harder problem -- would need hooking token movement and
 * sampling its path against the aura radius, not just a before/after
 * position check).
 *
 * Trigger: `Hooks.on("pf2e.endTurn", ...)` -- same real hook used by
 * inexorable.js, confirmed against `Combatant#onEndTurn()` in the
 * compiled system source. Guarded the same way (`userId === game.user
 * .id`) so only the one client that actually ended the turn acts.
 *
 * For every token on the same scene whose actor carries the
 * `shroud-of-flame-active` effect (granted automatically while in
 * Phoenix form via a GrantItem RE on the shared Spell Effect:
 * Monstrosity Form item, same pattern as Inexorable) AND has the
 * `shrouded` roll option currently on (the *existing*, still-correct
 * vanilla toggle -- this script doesn't replace it, only checks it),
 * measures distance to the ending combatant's own token via
 * `tokenA.object.distanceTo(tokenB.object)` (a real, widely-used
 * pattern in the compiled system source). Within 20 ft, deals 2d6 fire
 * damage -- with a genuine, clickable Apply Damage button, not just an
 * announced number, per what was asked.
 *
 * How the real Apply Damage button gets produced: confirmed directly
 * from `SpellPF2e#rollDamage()` in the compiled source that it reads
 * `game.user.targets` (the *live* target selection) to determine who
 * the resulting damage roll's `context.target` is -- that's what the
 * Apply Damage button on a normal pf2e damage card actually reads, not
 * anything passed as an explicit argument. So this script:
 * 1. Saves the current target selection.
 * 2. Targets only the creature that ended its turn nearby.
 * 3. Constructs a temporary, unembedded copy of "Shroud of Flame
 *    Damage (Weredragon Homebrew)" (fetched by its real `_id`, not
 *    name, to sidestep any ambiguity) parented to the Phoenix's own
 *    actor via `new Item.implementation(data, {parent: actor})` -- the
 *    same "temporary item with a parent, never persisted" pattern
 *    already confirmed working elsewhere in this module (see
 *    `ChatMessagePF2e#item`'s own `embeddedSpell` reconstruction).
 * 4. Calls `.rollDamage({})` on it (an empty object stands in for the
 *    optional DOM event `rollDamage` reads defensively -- `e.target`
 *    is accessed directly, not `e?.target`, so `e` itself must be a
 *    real object, just not one with a real `.target`).
 * 5. Restores whatever the user had targeted before, so this doesn't
 *    silently clobber the GM's own target selection mid-combat.
 *
 * This spell item is never granted onto the actor and never shows up
 * on the character sheet -- it exists purely as a real, inspectable
 * definition of the damage (matching this module's own preference for
 * "real items, not invisible script-only magic"), constructed fresh
 * and discarded each time it's needed.
 *
 * Self-damage: deliberately excluded. The real ability text doesn't
 * explicitly say whether the Phoenix takes damage from their own aura
 * when their own turn ends, so this was a judgment call rather than a
 * confirmed rule -- excluding the source creature from being counted
 * as a valid "aura owner" against their own ending turn matches the
 * common convention for "aura of X" abilities generally. If this turns
 * out to be wrong in play, the fix is removing the `actor ===
 * combatant.actor` exclusion in the token filter below.
 */

(() => {

const SHROUD_DAMAGE_SPELL_UUID = "Compendium.phil-pf2e-weredragon.weredragon-feats.Item.ShroudFlameSpl01";
const AURA_RADIUS_FEET = 20;

Hooks.on("pf2e.endTurn", async (combatant, _encounter, userId) => {
  if (userId !== game.user.id) return;

  const endingToken = combatant.token?.object;
  if (!endingToken) return;

  const scene = endingToken.scene;
  if (!scene) return;

  const phoenixTokens = scene.tokens.filter((t) => {
    const actor = t.actor;
    if (!actor || actor === combatant.actor) return false;
    const hasShroud = actor.items.some((i) => i.type === "effect" && i.slug === "shroud-of-flame-active");
    return hasShroud && !!actor.rollOptions?.all?.["shrouded"];
  });
  if (phoenixTokens.length === 0) return;

  const inRange = phoenixTokens.some((phoenixToken) => {
    const object = phoenixToken.object;
    return object && object.distanceTo(endingToken) <= AURA_RADIUS_FEET;
  });
  if (!inRange) return;

  const phoenixActor = phoenixTokens[0].actor;
  const damageSource = await fromUuid(SHROUD_DAMAGE_SPELL_UUID);
  if (!damageSource) return;

  const previousTargets = Array.from(game.user.targets);
  try {
    endingToken.setTarget(true, { releaseOthers: true, user: game.user });
    const tempSpell = new Item.implementation(damageSource.toObject(), { parent: phoenixActor });
    await tempSpell.rollDamage({});
  } finally {
    endingToken.setTarget(false, { releaseOthers: true, user: game.user });
    for (const t of previousTargets) t.setTarget(true, { releaseOthers: false, user: game.user });
  }
});

})();
