import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ColorPicker from './ColorPicker.svelte';

describe('ColorPicker', () => {
  it('marks the current value as selected', () => {
    const { container } = render(ColorPicker, { props: { value: '#ef4444', onChange: () => {} } });
    const selected = container.querySelector('.swatch.selected') as HTMLElement;
    expect(selected.getAttribute('data-color')).toBe('#ef4444');
  });

  it('calls onChange when a swatch is clicked', async () => {
    let v = '';
    const { container } = render(ColorPicker, { props: { value: '#ef4444', onChange: (c: string) => { v = c; } } });
    const blue = container.querySelector('[data-color="#3b82f6"]') as HTMLElement;
    await fireEvent.click(blue);
    expect(v).toBe('#3b82f6');
  });
});
