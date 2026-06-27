<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import ColorPicker from '$lib/components/ui/ColorPicker.svelte';
  import { SUGGESTED_EMOJIS, looksLikeEmoji } from '$lib/icons/emoji';

  type Props = {
    open: boolean;
    icon: string;
    color: string;
    duotone: boolean;
    bg: boolean;
    name?: string;
    /** Called once with all four values when the user taps Speichern. The
        parent stays untouched until then — discarding via X or backdrop reverts
        nothing because the parent never saw the in-progress edit. */
    onSave: (patch: { icon: string; color: string; duotone: boolean; bg: boolean }) => void;
    onClose: () => void;
  };
  let { open, icon, color, duotone, bg, name, onSave, onClose }: Props = $props();

  // Local working copy. Each time the modal opens we snapshot the incoming
  // props — committing happens only on Speichern. Using untrack on the
  // initialiser keeps prop changes during an open session from clobbering
  // in-progress edits.
  let localIcon = $state(untrack(() => icon));
  let localColor = $state(untrack(() => color));
  let localDuotone = $state(untrack(() => duotone));
  let localBg = $state(untrack(() => bg));

  $effect(() => {
    if (!open) return;
    untrack(() => {
      localIcon = icon;
      localColor = color;
      localDuotone = duotone;
      localBg = bg;
    });
  });

  // The custom-emoji "+" tile overlays a transparent input. Tapping the tile
  // focuses it natively, which opens the on-screen keyboard; once a full emoji
  // grapheme lands we adopt it and blur to dismiss the keyboard again. Anything
  // non-emoji is left in place so multi-keystroke / IME composition can finish.
  function onCustomInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const v = el.value;
    if (!v) return;
    const parts = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v));
    const last = parts[parts.length - 1]?.segment ?? '';
    if (looksLikeEmoji(last)) {
      localIcon = last;
      el.value = '';
      el.blur();
    }
  }

  function save() {
    onSave({ icon: localIcon, color: localColor, duotone: localDuotone, bg: localBg });
    onClose();
  }
</script>

<Modal {open} {onClose} title="Icon Picker">
  <div class="preview">
    <Badge icon={localIcon} color={localColor} duotone={localDuotone} bg={localBg} size={36} />
    {#if name}<strong>{name}</strong>{/if}
  </div>

  <div class="field">
    <span class="label">Farbe</span>
    <ColorPicker value={localColor} onChange={(c) => (localColor = c)} compact />
  </div>

  <label class="toggle-row">
    <input
      type="checkbox"
      checked={localDuotone}
      onchange={(e) => (localDuotone = (e.currentTarget as HTMLInputElement).checked)}
    />
    <span>Emoji in Farbe einfärben</span>
    <span class="hint">aus = Original-Emoji</span>
  </label>

  <label class="toggle-row">
    <input
      type="checkbox"
      checked={localBg}
      onchange={(e) => (localBg = (e.currentTarget as HTMLInputElement).checked)}
    />
    <span>Mit Hintergrund-Kreis</span>
    <span class="hint">aus = nur Emoji, etwas grösser</span>
  </label>

  <div class="section-label">Vorschläge</div>
  <div class="grid" role="grid">
    <div class="add-emoji">
      <span class="plus" aria-hidden="true">+</span>
      <input
        class="add-input"
        type="text"
        oninput={onCustomInput}
        placeholder="Eigenes Emoji eintippen / einfügen…"
        aria-label="Eigenes Emoji eintippen"
        autocapitalize="off"
        autocomplete="off"
        inputmode="text"
      />
    </div>
    {#each SUGGESTED_EMOJIS as e}
      <button
        type="button"
        class="tile"
        class:selected={localIcon === e.glyph}
        onclick={() => (localIcon = e.glyph)}
        aria-label={e.name}
        title={e.name}
      >
        <Badge icon={e.glyph} color={localColor} duotone={localDuotone} bg={localBg} size={36} />
      </button>
    {/each}
  </div>

  {#snippet footer()}
    <button type="button" class="secondary" onclick={onClose}>Verwerfen</button>
    <button type="button" class="primary" onclick={save}>Speichern</button>
  {/snippet}
</Modal>

<style>
  .preview { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .section-label { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin: var(--sp-3) 0 var(--sp-2); }
  /* Shares its track size + gap with ColorPicker's compact grid so the colour
     swatches and emoji badges line up as one consistent grid of 36px circles. */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: var(--sp-2);
    justify-items: center;
    align-items: center;
  }
  .tile {
    width: 44px; height: 44px;
    display: flex; align-items: center; justify-content: center;
    border: 0; background: none;
    border-radius: 50%;
    cursor: pointer;
    padding: 0;
  }
  .tile.selected { background: color-mix(in srgb, var(--c-text) 12%, transparent); }
  /* Custom-emoji entry: a dashed "+" circle the same 36px size as the colour
     swatches and emoji badges, with a transparent input laid over it so a tap
     focuses the field natively and brings up the keyboard. */
  .add-emoji {
    position: relative;
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    border: 1px dashed var(--c-border-strong);
    border-radius: 50%;
    color: var(--c-text-dim);
    font-size: var(--fs-lg);
  }
  .add-input {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    margin: 0; padding: 0; border: 0;
    background: transparent;
    color: transparent;
    text-align: center;
    cursor: pointer;
    /* Hide the caret/typed text — the picked emoji shows in the preview, and the
       field self-clears after each grapheme. */
    caret-color: transparent;
  }
  .add-input::placeholder { color: transparent; }
  .add-input:focus { outline: 2px solid var(--c-primary); outline-offset: -2px; border-radius: 50%; }
  .field { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .label { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .toggle-row { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-3); cursor: pointer; }
  .toggle-row input { width: 18px; height: 18px; flex-shrink: 0; }
  .hint { color: var(--c-text-dim); font-size: var(--fs-xs); margin-left: auto; text-align: right; }
  .primary { background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .secondary { background: var(--c-surface-2); color: var(--c-text); border: 1px solid var(--c-border); padding: var(--sp-3); border-radius: var(--r-2); cursor: pointer; }
</style>
