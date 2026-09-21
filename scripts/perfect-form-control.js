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
 *
 * **Extended on request: the granted battle-form effect itself also needs
 * its duration forced unlimited, not just the Untamed Form wrapper.**
 * Picking a form from the Untamed Form picker's ChoiceSet grants a
 * *second*, separate embedded item on the actor (e.g. "Spell Effect:
 * Animal Form (Ape)") via that same GrantItem rule element -- its own
 * `system.duration` is whatever the vanilla battle form normally uses (1
 * minute for most, 10 minutes for Pest Form), completely independent of
 * the wrapper's own duration. Forcing only the wrapper unlimited left the
 * actual battle form expiring on schedule regardless, reverting the
 * character out of the shape Perfect Form Control was supposed to let
 * them hold indefinitely. Fixed by matching on any of this module's own
 * tracked battle-form slugs, not just "untamed-form" -- both the wrapper
 * and the granted form effect fire their own `createItem` event (GrantItem
 * creates them as sibling embedded items, not nested), so the same one
 * hook covers both without any ordering concerns: Perfect Form Control is
 * a pre-existing feat being queried, not something created in the same
 * batch.
 */

(() => {

// Every slug this module's own patched spell effects use -- the Untamed
// Form wrapper itself, plus all 17 forms its ChoiceSet can grant. Kept as
// a flat literal list (not derived) since there's no single shared marker
// across all of them -- same convention as BATTLE_FORM_SLUGS in
// bizarre-transformation.js.
const TRACKED_SLUGS = new Set([
  "untamed-form",
  "aerial-form",
  "dragon-form",
  "monstrosity-form",
  "monstrosity-form-kaiju",
  "animal-form-ape",
  "animal-form-bear",
  "animal-form-bull",
  "animal-form-canine",
  "animal-form-cat",
  "animal-form-crab",
  "animal-form-crocodile",
  "animal-form-deer",
  "animal-form-frog",
  "animal-form-orca",
  "animal-form-seal",
  "animal-form-shark",
  "animal-form-snake",
]);

Hooks.on("createItem", (item, _options, userId) => {
  if (userId !== game.user.id) return;
  if (!(item.parent instanceof Actor)) return;
  if (item.type !== "effect") return;
  if (!TRACKED_SLUGS.has(item.system?.slug)) return;

  const actor = item.parent;
  const hasPerfectFormControl = actor.itemTypes.feat.some((f) => f.name === "Perfect Form Control");
  if (!hasPerfectFormControl) return;

  item.update({
    "system.duration": { expiry: null, sustained: false, unit: "unlimited", value: -1 },
  });
});

})();
