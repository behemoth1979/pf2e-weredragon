/**
 * Automates the Cave Worm Monstrosity Form's "Inexorable" ability:
 * "You automatically recover from the Paralyzed, Slowed, and Stunned
 * conditions at the end of each of your turns." Immunity to Immobilized
 * (also part of the real ability) is already handled by the shared
 * Spell Effect: Monstrosity Form item's own vanilla Immunity rule
 * element, untouched. Ignoring difficult terrain isn't automated here --
 * that's a movement-cost mechanic with no rule-element hook in Foundry,
 * left as a manual reminder in the granted effect's own description.
 *
 * Trigger: `Hooks.on("pf2e.endTurn", ...)` -- a real hook, confirmed by
 * reading `Combatant#onEndTurn()` directly in the compiled system
 * source, which calls `Hooks.callAll("pf2e.endTurn", this, encounter,
 * game.user.id)` at the end of every combatant's turn (`this` is the
 * Combatant whose turn just ended). The `game.user.id` third argument
 * is the system's own multi-client guard convention -- same shape as
 * the `userId` argument on `createItem`/`deleteItem` hooks used
 * elsewhere in this module -- so gating on `userId === game.user.id`
 * ensures only the one client that actually ended the turn (normally
 * the GM) performs the removal, not every connected client
 * independently.
 *
 * Detecting "is Inexorable currently granted": checks for an embedded
 * effect item with `system.slug === "inexorable"` -- inexorable-
 * effect.json, granted automatically while in Cave Worm Monstrosity
 * Form via a GrantItem rule element on the shared Spell Effect:
 * Monstrosity Form item (predicate: `monstrosity-form:cave-worm`).
 * That item's own `grantedBy` relationship defaults to `onDelete:
 * "cascade"` for non-physical items (confirmed via ItemPF2e#
 * prepareBaseData), so it's removed automatically when the granting
 * form ends -- no cleanup needed here.
 *
 * Removal API: `actor.conditions.bySlug(slug)` returns the active
 * condition item(s) for that slug (a real, widely-used pattern in the
 * compiled system source, e.g. `conditions.bySlug("encumbered")`) --
 * each is a real embedded Item, removed the same way any condition is
 * removed elsewhere in the system: deleting it outright, not
 * decrementing a value (Paralyzed/Stunned have no value to decrement
 * anyway; Slowed does, but "automatically recover from" means the
 * condition goes away entirely, not down by one).
 */

(() => {

const RECOVERED_CONDITIONS = ["paralyzed", "slowed", "stunned"];

Hooks.on("pf2e.endTurn", async (combatant, _encounter, userId) => {
  if (userId !== game.user.id) return;

  const actor = combatant.actor;
  if (!actor) return;

  const hasInexorable = actor.items.some((i) => i.type === "effect" && i.slug === "inexorable");
  if (!hasInexorable) return;

  for (const slug of RECOVERED_CONDITIONS) {
    for (const condition of actor.conditions.bySlug(slug)) {
      await condition.delete();
    }
  }
});

})();
