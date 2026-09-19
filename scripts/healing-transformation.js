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
 * plain `Roll` to actually casting that spell instead -- constructs a
 * temporary, unembedded item parented to the actor, then calls
 * `.rollDamage({skipDialog: true})` on it (same shape shroud-of-flame.js
 * already uses).
 *
 * **Switched to fully automatic (roll + auto-apply) in v2.29.0 on
 * request, then switched back to roll-only in v2.32.0, again on
 * request.** v2.29.0's ask was "roll and apply... without needing to
 * click, it just adds extra clicks and dialogue boxes for no reason" --
 * implemented via `tempSpell.rollDamage(...)` (confirmed directly from
 * `DamagePF2e.roll()`'s real source to return the evaluated `DamageRoll`
 * itself, not the created chat message, so `.total` was available with
 * no separate lookup) followed by `actor.applyDamage({damage: -total,
 * token})` -- exactly what the real "Apply Healing" button calls under
 * the hood (traced through `applyDamageFromMessage()`), confirmed to
 * still correctly trigger "healing-received" bonuses (Moonweave, the
 * third-party Overflowing Life relic gift) the same way a real click
 * would. The posted chat card's own Apply Healing button was then
 * suppressed (`flags.pf2e.suppressDamageButtons: true`) so it couldn't
 * double-apply the healing if clicked -- though that flag, confirmed
 * live, doesn't actually hide the button, only leaves it inert.
 *
 * **v2.32.0 reverted the auto-apply half only** -- per the new request,
 * this should roll but not automatically apply. `applyHealingTransformation`
 * now just calls `tempSpell.rollDamage(skipDialogEvent)` and stops there;
 * the posted chat card's Apply Healing button is left fully functional
 * (no `suppressDamageButtons` flag), same as any other spell's damage
 * card -- the player clicks it themselves when ready. This is the
 * identical "cast the real spell, manual Apply Healing click" shape the
 * intermediate (pre-v2.29.0) version already had, now current again.
 *
 * **This file is also where the actual `skipDialog` fix finally landed --
 * see the correction below for why the two earlier attempts (`{}`, then
 * `{skipDialog: true}`) were both wrong the whole time**, not just the
 * first one. That fix is unaffected by the v2.32.0 revert -- still
 * needed regardless of whether the result gets auto-applied.
 *
 * **Correction, found in play on a Forge-hosted instance (pf2e 8.5.0):
 * `rollDamage({})` popped a `DamageModifierDialog` instead of rolling
 * immediately.** Diagnosed at the time (wrongly, see below) as `getDamage`'s
 * own `{skipDialog: true}` default parameter never applying because
 * `rollDamage` always passes a real (non-`undefined`) object. "Fixed" by
 * passing `{skipDialog: true}` explicitly.
 *
 * **Second correction, found in play while building the v2.29.0
 * automatic-apply feature above: that first fix never actually worked,
 * in any version, the whole time.** Re-diagnosed by reading
 * `SpellPF2e#rollDamage(e, t)` and `eventToRollParams(e, t)` directly,
 * together this time rather than stopping at `rollDamage`'s own line:
 * `rollDamage` calls `getDamage({target, ...eventToRollParams(e, {type:
 * "damage"})})` -- `e` (our `{skipDialog: true}`) is treated purely as a
 * *DOM event* here, never spread into the options object directly.
 * `eventToRollParams`'s own real body never reads `e.skipDialog` at
 * all -- it computes its own `skipDialog` entirely from `game.user
 * .settings.showDamageDialogs` (this user's personal client setting)
 * and, only if `e` passes `isRelevantEvent` (has `ctrlKey`/`metaKey`/
 * `shiftKey` properties), whether `e.shiftKey` is set (shift-click
 * inverts the user's own default, the same convention real check/damage
 * rolls use everywhere in pf2e). Since our old `{skipDialog: true}`
 * object has none of those three properties, `isRelevantEvent` was
 * always `false`, and the function fell straight to `return {skipDialog:
 * r}` where `r` depends solely on the user's own setting -- our own
 * `skipDialog` value was silently discarded every single time. The
 * earlier "fix" only ever appeared to work because whichever account
 * verified it at the time happened to have "Show Damage Dialogs"
 * disabled as their own personal setting already, unrelated to the code
 * change. Confirmed directly this time, live over CDP on an account with
 * that setting *enabled*: the old `{skipDialog: true}` object still
 * popped the dialog every time.
 *
 * **The actual, verified fix**: since `skipDialog` can only ever come
 * out to `shiftKey ? !r : r`, there's no way to force an unconditional
 * `true` through this path other than computing `shiftKey` from the
 * user's own current setting so the result always lands on `true`
 * regardless of what that setting is: `shiftKey: !!game.user.settings
 * .showDamageDialogs` (paired with `ctrlKey: false, metaKey: false` so
 * the object satisfies `isRelevantEvent`'s property check). Verified
 * live, on the same account that reproduced the bug: this object
 * produces no dialog, while the literal `{skipDialog: true}` still does.
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
 * Confirmed (not just suspected) the identical gap in shroud-of-flame.js
 * too, via the same live-CDP verification, and fixed it there the same
 * way -- see that script's own docstring.
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

  // {skipDialog: true} passed directly to rollDamage() does NOT work --
  // confirmed live this never actually did anything, in any version.
  // SpellPF2e#rollDamage(e, t) treats its first argument as a DOM event,
  // not an options bag: it calls getDamage({target, ...eventToRollParams
  // (e, {type: "damage"})}), and eventToRollParams's own real
  // implementation never reads e.skipDialog at all -- it computes its
  // own skipDialog purely from game.user.settings.showDamageDialogs
  // (this user's personal Foundry client setting) and, only if `e` looks
  // like a real event (has ctrlKey/metaKey/shiftKey), whether e.shiftKey
  // is set. So the *only* way to reliably skip the dialog regardless of
  // that per-user setting is to fake a "shift-click": pass an object
  // satisfying isRelevantEvent (has all three key-modifier properties)
  // with shiftKey set to invert whatever the user's own setting would
  // otherwise produce. Confirmed live over CDP against the dev server on
  // an account with "Show Damage Dialogs" enabled: the literal
  // `{skipDialog: true}` this script previously passed still popped the
  // dialog every time; this fake-shift-click version does not.
  const skipDialogEvent = { ctrlKey: false, metaKey: false, shiftKey: !!game.user.settings.showDamageDialogs };

  // v2.32.0, on request ("roll, but not automatically applied"): just
  // rolls and posts the chat card. The card's own real Apply Healing
  // button is left fully live (this is a normal spell damage/healing
  // roll, nothing suppressed) -- the player clicks it themselves.
  await tempSpell.rollDamage(skipDialogEvent);
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
