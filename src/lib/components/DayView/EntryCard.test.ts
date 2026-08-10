import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import EntryCard from './EntryCard.svelte';
import { newField } from '$lib/db/fields';
import type { Entry, Symptom } from '$lib/db';

function makeSym(fields: Symptom['fields']): Symptom {
  return {
    id: 's1', name: 'Kopfweh', color: '#be123c', icon: '🔴', tagIds: [], parentId: null,
    sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
    fields, daily: false
  };
}

describe('EntryCard', () => {
  it('shows the field label, not "ja", for a ticked check field', () => {
    const check = { ...newField('check'), label: 'Nachts aufgewacht' };
    const sym = makeSym([check]);
    const entry: Entry = { id: '2026-08-10__s1', date: '2026-08-10', symptomId: 's1', values: { [check.id]: true }, updatedAt: 0 };
    render(EntryCard, { entry, symptom: sym, onTap: () => {}, onSwipe: () => {} });
    expect(screen.getByText('Nachts aufgewacht')).toBeTruthy();
    expect(screen.queryByText('ja')).toBeNull();
  });

  it('leaves a slider chip unchanged', () => {
    const slider = newField('slider');
    const sym = makeSym([slider]);
    const entry: Entry = { id: '2026-08-10__s1', date: '2026-08-10', symptomId: 's1', values: { [slider.id]: 4 }, updatedAt: 0 };
    render(EntryCard, { entry, symptom: sym, onTap: () => {}, onSwipe: () => {} });
    expect(screen.getByText('4')).toBeTruthy();
  });
});
