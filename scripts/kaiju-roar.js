/**
 * Plays kaiju-roar.ogg for everyone at the table when a character transforms
 * into Kaiju form (i.e. gets the patched "Spell Effect: Monstrosity Form
 * (Kaiju) [Weredragon Homebrew]" item), regardless of how it was applied
 * (drag onto sheet, the Untamed Form picker, a macro, etc.) — createItem
 * fires for any of those.
 */
Hooks.on("createItem", (item, options, userId) => {
  // Only the client that actually caused the creation should trigger the
  // broadcast, otherwise every observing client would also try to play it.
  if (userId !== game.user.id) return;
  if (!(item.parent instanceof Actor)) return;
  if (item.type !== "effect") return;
  if (item.system?.slug !== "monstrosity-form-kaiju") return;

  foundry.audio.AudioHelper.play(
    {
      src: "modules/phil-pf2e-weredragon/assets/sounds/kaiju-roar.ogg",
      volume: 0.8,
      autoplay: true,
      loop: false,
    },
    true,
  );
});
