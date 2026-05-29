import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ReportEntryRow from './ReportEntryRow.svelte';
import type { Entry, Symptom } from '$lib/db';

const sym: Symptom = {
  id: 'a', name: 'Kopfweh', color: '#be123c', icon: '🔴', tagIds: [], parentId: null, sortIndex: 0,
  depth: 0, isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
  inputs: { slider: { enabled: true, required: false, lowLabel: 'leicht', highLabel: 'stark' },
            number: { enabled: false, required: false, unit: '', integer: true },
            comment: { enabled: true, required: false } },
  daily: false
};
const entry: Entry = { id: '2026-05-18__a', date: '2026-05-18', symptomId: 'a', sliderValue: 80, numberValue: null, comment: 'morgens', updatedAt: 0 };

describe('ReportEntryRow', () => {
  it('shows the symptom name, slider value and comment', () => {
    render(ReportEntryRow, { entry, symptom: sym, tagNames: [] });
    expect(screen.getByText('Kopfweh')).toBeTruthy();
    expect(screen.getByText(/80/)).toBeTruthy();
    expect(screen.getByText(/morgens/)).toBeTruthy();
  });
});
