/**
 * The real "Aeon Stone (Pearly White Spindle)" item's description says
 * "restoring 1 HP every minute" while invested, but the vanilla granted
 * effect ("Effect: Aeon Stone Resonance (Pearly White Spindle)") has zero
 * automation for it -- only a Resistance 1 void rule element. This adds the
 * missing healing, reusing the same updateWorldTime hook the pf2e system's
 * own effect-expiration tracker uses (see EffectTracker#refresh /
 * scripts/hooks/update-world-time.ts), rather than a custom timer.
 *
 * Out-of-combat only, per what was asked -- skipped while an encounter is
 * active. Any fractional minute within a given world-time jump isn't
 * carried over to the next call (e.g. two 40-second jumps heal 0 HP each,
 * not 1 HP combined).
 */
Hooks.on("updateWorldTime", async (_worldTime, dt) => {
  if (dt <= 0) return;
  if (game.combat?.started) return;

  const minutes = Math.floor(dt / 60);
  if (minutes <= 0) return;

  for (const actor of game.actors) {
    // Mirrors pf2e's own EffectTracker permission model: only the client
    // that's the actor's primary updater acts, so healing isn't applied
    // once per connected client.
    if (actor.primaryUpdater !== game.user) continue;
    if (!actor.isOfType("character")) continue;

    // The vanilla effect has no explicit system.slug set, and item.slug is
    // just system.slug with no name-fallback (that fallback only applies
    // inside getRollOptions(), not the raw property) -- so match by name.
    const hasResonance = actor.items.some(
      (i) => i.type === "effect" && i.name === "Effect: Aeon Stone Resonance (Pearly White Spindle)",
    );
    if (!hasResonance) continue;

    const hp = actor.system.attributes.hp;
    if (hp.value >= hp.max) continue;

    await actor.update({ "system.attributes.hp.value": Math.min(hp.max, hp.value + minutes) });
  }
});
