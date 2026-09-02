/**
 * Automates the "Bizarre Transformation" druid feat, which the official
 * content only implements as a reminder note + a flag toggle (checked
 * directly against the real item source -- its rules are an ItemAlteration
 * that adds text to the Untamed Form spell's description, and a RollOption
 * toggle; neither one actually changes a strike's damage type). This fills
 * that gap: whenever a tracked battle-form effect is created, or the
 * Weredragon Hybrid/Animal macros are used, prompt for an attack + a new
 * damage type and apply it for real.
 *
 * Mechanism, confirmed against real official content before use (not
 * guessed): ItemAlteration can't reach synthetic battle-form strikes at all
 * (it only iterates the actor's real embedded items -- confirmed by reading
 * item-alteration/rule-element.ts). AdjustStrike's own "definition" field
 * can't see actor-level roll options like "battle-form" (confirmed the hard
 * way with the cold iron house rule). DamageAlteration is the right tool:
 * it operates through actor.synthetics.damageAlterations against any
 * strike-damage roll regardless of origin, and its predicate is the normal
 * kind (sees actor-level options fine) -- copied from the real "Stance: Asp
 * Stance" effect (packs/pf2e/feat-effects/stance-asp-stance.json upstream),
 * which does exactly this (override an unarmed strike's damage type while
 * a condition holds). AdjustStrike (property: "traits") adds the matching
 * trait per RAW ("the chosen attack gains the appropriate trait") -- traits
 * *is* a valid AdjustStrike property, and its narrower "definition" field
 * is fine here since it only needs an item-level option (item:slug:X), not
 * an actor-level one.
 *
 * Wrapped in an IIFE: Foundry loads every enabled module's plain
 * "scripts" entries as classic (non-module) <script> tags sharing one
 * global scope, not isolated per module. A top-level `const MODULE_ID`
 * here collided with the sibling phil-pf2e-hero-points module's own
 * identically-named top-level `const MODULE_ID` (found live: whichever
 * module's script loaded second threw "Identifier 'MODULE_ID' has
 * already been declared" and silently failed to execute at all --
 * this file's own top-level declaration was the one erroring, so this
 * feature just stopped working with no other symptom). Scoping every
 * top-level declaration inside a function eliminates this whole class
 * of cross-module collision regardless of what identifiers any other
 * module happens to use.
 */

(() => {

const MODULE_ID = "phil-pf2e-weredragon";
const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "electricity", "fire", "poison", "piercing", "slashing"];

// Effects whose creation means a tracked battle form just became active.
// Kept as a flat list of system.slug values rather than derived, since
// there's no single shared marker across all of them.
const BATTLE_FORM_SLUGS = new Set([
  "monstrosity-form-kaiju",
  "monstrosity-form",
  "aerial-form",
  "dragon-form",
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

async function promptBizarreTransformation(actor) {
  if (!actor) return;

  // Embedded-item creation and Change Shape's toggle update both fire their
  // hooks slightly before the actor has finished re-preparing derived data
  // (system.actions) with the new form's strikes; give it a beat.
  await new Promise((resolve) => setTimeout(resolve, 100));

  const unarmedStrikes = (actor.system.actions ?? []).filter(
    (strike) => strike.item?.system?.category === "unarmed",
  );
  if (unarmedStrikes.length === 0) return;

  const strikeOptions = unarmedStrikes
    .map((strike) => `<option value="${strike.slug}">${strike.label}</option>`)
    .join("");
  const typeOptions = DAMAGE_TYPES.map(
    (type) => `<option value="${type}">${type[0].toUpperCase()}${type.slice(1)}</option>`,
  ).join("");

  const content = `
    <form>
      <p>Bizarre Transformation: change one unarmed attack's damage type (and give it the matching trait).</p>
      <div class="form-group">
        <label>Attack</label>
        <select name="strike">${strikeOptions}</select>
      </div>
      <div class="form-group">
        <label>New damage type</label>
        <select name="damageType">${typeOptions}</select>
      </div>
    </form>`;

  const result = await Dialog.wait(
    {
      title: "Bizarre Transformation",
      content,
      buttons: {
        apply: {
          label: "Apply",
          callback: (html) => ({
            strike: html.find('[name="strike"]').val(),
            damageType: html.find('[name="damageType"]').val(),
          }),
        },
        skip: {
          label: "Skip",
          callback: () => null,
        },
      },
      default: "apply",
      close: () => null,
    },
    { width: 320 },
  );

  if (!result) return;

  // Only one Bizarre Transformation change should be active at a time.
  const existing = actor.items.find((i) => i.getFlag(MODULE_ID, "bizarreTransformation"));
  if (existing) await existing.delete();

  await actor.createEmbeddedDocuments("Item", [
    {
      name: `Bizarre Transformation (${result.strike} → ${result.damageType})`,
      type: "effect",
      img: "icons/magic/control/hypnosis-mesmerism-eye.webp",
      system: {
        description: {
          value: `<p><em>Homebrew: automates Bizarre Transformation.</em></p><p>Your ${result.strike} attack deals ${result.damageType} damage instead of its normal type, and gains the ${result.damageType} trait.</p>`,
        },
        duration: { value: -1, unit: "unlimited", expiry: null, sustained: false },
        tokenIcon: { show: false },
        traits: { rarity: "common", value: [] },
        rules: [
          {
            key: "DamageAlteration",
            mode: "override",
            predicate: [`item:slug:${result.strike}`],
            property: "damage-type",
            selectors: ["strike-damage"],
            value: result.damageType,
          },
          {
            key: "AdjustStrike",
            mode: "add",
            property: "traits",
            definition: [`item:slug:${result.strike}`],
            value: result.damageType,
          },
        ],
      },
      flags: { [MODULE_ID]: { bizarreTransformation: true } },
    },
  ]);

  ui.notifications.info(`Bizarre Transformation: ${actor.name}'s ${result.strike} now deals ${result.damageType} damage.`);
}

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.promptBizarreTransformation = promptBizarreTransformation;
});

Hooks.on("createItem", (item, _options, userId) => {
  if (userId !== game.user.id) return;
  if (!(item.parent instanceof Actor)) return;
  if (item.type !== "effect") return;
  if (!BATTLE_FORM_SLUGS.has(item.system?.slug)) return;

  promptBizarreTransformation(item.parent);
});

})();
