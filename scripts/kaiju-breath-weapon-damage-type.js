/**
 * The real "Heart of the Kaiju" feat has the player choose a damage type
 * (acid/cold/electricity/fire/sonic) for their Breath Weapon when they
 * take the feat, via a ChoiceSet rule element (`flag: "damageType"`) --
 * confirmed directly against this character's own copy of the item, not
 * assumed: its `system.rules[0]` is a real ChoiceSet with `selection:
 * "electricity"` (whatever was actually picked), and the feat's own
 * description text uses this exact resolvable path in an inline
 * @Damage[] roll: `@Damage[15d6[@item.flags.system.rulesSelections
 * .damageType]|options:area-damage]` -- so `flags.system.rulesSelections
 * .damageType` (an alias for `flags.pf2e.rulesSelections.damageType`,
 * confirmed via ItemPF2e#prepareBaseData's own `Object.defineProperty
 * (this.flags, "system", {get: () => this.flags.pf2e})`) is the real,
 * already-proven-correct place this choice lives.
 *
 * This module's own "Breath Weapon (Kaiju)" spell (breath-weapon-kaiju-
 * spell.json) is a *separate* item from the feat, though, so there's no
 * `{item|...}`-style resolvable string that can reach across to another
 * item on the same actor -- that syntax only ever resolves relative to
 * the item the rule element lives on. So this can't be done as a static
 * field on the spell itself; it needs a script that reads the feat's
 * choice and writes it onto the spell.
 *
 * Runs once, at grant time: whenever "Breath Weapon (Kaiju)" (matched by
 * its explicit `system.slug`, added specifically so this check doesn't
 * depend on a name-derived fallback that doesn't exist -- see the
 * aeon-stone-healing.js precedent) is created on an actor -- i.e. right
 * when Spell Effect: Monstrosity Form (Kaiju) grants it via GrantItem --
 * looks up that actor's own "Heart of the Kaiju" feat (real official
 * item, slug "heart-of-the-kaiju", untouched by this module) and copies
 * its chosen damage type onto the newly-granted spell's own
 * system.damage.0.type. Not an ongoing sync: the feat's choice is made
 * once, permanently, when the feat is first taken ("You can't change
 * this later," per its own description), so a one-time copy at grant
 * time is correct and simpler than re-checking on every cast.
 */

(() => {

Hooks.on("createItem", async (item, _options, userId) => {
  if (userId !== game.user.id) return;
  if (!(item.parent instanceof Actor)) return;
  if (item.type !== "spell") return;
  if (item.slug !== "breath-weapon-kaiju") return;

  const actor = item.parent;
  const feat = actor.itemTypes.feat.find((f) => f.slug === "heart-of-the-kaiju");
  const damageType = feat?.flags?.system?.rulesSelections?.damageType;
  if (!damageType) return;

  if (item.system.damage?.["0"]?.type === damageType) return;
  await item.update({ "system.damage.0.type": damageType });
});

})();
