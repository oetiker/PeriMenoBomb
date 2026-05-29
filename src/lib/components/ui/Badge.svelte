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
  // Tinted background only when bg is on. 40% of the chosen colour over the
  // surface reads as "this thing's colour is X" without clashing with the
  // glyph in either duotone or native mode.
  const background = $derived(bg ? `color-mix(in srgb, ${color} 40%, var(--c-surface))` : 'transparent');
  // Without the framing disc the glyph needs to grow to fill the visual slot
  // it used to occupy. 0.95 ≈ edge-to-edge. 0.5 leaves enough air between the
  // emoji's rendered glyph (which extends ~20% beyond its font-size box for
  // Apple/Noto/Segoe Color Emoji) and the disc edge.
  const glyph = $derived(Math.round(size * (bg ? 0.5 : 0.95)));
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
    /* No overflow clipping: the bg fills the border-radius circle natively
       with consistent anti-aliasing. Glyph is sized small enough to not
       extend past the disc edge, so no mask is needed. */
  }
  .emoji {
    line-height: 1;
    /* Apple Color Emoji etc. — system font picks the colour table. */
    font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif;
    /* Color-emoji fonts have ascender > descender, so the rendered glyph sits
       ~0.5px above the line-box centre. Nudge it down so the visible glyph
       lines up with the geometric disc centre. */
    transform: translateY(0.03em);
  }
</style>
