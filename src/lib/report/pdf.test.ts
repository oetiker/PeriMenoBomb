// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { entriesToPdfBody, buildEntriesPdfBlob } from './pdf';
import { newField } from '$lib/db/fields';
import type { Entry, Symptom, Tag } from '$lib/db';
import type { DayGroup } from './filter';

const slider = newField('slider');                                   // label 'Intensität'
const num = newField('number');
if (num.type === 'number') { num.unit = 'Schübe'; num.label = 'Anzahl'; }
const text = newField('text');                                       // label 'Notiz'

const sym = (id: string, name: string, over: Partial<Symptom> = {}): Symptom => ({
  id, name, color: '#be123c', icon: '🔴', tagIds: [], parentId: null, sortIndex: 0,
  depth: 0, isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
  fields: [slider, num, text],
  daily: false, ...over
});
const ent = (date: string, symptomId: string, values: Record<string, number | string | null> = {}): Entry => ({
  id: `${date}__${symptomId}`, date, symptomId, values, updatedAt: 0
});

const symptoms = new Map([['a', sym('a', 'Kopfweh')]]);
const tags = new Map<string, Tag>();
const groups: DayGroup[] = [
  { date: '2026-05-18', entries: [ent('2026-05-18', 'a', { [slider.id]: 80, [num.id]: 2, [text.id]: 'morgens' })] }
];

describe('entriesToPdfBody', () => {
  it('produces one row per entry; the values column joins all field values', () => {
    const rows = entriesToPdfBody(groups, symptoms, tags);
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r.date).toBe('2026-05-18');
    expect(r.cells[0]).toBe('Kopfweh');                       // Symptom
    expect(r.cells[1]).toContain('Intensität: 80');           // slider
    expect(r.cells[1]).toContain('Anzahl: 2 Schübe');         // number with unit
    expect(r.cells[1]).toContain('Notiz: morgens');           // text
    expect(r.cells[2]).toBe('');                              // Tags
  });

  it('renders a logged-but-unspecified slider as "unspez" and omits unlogged fields', () => {
    const rows = entriesToPdfBody(
      [{ date: '2026-05-18', entries: [ent('2026-05-18', 'a', { [slider.id]: null })] }],
      symptoms, tags
    );
    expect(rows[0].cells[1]).toBe('Intensität: unspez');
  });
});

describe('buildEntriesPdfBlob', () => {
  it('returns a non-empty PDF Blob', async () => {
    const blob = await buildEntriesPdfBlob(groups, symptoms, tags, { title: 'Verlauf', rangeLabel: 'gesamt', filterLabel: 'kein Filter', generatedLabel: '29. Mai 2026' });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });
});
