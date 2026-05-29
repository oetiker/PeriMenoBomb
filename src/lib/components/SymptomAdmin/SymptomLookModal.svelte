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
      custom = '';
    });
  });

  let custom = $state('');

  function onCustomInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const v = el.value;
    if (!v) return;
    const parts = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v));
    const last = parts[parts.length - 1]?.segment ?? '';
    if (looksLikeEmoji(last)) {
      localIcon = last;
      custom = '';
      el.value = '';
    } else {
      custom = v;
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

  <input
    class="custom"
    type="text"
    bind:value={custom}
    oninput={onCustomInput}
    placeholder="Eigenes Emoji eintippen / einfügen…"
    autocapitalize="off"
    autocomplete="off"
    inputmode="text"
  />

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
    {#each SUGGESTED_EMOJIS as e}
      <button
        type="button"
        class="tile"
        class:selected={localIcon === e.glyph}
        onclick={() => (localIcon = e.glyph)}
        aria-label={e.name}
        title={e.name}
      >
        <Badge icon={e.glyph} color={localColor} duotone={localDuotone} bg={localBg} size={28} />
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
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    row-gap: var(--sp-3);
    column-gap: 2px;
  }
  .tile {
    aspect-ratio: 1;
    display: flex; align-items: center; justify-content: center;
    border: 0; background: none;
    border-radius: var(--r-2);
    cursor: pointer;
    padding: 0;
  }
  .tile.selected { background: color-mix(in srgb, var(--c-text) 12%, transparent); }
  .custom {
    padding: var(--sp-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    font-size: var(--fs-md);
    margin-bottom: var(--sp-4);
    width: 100%;
    box-sizing: border-box;
  }
  .field { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .label { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .toggle-row { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-3); cursor: pointer; }
  .toggle-row input { width: 18px; height: 18px; flex-shrink: 0; }
  .hint { color: var(--c-text-dim); font-size: var(--fs-xs); margin-left: auto; text-align: right; }
  .primary { background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .secondary { background: var(--c-surface-2); color: var(--c-text); border: 1px solid var(--c-border); padding: var(--sp-3); border-radius: var(--r-2); cursor: pointer; }
</style>
