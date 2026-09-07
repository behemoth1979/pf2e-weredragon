/**
 * Automates the recharge timer both Breath Weapon (Kaiju) and every
 * Dragon Breath spell describe in their own real text -- "Once activated,
 * it can't be used again for 1d4 rounds" -- by creating a real "Breath
 * Weapon Recharging (Weredragon Homebrew)" effect item on the caster
 * whenever one of those spells is cast, with a freshly-rolled 1d4 as its
 * duration. Previously this was only a rollable inline link in each
 * spell's own description (`[[/r 1d4 #Recharge Breath Weapon]]`); this
 * script doesn't replace that text, it adds a real, visible, expiring
 * effect alongside it.
 *
 * **Detecting the cast, matching this repo's own established pattern**
 * (see healing-transformation.js's own docstring for the full source
 * trace): `ChatMessagePF2e#get item()` already resolves a spell chat
 * message's `.item` back to the correctly-heightened spell instance, so
 * a plain `Hooks.on("createChatMessage", ...)` handler checking
 * `message.item?.slug` is sufficient -- no need to parse chat-card HTML.
 * Matches both `breath-weapon-kaiju` (the Kaiju spell's own explicit
 * slug) and any `dragon-breath-<type>` slug (all 40 Dragon Breath
 * spells already have one, per this repo's own established
 * always-set-an-explicit-slug convention -- see the "system.slug
 * overrides" section of CLAUDE.md).
 *
 * **Only one recharge timer is ever active at a time**: any existing
 * copy of the effect (matched by its own explicit slug,
 * "breath-weapon-recharging") is deleted before creating a fresh one,
 * rather than stacking multiple simultaneously -- recasting the breath
 * weapon while already recharging (if the player somehow bypasses the
 * recharge, e.g. via GM fiat) just resets the timer instead of layering
 * a second, redundant effect.
 *
 * **Duration is a real rolled 1d4, not a fixed placeholder**: pf2e's own
 * effect duration schema (`system.duration.value`) only accepts a plain
 * number, not a dice formula -- confirmed against a real vanilla effect
 * with a rounds-based duration ("Effect: Meddling Futures", `duration:
 * {value: 0, unit: "rounds", expiry: "turn-end", sustained: false}`),
 * which is also where the `expiry: "turn-end"` convention here is copied
 * from. So the compendium item's own stored duration.value is just a
 * placeholder (1); this script actually rolls `1d4` fresh each time and
 * overwrites it before creating the effect.
 *
 * Same multi-client guard as every other createItem/createChatMessage
 * hook in this module (`userId === game.user.id`), so only the client
 * that actually cast the spell applies this, not every observing client.
 *
 * **On request, extended to actually gate re-casting, not just show a
 * timer**: previously the spells had no Frequency field at all --
 * nothing stopped casting Breath Weapon or Dragon Breath again
 * immediately, the recharge was purely a visual reminder. Added
 * `system.frequency: {max: 1, per: "round", value: 1}` to all 41
 * affected spell files (breath-weapon-kaiju-spell.json and all 40
 * dragon-breath-<type>-spell.json), which makes pf2e's own normal
 * spellcasting UI mark the spell "expended" after one cast, same as any
 * other limited-use spell. `per: "round"` is the closest real interval
 * pf2e's Frequency schema supports to "1d4 rounds" (there's no such
 * variable-length option) -- confirmed via source (the same rest-based
 * refresh routine `restForTheNight`/`takeABreather` use) that pf2e never
 * auto-refreshes a `per: "round"`/`per: "turn"` frequency on its own
 * outside of an explicit rest/breather action, so this doesn't fight
 * with or prematurely undercut the real 1d4-round timer -- the *only*
 * thing that resets it is this script's own `deleteItem` handler below,
 * once the Breath Weapon Recharging effect is actually deleted (see the
 * correction further down for what actually triggers that deletion in
 * practice).
 *
 * Wrapped in an IIFE per this module's own standing practice (see
 * bizarre-transformation.js for the cross-module global-scope collision
 * this guards against).
 */

