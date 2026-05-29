import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SymptomLookModal from './SymptomLookModal.svelte';
import { SUGGESTED_EMOJIS } from '$lib/icons/emoji';

const baseProps = {
  open: true,
  icon: '⚪',
  color: '#ef4444',
  duotone: true,
  bg: true,
  name: 'Test'
};

describe('SymptomLookModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(SymptomLookModal, {
      props: { ...baseProps, open: false, onSave: () => {}, onClose: () => {} }
    });
    expect(container.querySelector('.tile')).toBeNull();
  });

  it('does NOT call onSave when a tile is tapped — local state only', async () => {
    const onSave = vi.fn();
    const { container } = render(SymptomLookModal, {
      props: { ...baseProps, onSave, onClose: () => {} }
    });
    const firstTile = container.querySelector('.tile') as HTMLElement;
    await fireEvent.click(firstTile);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('commits the staged icon when Speichern is tapped', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { container, getByText } = render(SymptomLookModal, {
      props: { ...baseProps, onSave, onClose }
    });
    const tiles = container.querySelectorAll('.tile');
    // Pick the 4th suggestion so we know the local pick differs from the prop.
    await fireEvent.click(tiles[3]);
    await fireEvent.click(getByText('Speichern'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({
      icon: SUGGESTED_EMOJIS[3].glyph,
      color: '#ef4444',
      duotone: true,
      bg: true
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom emoji typed/pasted in the free-form input', async () => {
    const onSave = vi.fn();
    const { getByPlaceholderText, getByText } = render(SymptomLookModal, {
      props: { ...baseProps, onSave, onClose: () => {} }
    });
    const input = getByPlaceholderText(/Eigenes Emoji/) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '🌶️' } });
    await fireEvent.click(getByText('Speichern'));
    expect(onSave.mock.calls[0][0].icon).toBe('🌶️');
  });

  it('reflects toggle changes in the Save payload', async () => {
    const onSave = vi.fn();
    const { container, getByText } = render(SymptomLookModal, {
      props: { ...baseProps, onSave, onClose: () => {} }
    });
    const checks = container.querySelectorAll('.toggle-row input[type=checkbox]');
    await fireEvent.click(checks[0]); // duotone off
    await fireEvent.click(checks[1]); // bg off
    await fireEvent.click(getByText('Speichern'));
    expect(onSave.mock.calls[0][0]).toMatchObject({ duotone: false, bg: false });
  });

  it('marks the active emoji tile as selected', () => {
    const target = SUGGESTED_EMOJIS[3].glyph;
    const { container } = render(SymptomLookModal, {
      props: { ...baseProps, icon: target, onSave: () => {}, onClose: () => {} }
    });
    const selected = container.querySelector('.tile.selected') as HTMLElement;
    expect(selected.getAttribute('aria-label')).toBe(SUGGESTED_EMOJIS[3].name);
  });
});
