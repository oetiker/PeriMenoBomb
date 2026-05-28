import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import NumberInput from './NumberInput.svelte';

describe('NumberInput', () => {
  it('renders the unit label', () => {
    const { getByText } = render(NumberInput, {
      props: { value: 3, unit: 'Tassen', integer: true, onChange: () => {} }
    });
    expect(getByText('Tassen')).toBeTruthy();
  });

  it('falls back to placeholder when unit is empty', () => {
    const { getByText } = render(NumberInput, {
      props: { value: null, unit: '', integer: true, onChange: () => {} }
    });
    expect(getByText('Einheit')).toBeTruthy();
  });

  it('emits the parsed integer on input', async () => {
    const onChange = vi.fn();
    const { container } = render(NumberInput, {
      props: { value: null, unit: 'x', integer: true, onChange }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '7' } });
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it('emits null when input is cleared', async () => {
    const onChange = vi.fn();
    const { container } = render(NumberInput, {
      props: { value: 3, unit: 'x', integer: true, onChange }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('emits null for invalid input', async () => {
    const onChange = vi.fn();
    const { container } = render(NumberInput, {
      props: { value: null, unit: 'x', integer: true, onChange }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('uses inputmode decimal when integer=false', () => {
    const { container } = render(NumberInput, {
      props: { value: null, unit: 'x', integer: false, onChange: () => {} }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });
});
