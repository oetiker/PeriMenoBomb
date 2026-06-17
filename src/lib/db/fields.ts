import { newId } from '$lib/utils/uuid';
import type { MetaField, FieldType, SelectField, Symptom, Entry } from './index';

/** Mint a new field of the given type with a German default label the author
    can immediately rename. The label is what keeps multi-value symptoms legible
    (e.g. "Systolisch" / "Diastolisch"). */
export function newField(type: FieldType): MetaField {
  const id = newId();
  switch (type) {
    case 'slider': return { id, type, label: 'Intensität', required: false, lowLabel: '', highLabel: '' };
    case 'number': return { id, type, label: 'Wert', required: false, unit: '', integer: true };
    case 'text':   return { id, type, label: 'Notiz', required: false };
    case 'select': return { id, type, label: 'Auswahl', required: false, options: [] };
  }
}

/** Field types that can drive heatmap intensity / be picked as a value series. */
export function isValueField(f: MetaField): boolean {
  return f.type === 'slider' || f.type === 'number' || f.type === 'select';
}

/** Human label for a stored select-option key. A soft-deleted option still
    resolves (suffixed "(gelöscht)"); an unknown key shows a neutral placeholder;
    null/undefined → ''. */
export function selectOptionLabel(field: SelectField, key: string | null | undefined): string {
  if (key === null || key === undefined) return '';
  const opt = field.options.find((o) => o.key === key);
  if (!opt) return '(unbekannte Auswahl)';
  const label = opt.label || '(ohne Name)';
  return opt.deleted ? `${label} (gelöscht)` : label;
}

export interface FieldDisplay { field: MetaField; text: string }

/** Ordered, human-readable values for an entry's non-deleted fields. A slider
    logged as null reads 'unspez'; fields with no stored value are omitted. */
export function entryFieldDisplays(symptom: Symptom, entry: Pick<Entry, 'values'>): FieldDisplay[] {
  const out: FieldDisplay[] = [];
  const values = entry.values ?? {};
  for (const f of symptom.fields) {
    if (f.deleted) continue;
    const v = values[f.id];
    if (f.type === 'slider') {
      if (v === undefined) continue;
      out.push({ field: f, text: v === null ? 'unspez' : String(v) });
    } else if (f.type === 'number') {
      if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) continue;
      out.push({ field: f, text: f.unit ? `${v} ${f.unit}` : String(v) });
    } else if (f.type === 'select') {
      const label = selectOptionLabel(f, typeof v === 'string' ? v : null);
      if (!label) continue;
      out.push({ field: f, text: label });
    } else {
      if (typeof v !== 'string' || v.trim().length === 0) continue;
      out.push({ field: f, text: v });
    }
  }
  return out;
}
