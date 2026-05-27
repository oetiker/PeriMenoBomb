import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import IconPicker from './IconPicker.svelte';

describe('IconPicker', () => {
  it('highlights the active icon', () => {
    const { container } = render(IconPicker, { props: { value: 'flame', color: '#ef4444', onChange: () => {} } });
    const active = container.querySelector('.icon-tile.selected') as HTMLElement;
    expect(active.getAttribute('data-icon')).toBe('flame');
  });

  it('filters by search term', async () => {
    const { container, getByPlaceholderText } = render(IconPicker, { props: { value: 'flame', color: '#ef4444', onChange: () => {} } });
    const search = getByPlaceholderText('Suchen…') as HTMLInputElement;
    await fireEvent.input(search, { target: { value: 'moon' } });
    const tiles = container.querySelectorAll('.icon-tile');
    expect(Array.from(tiles).some((t) => t.getAttribute('data-icon') === 'moon')).toBe(true);
  });
});
