import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import InputConfigSection from './InputConfigSection.svelte';
import { defaultSymptomInputs } from '$lib/db';

describe('InputConfigSection', () => {
  it('renders the four input cards', () => {
    const { getByText } = render(InputConfigSection, {
      props: { inputs: defaultSymptomInputs(), daily: false, onInputsChange: () => {}, onDailyChange: () => {} } as any
    });
    expect(getByText('Slider')).toBeTruthy();
    expect(getByText('Zahl')).toBeTruthy();
    expect(getByText('Auswahl')).toBeTruthy();
    expect(getByText('Kommentar')).toBeTruthy();
  });

  it('daily toggle is hidden when no input is enabled', () => {
    const { queryByLabelText } = render(InputConfigSection, {
      props: { inputs: defaultSymptomInputs(), daily: false, onInputsChange: () => {}, onDailyChange: () => {} } as any
    });
    expect(queryByLabelText('Täglich erfassen')).toBeNull();
  });

  it('daily toggle appears once any input is enabled', () => {
    const inputs = defaultSymptomInputs();
    inputs.comment.enabled = true;
    const { getByLabelText } = render(InputConfigSection, {
      props: { inputs, daily: false, onInputsChange: () => {}, onDailyChange: () => {} } as any
    });
    expect(getByLabelText('Täglich erfassen')).toBeTruthy();
  });

  it('Pflicht-Checkbox is disabled when Aktiv is off', () => {
    const { getAllByLabelText } = render(InputConfigSection, {
      props: { inputs: defaultSymptomInputs(), daily: false, onInputsChange: () => {}, onDailyChange: () => {} } as any
    });
    const pflicht = getAllByLabelText('Pflicht') as HTMLInputElement[];
    expect(pflicht.every((p) => p.disabled)).toBe(true);
  });

  it('toggling slider Aktiv calls onInputsChange with patched slider.enabled', async () => {
    const onInputsChange = vi.fn();
    const { getAllByLabelText } = render(InputConfigSection, {
      props: { inputs: defaultSymptomInputs(), daily: false, onInputsChange, onDailyChange: () => {} } as any
    });
    const aktivBoxes = getAllByLabelText('Aktiv') as HTMLInputElement[];
    await fireEvent.click(aktivBoxes[0]); // first card = Slider
    expect(onInputsChange).toHaveBeenCalled();
    const next = onInputsChange.mock.calls[0][0];
    expect(next.slider.enabled).toBe(true);
  });

  it('adding an option appends one with a fresh key and null value', async () => {
    const inputs = defaultSymptomInputs();
    inputs.select!.enabled = true;
    const onInputsChange = vi.fn();
    const { getByText } = render(InputConfigSection, {
      props: { inputs, daily: false, onInputsChange, onDailyChange: () => {} } as any
    });
    await fireEvent.click(getByText('Option hinzufügen'));
    const next = onInputsChange.mock.calls.at(-1)![0];
    expect(next.select.options).toHaveLength(1);
    expect(typeof next.select.options[0].key).toBe('string');
    expect(next.select.options[0].key.length).toBeGreaterThan(0);
    expect(next.select.options[0].value).toBeNull();
  });

  it('deleting an option soft-deletes it; restore clears the flag', async () => {
    const inputs = defaultSymptomInputs();
    inputs.select!.enabled = true;
    inputs.select!.options = [{ key: 'k1', label: 'A', value: null }];
    const onInputsChange = vi.fn();
    const { getByLabelText, rerender } = render(InputConfigSection, {
      props: { inputs, daily: false, onInputsChange, onDailyChange: () => {} } as any
    });
    await fireEvent.click(getByLabelText('Löschen'));
    let next = onInputsChange.mock.calls.at(-1)![0];
    expect(next.select.options[0].deleted).toBe(true);

    // Reflect the deletion back in and restore.
    await rerender({ inputs: next, daily: false, onInputsChange, onDailyChange: () => {} } as any);
    await fireEvent.click(getByLabelText('Wiederherstellen'));
    next = onInputsChange.mock.calls.at(-1)![0];
    expect(next.select.options[0].deleted).toBe(false);
  });
});
