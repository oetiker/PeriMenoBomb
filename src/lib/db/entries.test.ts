import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import type { Symptom } from './index';
import { defaultSymptomInputs } from './index';
import { upsertEntry, getEntry, deleteEntry, listEntriesForDate, listEntriesForRange, hasEntry, listOccurrenceDates } from './entries';
import { validateEntry, selectLabelFor } from './entries';

describe('entries', () => {
  beforeEach(() => resetDatabase());

  it('upsert creates a new entry with deterministic id', async () => {
    const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    expect(e.id).toBe('2026-05-27__sym1');
    expect(e.sliderValue).toBeNull();
    expect(e.numberValue).toBeNull();
    expect(e.comment).toBe('');
  });

  it('upsert preserves existing values when patch is partial', async () => {
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', sliderValue: 50 });
    const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', comment: 'Notiz' });
    expect(e.sliderValue).toBe(50);
    expect(e.comment).toBe('Notiz');
  });

  it('hasEntry reports presence', async () => {
    expect(await hasEntry('2026-05-27', 'sym1')).toBe(false);
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    expect(await hasEntry('2026-05-27', 'sym1')).toBe(true);
  });

  it('delete removes the entry', async () => {
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    await deleteEntry('2026-05-27', 'sym1');
    expect(await getEntry('2026-05-27', 'sym1')).toBeUndefined();
  });

  it('listEntriesForDate returns all entries of a day', async () => {
    await upsertEntry({ date: '2026-05-27', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-27', symptomId: 'b' });
    await upsertEntry({ date: '2026-05-26', symptomId: 'c' });
    const today = await listEntriesForDate('2026-05-27');
    expect(today.map((e) => e.symptomId).sort()).toEqual(['a', 'b']);
  });

  it('listEntriesForRange returns entries between dates inclusive', async () => {
    await upsertEntry({ date: '2026-05-25', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-26', symptomId: 'b' });
    await upsertEntry({ date: '2026-05-28', symptomId: 'c' });
    const r = await listEntriesForRange('2026-05-26', '2026-05-27');
    expect(r.map((e) => e.symptomId)).toEqual(['b']);
  });

  it('rejects invalid date format', async () => {
    await expect(upsertEntry({ date: '27.05.2026', symptomId: 'x' })).rejects.toThrow();
  });

  it('listOccurrenceDates returns ascending dates for a symptom', async () => {
    await upsertEntry({ date: '2026-05-20', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-10', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-15', symptomId: 'b' });
    expect(await listOccurrenceDates('a')).toEqual(['2026-05-10', '2026-05-20']);
    expect(await listOccurrenceDates('b')).toEqual(['2026-05-15']);
  });

  it('listOccurrenceDates returns empty array when the symptom has no entries', async () => {
    expect(await listOccurrenceDates('nope')).toEqual([]);
  });

  it('listOccurrenceDates counts an input-less event entry as an occurrence', async () => {
    await upsertEntry({ date: '2026-05-18', symptomId: 'mens' }); // no slider/number/comment
    expect(await listOccurrenceDates('mens')).toEqual(['2026-05-18']);
  });
});

function symptom(partial: Partial<Symptom> = {}): Symptom {
  return {
    id: 's', name: 'X', color: '#000', icon: 'circle',
    tagIds: [], parentId: null, sortIndex: 0, depth: 0,
    isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
    inputs: defaultSymptomInputs(), daily: false, ...partial
  };
}

describe('validateEntry', () => {
  it('ok when no input is required', () => {
    const s = symptom();
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: true, missing: [] });
  });

  it('reports slider missing when slider is required and value is null', () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled = true;
    inputs.slider.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: false, missing: ['slider'] });
  });

  it('slider ok with any 1..100 value', () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled = true;
    inputs.slider.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: 1, numberValue: null, comment: '' }).ok).toBe(true);
    expect(validateEntry(s, { sliderValue: 100, numberValue: null, comment: '' }).ok).toBe(true);
  });

  it('reports number missing when required and null', () => {
    const inputs = defaultSymptomInputs();
    inputs.number.enabled = true;
    inputs.number.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: false, missing: ['number'] });
  });

  it('reports comment missing when required and empty/whitespace', () => {
    const inputs = defaultSymptomInputs();
    inputs.comment.enabled = true;
    inputs.comment.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: false, missing: ['comment'] });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '   ' }))
      .toEqual({ ok: false, missing: ['comment'] });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: 'note' }).ok).toBe(true);
  });

  it('aggregates multiple missing pieces in order slider, number, comment', () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled  = true; inputs.slider.required  = true;
    inputs.number.enabled  = true; inputs.number.required  = true;
    inputs.comment.enabled = true; inputs.comment.required = true;
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }))
      .toEqual({ ok: false, missing: ['slider', 'number', 'comment'] });
  });

  it('disabled input never triggers missing even if required somehow true', () => {
    const inputs = defaultSymptomInputs();
    inputs.slider.enabled = false; inputs.slider.required = true; // contradictory state
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '' }).ok).toBe(true);
  });

  it('reports select missing when required and no key chosen', () => {
    const inputs = defaultSymptomInputs();
    inputs.select!.enabled = true;
    inputs.select!.required = true;
    inputs.select!.options = [{ key: 'k1', label: 'A', value: null }];
    const s = symptom({ inputs });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '', selectKey: null }))
      .toEqual({ ok: false, missing: ['select'] });
    expect(validateEntry(s, { sliderValue: null, numberValue: null, comment: '', selectKey: 'k1' }).ok).toBe(true);
  });
});

describe('select entries', () => {
  beforeEach(() => resetDatabase());

  it('upsert stores and preserves selectKey', async () => {
    const e = await upsertEntry({ date: '2026-05-27', symptomId: 's', selectKey: 'k2' });
    expect(e.selectKey).toBe('k2');
    // partial patch (comment only) keeps the prior key
    const e2 = await upsertEntry({ date: '2026-05-27', symptomId: 's', comment: 'x' });
    expect(e2.selectKey).toBe('k2');
  });

  it('selectLabelFor resolves labels, marks deleted, and handles unknown keys', () => {
    const inputs = defaultSymptomInputs();
    inputs.select!.enabled = true;
    inputs.select!.options = [
      { key: 'k1', label: 'leicht', value: 1 },
      { key: 'kd', label: 'alt', value: 2, deleted: true }
    ];
    const s = symptom({ inputs });
    expect(selectLabelFor(s, { selectKey: 'k1' })).toBe('leicht');
    expect(selectLabelFor(s, { selectKey: 'kd' })).toBe('alt (gelöscht)');
    expect(selectLabelFor(s, { selectKey: 'gone' })).toBe('(unbekannte Auswahl)');
    expect(selectLabelFor(s, { selectKey: null })).toBe('');
  });

  it('selectLabelFor returns empty when select is disabled', () => {
    expect(selectLabelFor(symptom(), { selectKey: 'k1' })).toBe('');
  });
});