(() => {

const BREATH_WEAPON_RECHARGE_SLUG = "breath-weapon-recharging";
const RECHARGE_EFFECT_UUID = "Compendium.phil-pf2e-weredragon.weredragon-feats.Item.BreathWpnRchrg01";

function isBreathWeaponSpell(slug) {
  return slug === "breath-weapon-kaiju" || !!slug?.startsWith("dragon-breath-");
}

async function applyBreathWeaponRecharge(actor) {
  const existing = actor.items.find((i) => i.type === "effect" && i.slug === BREATH_WEAPON_RECHARGE_SLUG);
  if (existing) await existing.delete();

  const source = await fromUuid(RECHARGE_EFFECT_UUID);
  if (!source) return;

  const roll = await new Roll("1d4").evaluate();
  const data = source.toObject();
  data.system.duration.value = roll.total;

  await actor.createEmbeddedDocuments("Item", [data]);
}

Hooks.on("createChatMessage", async (message, _options, userId) => {
  if (userId !== game.user.id) return;

  const item = message.item;
  if (item?.type !== "spell" || !isBreathWeaponSpell(item.slug)) return;

  const actor = message.actor;
  if (!actor) return;

  await applyBreathWeaponRecharge(actor);
});

// **Bug found in play, fixed in v2.30.1: relying solely on the deleteItem
// handler below (via pf2e's own EffectTracker auto-removing the effect)
// never actually fired for the user in real play, even in active combat
// with the automation.removeExpiredEffects world setting enabled.**
// Root-caused live: EffectTracker only performs its actual removal pass
// inside `refresh()`, which is wired to the `updateWorldTime` hook -- but
// confirmed live, over CDP, that simply advancing combat turns
// (`combat.nextTurn()`) does NOT itself advance world time on this
// install, so `updateWorldTime` never fires, `refresh()` never runs on
// its own, and the effect just sits there indefinitely with `remaining
// <= 0` but never actually gets removed -- confirmed by manually calling
// `game.pf2e.effectTracker.refresh()` afterward, which immediately
// removed it. Whether world time auto-advances with combat turns is a
// per-world Foundry/pf2e configuration matter, not something this module
// can rely on being on.
//
// Fixed by not depending on that mechanism at all: checks the ending
// combatant's own Breath Weapon Recharging effect directly on the same
// real `pf2e.endTurn` hook `inexorable.js`/`shroud-of-flame.js` already
// use successfully elsewhere in this exact module, and deletes it
// directly once its own `remainingDuration.remaining` reaches zero --
// which still correctly triggers the deleteItem handler below (a real
// deletion either way, regardless of what triggered it), so the
// frequency-reset logic doesn't need to be duplicated here.
Hooks.on("pf2e.endTurn", async (combatant, _encounter, userId) => {
  if (userId !== game.user.id) return;

  const actor = combatant.actor;
  if (!actor) return;

  const effect = actor.items.find((i) => i.type === "effect" && i.slug === BREATH_WEAPON_RECHARGE_SLUG);
  if (!effect) return;

  if (effect.remainingDuration.remaining <= 0) {
    await effect.delete();
  }
});

// Refreshes the breath weapon spell's own Frequency (see the note above
// on why one was added at all) back to its max once the recharge timer
// actually expires, so the spell becomes castable again without the
// player needing to manually reset it.
//
// Reacting to the effect's own deletion, not a timer of this script's
// own, is deliberate: confirmed directly in EffectTracker's real source
// (compiled system code) that expired effects are removed via a genuine
// `actor.deleteEmbeddedDocuments("Item", ...)` call -- a real
// `deleteItem` hook firing, not just a cosmetic "expired" flag -- and
// only when the `automation.removeExpiredEffects` world setting is on
// (confirmed enabled on the dev server; this is pf2e's own default).
// Same "one client acts" guard EffectTracker's own removal code uses
// (`actor.primaryUpdater === game.user`), mirrored here as `userId ===
// game.user.id` to match every other hook in this module.
Hooks.on("deleteItem", async (item, _options, userId) => {
  if (userId !== game.user.id) return;
  if (!(item.parent instanceof Actor)) return;
  if (item.type !== "effect" || item.slug !== BREATH_WEAPON_RECHARGE_SLUG) return;

  const actor = item.parent;
  const spells = actor.items.filter((i) => i.type === "spell" && isBreathWeaponSpell(i.slug) && i.system.frequency);

  for (const spell of spells) {
    if (spell.system.frequency.value < spell.system.frequency.max) {
      await spell.update({ "system.frequency.value": spell.system.frequency.max });
    }
  }
});

})();
