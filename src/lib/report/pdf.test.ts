// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { entriesToPdfBody, buildEntriesPdfBlob } from './pdf';
import type { Entry, Symptom, Tag } from '$lib/db';
import type { DayGroup } from './filter';

const sym = (id: string, name: string, over: Partial<Symptom> = {}): Symptom => ({
  id, name, color: '#be123c', icon: '🔴', tagIds: [], parentId: null, sortIndex: 0,
  depth: 0, isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
  inputs: { slider: { enabled: true, required: false, lowLabel: 'leicht', highLabel: 'stark' },
            number: { enabled: true, required: false, unit: 'Schübe', integer: true },
            comment: { enabled: true, required: false } },
  daily: false, ...over
});
const ent = (date: string, symptomId: string, over: Partial<Entry> = {}): Entry => ({
  id: `${date}__${symptomId}`, date, symptomId, sliderValue: null, numberValue: null, comment: '', updatedAt: 0, ...over
});

const symptoms = new Map([['a', sym('a', 'Kopfweh')]]);
const tags = new Map<string, Tag>();
const groups: DayGroup[] = [
  { date: '2026-05-18', entries: [ent('2026-05-18', 'a', { sliderValue: 80, numberValue: 2, comment: 'morgens' })] }
];

describe('entriesToPdfBody', () => {
  it('produces one row per entry with formatted columns', () => {
    const rows = entriesToPdfBody(groups, symptoms, tags);
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r.date).toBe('2026-05-18');
    expect(r.cells[0]).toBe('Kopfweh');            // Symptom
    expect(r.cells[1]).toBe('80');                  // Intensität (slider 1..100)
    expect(r.cells[2]).toBe('2 Schübe');            // Anzahl
    expect(r.cells[3]).toBe('morgens');             // Kommentar
  });

  it('renders unspez slider as "unspez" and empty values as empty strings', () => {
    const rows = entriesToPdfBody(
      [{ date: '2026-05-18', entries: [ent('2026-05-18', 'a', { sliderValue: null })] }],
      symptoms, tags
    );
    expect(rows[0].cells[1]).toBe('unspez');
    expect(rows[0].cells[2]).toBe('');
    expect(rows[0].cells[3]).toBe('');
  });
});

describe('buildEntriesPdfBlob', () => {
  it('returns a non-empty PDF Blob', async () => {
    const blob = await buildEntriesPdfBlob(groups, symptoms, tags, { title: 'Verlauf', rangeLabel: 'gesamt', filterLabel: 'kein Filter', generatedLabel: '29. Mai 2026' });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });
});
