/**
 * "Perfect Form Control" (real druid class feat, level 18) says: "When you
 * use Form Control, instead of lasting 1 hour, Untamed Form's duration is
 * unlimited (you can still Dismiss it)." Confirmed directly against the
 * real upstream item (packs/pf2e/feats/class/druid/level-18/perfect-form-
 * control.json): its own "rules" array is empty -- pure descriptive text,
 * same as Bizarre Transformation and Healing Transformation before they
 * were automated in this module. Form Control itself (the level-4
 * prerequisite feat) is likewise just a spellshape toggle + a reminder
 * ItemAlteration on Untamed Form's description -- neither feat has any
 * rule element that actually changes a granted effect's duration.
 *
 * Fix: when this module's own patched "Spell Effect: Untamed Form
 * (Weredragon Homebrew)" effect (spell-effect-untamed-form.json, explicit
 * system.slug "untamed-form") is created on an actor who has Perfect Form
 * Control, immediately overwrite its duration to the real "unlimited,
 * still dismissible" shape -- {expiry: null, sustained: false, unit:
 * "unlimited", value: -1} -- copied verbatim from a real vanilla effect
 * with that exact duration (Effect: A Little Bird Told Me...,
 * packs/pf2e/feat-effects/effect-a-little-bird-told-me.json), not
 * invented. A single createItem hook covers every way this effect can
 * appear on an actor -- manual drag-and-drop from the compendium and the
 * untamed-form-toggle.json hotbar macro's own createEmbeddedDocuments call
 * -- both go through the same document-creation path, unlike Bizarre/
 * Healing Transformation's RollOption-toggle triggers, which needed a
 * second macro-call path because no item creation happens for those.
 *
 * Matching the feat by name, not slug: confirmed directly from the real
 * source (src/module/item/base/document.ts's `get slug()` is a bare
 * `return this.system.slug` with no name-derived fallback, and that
 * field's schema default is `initial: null` with nothing else ever
 * populating it) that a vanilla item with no explicit system.slug in its
 * compendium source -- which Perfect Form Control has, checked directly --
 * stays slug-null forever, on the compendium copy and any actor's embedded
 * copy alike. Same gotcha already documented for aeon-stone-healing.js's
 * "Effect: Aeon Stone Resonance" check; matching by exact name is the
 * correct, established workaround here too.
 */

(() => {

Hooks.on("createItem", (item, _options, userId) => {
  if (userId !== game.user.id) return;
  if (!(item.parent instanceof Actor)) return;
  if (item.type !== "effect") return;
  if (item.system?.slug !== "untamed-form") return;

  const actor = item.parent;
  const hasPerfectFormControl = actor.itemTypes.feat.some((f) => f.name === "Perfect Form Control");
  if (!hasPerfectFormControl) return;

  item.update({
    "system.duration": { expiry: null, sustained: false, unit: "unlimited", value: -1 },
  });
});

})();
