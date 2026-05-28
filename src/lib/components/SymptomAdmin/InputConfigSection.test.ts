import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import InputConfigSection from './InputConfigSection.svelte';
import { defaultSymptomInputs } from '$lib/db';

describe('InputConfigSection', () => {
  it('renders the three input cards', () => {
    const { getByText } = render(InputConfigSection, {
      props: { inputs: defaultSymptomInputs(), daily: false, onInputsChange: () => {}, onDailyChange: () => {} } as any
    });
    expect(getByText('Slider')).toBeTruthy();
    expect(getByText('Zahl')).toBeTruthy();
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
});
