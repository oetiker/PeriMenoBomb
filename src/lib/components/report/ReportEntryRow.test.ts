import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ReportEntryRow from './ReportEntryRow.svelte';
import { newField } from '$lib/db/fields';
import type { Entry, Symptom } from '$lib/db';

const slider = newField('slider');
const text = newField('text');
const sym: Symptom = {
  id: 'a', name: 'Kopfweh', color: '#be123c', icon: '🔴', tagIds: [], parentId: null, sortIndex: 0,
  depth: 0, isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
  fields: [slider, text],
  daily: false
};
const entry: Entry = {
  id: '2026-05-18__a', date: '2026-05-18', symptomId: 'a',
  values: { [slider.id]: 80, [text.id]: 'morgens' }, updatedAt: 0
};

describe('ReportEntryRow', () => {
  it('shows the symptom name, slider value and comment', () => {
    render(ReportEntryRow, { entry, symptom: sym, tagNames: [] });
    expect(screen.getByText('Kopfweh')).toBeTruthy();
    expect(screen.getByText(/80/)).toBeTruthy();
    expect(screen.getByText(/morgens/)).toBeTruthy();
  });

  it('renders one entry per value field with the unit', () => {
    const n = newField('number');
    if (n.type === 'number') n.unit = 'Tassen';
    const s2: Symptom = { ...sym, fields: [n, text] };
    const e2: Entry = { ...entry, values: { [n.id]: 2, [text.id]: 'nachmittags' } };
    render(ReportEntryRow, { entry: e2, symptom: s2, tagNames: [] });
    expect(screen.getByText('2 Tassen')).toBeTruthy();
    expect(screen.getByText(/nachmittags/)).toBeTruthy();
  });

  it('shows "erfasst" when no field has a value', () => {
    const s3: Symptom = { ...sym, fields: [newField('number')] };
    const e3: Entry = { ...entry, values: {} };
    render(ReportEntryRow, { entry: e3, symptom: s3, tagNames: [] });
    expect(screen.getByText('erfasst')).toBeTruthy();
  });
});
