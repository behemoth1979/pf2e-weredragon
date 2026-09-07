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

})();
