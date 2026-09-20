/**
 * Shared implementation behind the "shift Weredragon form" action, so a new
 * trigger can produce the exact same result as the three hotbar macros
 * (weredragon-form-{humanoid,hybrid,animal}.json) without re-deriving their
 * logic a third or fourth time -- toggle Change Shape, grant/revoke the
 * Weredragon Breath Weapon spell, and prompt/clear Bizarre Transformation,
 * all in one place.
 *
 * Added in v2.32.0 alongside initiative-form-prompt.js, which needed to
 * trigger this same sequence from a new place (rolling initiative) and
 * "as if the macro was triggered" was the explicit ask -- factoring the
 * macros' own command bodies out here and having both the macros and the
 * new hook call it is the established convention in this module for
 * exactly this situation (see promptBizarreTransformation/
 * removeBizarreTransformation, applyHealingTransformation,
 * getOrCreateInnateEntry -- all shared the same way via the module API set
 * up in Hooks.once("init", ...)).
 *
 * The three macros were rewritten to thin wrappers that resolve the acting
 * actor and call `mod.shiftWeredragonForm(actor, "<form>")` -- their own
 * previously-inline toggle/breath-weapon/Bizarre-Transformation logic
 * moved here unchanged, not reimplemented.
 *
 * **v2.34.0, on request: the transformation-sound half was removed
 * entirely** (along with every TokenImage rule element and
 * scripts/form-sounds.js -- see CLAUDE.md's removal section for the full
 * list). `FORMS` no longer carries a `soundUrl` per form, and this
 * function no longer calls `foundry.audio.AudioHelper.play(...)`.
 */

(() => {

const MODULE_ID = "phil-pf2e-weredragon";
const BREATH_WEAPON_UUID = "Compendium.phil-pf2e-weredragon.weredragon-feats.Item.WdrgnBreathSpl01";

const FORMS = {
  humanoid: { label: "Humanoid" },
  hybrid: { label: "Hybrid" },
  animal: { label: "Animal" },
};

async function shiftWeredragonForm(actor, form) {
  const data = FORMS[form];
  if (!actor || !data) return false;

  const result = await actor.toggleRollOption("all", "change-shape", null, true, form);
  if (result === null) {
    ui.notifications.error(
      `Could not find the Change Shape toggle on ${actor.name} -- do they have the Werecreature Dedication feat (this module's patched version)?`,
    );
    return false;
  }

  ui.notifications.info(`${actor.name} shifts to ${data.label} form.`);

  const mod = game.modules.get(MODULE_ID);

  if (form === "humanoid") {
    const breathWeapon = actor.items.find((i) => i.type === "spell" && i.system.slug === "weredragon-breath-weapon");
    if (breathWeapon) await breathWeapon.delete();
    if (mod?.removeBizarreTransformation) await mod.removeBizarreTransformation(actor);
    return true;
  }

  if (!actor.items.find((i) => i.type === "spell" && i.system.slug === "weredragon-breath-weapon")) {
    const source = await fromUuid(BREATH_WEAPON_UUID);
    if (source) await actor.createEmbeddedDocuments("Item", [source.toObject()]);
  }

  if (mod?.promptBizarreTransformation) await mod.promptBizarreTransformation(actor);
  return true;
}

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.shiftWeredragonForm = shiftWeredragonForm;
});

})();
