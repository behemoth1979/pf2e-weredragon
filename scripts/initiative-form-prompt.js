/**
 * On request: when initiative is rolled, prompt to spend the Change
 * Shape free action to shift into Hybrid or Animal form -- if the player
 * picks one, the transformation happens exactly as if the corresponding
 * "Weredragon Form" hotbar macro had been triggered (same shared
 * `shiftWeredragonForm(actor, form)` in weredragon-form-shift.js).
 *
 * **Detecting "initiative was just rolled" without guessing**: confirmed
 * directly from the compiled pf2e system source (`CheckPF2e.roll`) that a
 * check roll's chat message always carries `flags.pf2e.context.type`, set
 * from the roll's own requested `type` (falling back to `"check"` if
 * unset: `type: t.type ?? "check"`), and that `EncounterTrackerPF2e`'s own
 * "roll-initiative" action explicitly rolls with `eventToRollParams(event,
 * {type: "check"})` overridden to `type: "initiative"` inside
 * `ActorPF2e#initiative.roll()` -- confirmed by the same source building
 * `core: {initiativeRoll: true}` on the message specifically `t.type ===
 * "initiative"`. So `message.flags.pf2e.context.type === "initiative"` is
 * the real, correct hook -- fires once per initiative roll, on the same
 * `createChatMessage` event this module already relies on elsewhere
 * (healing-transformation.js, breath-weapon-recharge.js).
 *
 * **Only prompts the actor's own client, not the GM's** (unless the GM IS
 * the one playing that actor): `actor.primaryUpdater !== game.user` skips
 * every other connected client -- the same guard aeon-stone-healing.js
 * already uses for the identical "exactly one client should act" need,
 * confirmed against `EffectTracker`'s own use of the same check.
 *
 * **Only prompts while currently in Humanoid form**: gated on
 * `actor.rollOptions.all["change-shape:humanoid"]` -- the roll option
 * `RollOptionRuleElement` sets for Werecreature Dedication's toggleable
 * Change Shape option when "humanoid" (the default suboption) is the
 * current selection, confirmed directly by reading
 * `RollOptionRuleElement#setOption()` in the compiled source: a toggled-on
 * suboption sets both the bare `change-shape` option and the
 * `change-shape:<selection>` option. Also gated on the bare `change-shape`
 * option being present at all, so this never prompts an actor without the
 * Werecreature Dedication feat (this module's patched version).
 *
 * Not live-verified this session (no running game session was available
 * to test against) -- built and reasoned through the compiled system
 * source directly rather than assumed, same standard this module holds
 * elsewhere, but worth confirming the first time initiative is actually
 * rolled with this feat in play.
 */

(() => {

const MODULE_ID = "phil-pf2e-weredragon";

Hooks.on("createChatMessage", async (message) => {
  const context = message.flags?.pf2e?.context;
  if (context?.type !== "initiative") return;

  const actor = message.actor;
  if (!actor) return;
  if (actor.primaryUpdater !== game.user) return;

  const rollOptions = actor.rollOptions?.all ?? {};
  if (!rollOptions["change-shape"]) return;
  if (!rollOptions["change-shape:humanoid"]) return;

  const mod = game.modules.get(MODULE_ID);
  if (!mod?.shiftWeredragonForm) return;

  const choice = await Dialog.wait(
    {
      title: "Change Shape (free action)",
      content: `<p>${actor.name} rolled initiative. Spend the free action to shift form?</p>`,
      buttons: {
        hybrid: { label: "Hybrid Form", callback: () => "hybrid" },
        animal: { label: "Animal Form", callback: () => "animal" },
        skip: { label: "Stay Humanoid", callback: () => null },
      },
      default: "skip",
      close: () => null,
    },
    { width: 320 },
  );

  if (!choice) return;
  await mod.shiftWeredragonForm(actor, choice);
});

})();
