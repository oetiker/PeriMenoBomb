<script lang="ts">
  import { emojiDuotoneFilter } from '$lib/utils/color';
  type Props = {
    icon: string;
    color: string;
    /** When true, recolour the emoji to the chosen hue. When false, keep the
        native colourful emoji and let the tinted background carry the colour
        signal instead. */
    duotone?: boolean;
    /** When true, render the chosen-colour circle behind the emoji. When false
        the badge becomes a transparent box around a larger glyph — the icon
        carries the colour itself (via duotone) without the disc framing. */
    bg?: boolean;
    size?: 20 | 28 | 36;
    archived?: boolean;
    title?: string;
  };
  let {
    icon,
    color,
    duotone = true,
    bg = true,
    size = 28,
    archived = false,
    title
  }: Props = $props();

  const filter = $derived(duotone ? emojiDuotoneFilter(color) : 'none');
  // Tinted background only when bg is on. 18% of the chosen colour over the
  // surface reads as "this thing's colour is X" without clashing with the
  // glyph in either duotone or native mode.
  const background = $derived(bg ? `color-mix(in srgb, ${color} 18%, var(--c-surface))` : 'transparent');
  // Without the framing disc the glyph needs to grow to fill the visual slot
  // it used to occupy. 0.95 ≈ edge-to-edge, 0.6 ≈ same body weight as a
  // duotone-tinted lucide icon used to have inside the circle.
  const glyph = $derived(Math.round(size * (bg ? 0.6 : 0.95)));
</script>

<span
  class="badge"
  style="background:{background}; width:{size}px; height:{size}px; opacity:{archived ? 0.5 : 1};"
  aria-label={title}
>
  <span class="emoji" style="font-size:{glyph}px; filter:{filter};">{icon}</span>
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;
    overflow: hidden;
  }
  .emoji {
    line-height: 1;
    /* Apple Color Emoji etc. — system font picks the colour table. */
    font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif;
  }
</style>
