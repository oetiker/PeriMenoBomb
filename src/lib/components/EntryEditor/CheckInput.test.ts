import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CheckInput from './CheckInput.svelte';

describe('CheckInput', () => {
  it('renders the label next to the box', () => {
    const { getByLabelText } = render(CheckInput, {
      props: { value: false, label: 'Nachts aufgewacht', onChange: () => {} }
    });
    expect(getByLabelText('Nachts aufgewacht')).toBeTruthy();
  });

  it('reflects the current value', () => {
    const { getByLabelText } = render(CheckInput, {
      props: { value: true, label: 'A', onChange: () => {} }
    });
    expect((getByLabelText('A') as HTMLInputElement).checked).toBe(true);
  });

  it('emits true when ticked', async () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(CheckInput, {
      props: { value: false, label: 'A', onChange }
    });
    await fireEvent.click(getByLabelText('A'));
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('emits false when unticked', async () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(CheckInput, {
      props: { value: true, label: 'A', onChange }
    });
    await fireEvent.click(getByLabelText('A'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
