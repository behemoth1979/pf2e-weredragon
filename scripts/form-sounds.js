/**
 * Plays a transformation sound for everyone at the table whenever a
 * character shifts into any form this module has custom token art (and now
 * a matching .ogg) for. Supersedes kaiju-roar.js (renamed kaiju-roar.ogg ->
 * kaiju-form.ogg for consistency with every other form's sound file, and
 * extended to cover every other form the same way instead of just Kaiju).
 *
 * Two different shapes, matching how each form's own TokenImage rule
 * element already decides which art to show (reused verbatim, not
 * guessed):
 *
 * - Forms that are their own separate compendium item (Kaiju, all 13
 *   Animal Form animals, Aerial Form) are matched by the item's own fixed
 *   `system.slug` alone -- the same identity check their TokenImage RE
 *   uses implicitly by living in that one file.
 * - Forms that share one compendium item with several selectable types
 *   (Monstrosity Form's Cave Worm/Phoenix/Sea Serpent, Dragon Form's 40
 *   types) are matched by BOTH the shared item's slug AND the same
 *   predicate roll option (e.g. "monstrosity-form:cave-worm",
 *   "dragon-form:stormcrown") their own TokenImage RE is predicated on --
 *   copied directly from spell-effect-monstrosity-form.json and
 *   spell-effect-dragon-form.json rather than re-derived. Dragon Form only
 *   has a sound for Stormcrown (dragon-form.ogg), matching that it's the
 *   only dragon type with token art at all -- every other type simply
 *   never matches, same as their TokenImage REs never fire for them.
 *
 * Weredragon's own Hybrid/Animal forms (Werecreature Dedication's
 * change-shape toggle, not an item creation) can't be caught by a
 * createItem hook at all -- same limitation already documented for
 * Bizarre Transformation's trigger. Their sounds
 * (weredragon-hybrid.ogg/weredragon-animal.ogg) are instead played
 * directly from the two matching hotbar macros right after a successful
 * toggle, the same way those macros already call
 * promptBizarreTransformation().
 *
 * Wrapped in an IIFE per this module's standing practice (see
 * bizarre-transformation.js for why): classic <script> tags share one
 * global scope across every enabled module, so any top-level declaration
 * here risks colliding with an identically-named one in another module.
 */

(() => {

const SOUNDS_PATH = "modules/phil-pf2e-weredragon/assets/sounds";

// Forms that are their own item, matched by fixed slug alone.
const FIXED_SLUG_SOUNDS = {
  "monstrosity-form-kaiju": "kaiju-form.ogg",
  "animal-form-ape": "ape-form.ogg",
  "animal-form-bear": "bear-form.ogg",
  "animal-form-bull": "bull-form.ogg",
  "animal-form-canine": "canine-form.ogg",
  "animal-form-cat": "cat-form.ogg",
  "animal-form-crab": "crab-form.ogg",
  "animal-form-crocodile": "crocodile-form.ogg",
  "animal-form-deer": "deer-form.ogg",
  "animal-form-frog": "frog-form.ogg",
  "animal-form-orca": "orca-form.ogg",
  "animal-form-seal": "seal-form.ogg",
  "animal-form-shark": "shark-form.ogg",
  "animal-form-snake": "snake-form.ogg",
  "aerial-form": "aerial-form.ogg",
};

// Forms sharing one item, matched by slug + the same predicate roll option
// their own TokenImage RE uses.
const PREDICATED_SLUG_SOUNDS = [
  { slug: "monstrosity-form", rollOption: "monstrosity-form:cave-worm", sound: "cave-worm-form.ogg" },
  { slug: "monstrosity-form", rollOption: "monstrosity-form:phoenix", sound: "phoenix-form.ogg" },
  { slug: "monstrosity-form", rollOption: "monstrosity-form:sea-serpent", sound: "sea-serpent-form.ogg" },
  { slug: "dragon-form", rollOption: "dragon-form:stormcrown", sound: "dragon-form.ogg" },
];

function playFormSound(filename) {
  foundry.audio.AudioHelper.play(
    {
      src: `${SOUNDS_PATH}/${filename}`,
      volume: 0.8,
      autoplay: true,
      loop: false,
    },
    true,
  );
}

Hooks.on("createItem", async (item, _options, userId) => {
  // Only the client that actually caused the creation should trigger the
  // broadcast, otherwise every observing client would also try to play it.
  if (userId !== game.user.id) return;
  if (!(item.parent instanceof Actor)) return;
  if (item.type !== "effect") return;

  const slug = item.slug;
  if (!slug) return;

  if (slug in FIXED_SLUG_SOUNDS) {
    playFormSound(FIXED_SLUG_SOUNDS[slug]);
    return;
  }

  const candidates = PREDICATED_SLUG_SOUNDS.filter((e) => e.slug === slug);
  if (candidates.length === 0) return;

  // The item's own ChoiceSet-driven roll option isn't guaranteed to be
  // reflected in the actor's derived rollOptions yet at the instant this
  // hook fires -- same timing gap already documented and worked around in
  // bizarre-transformation.js for system.actions. Give it the same beat.
  await new Promise((resolve) => setTimeout(resolve, 100));

  const actor = item.actor;
  const match = candidates.find((e) => actor?.rollOptions.all[e.rollOption]);
  if (match) playFormSound(match.sound);
});

})();
