import type { Entry, MetaField, NumberField, SelectField } from '$lib/db';
import { addDays } from '$lib/utils/date';
import { hexToRgba } from '$lib/utils/color';

export const OFFSET_MIN = -31;
export const OFFSET_MAX = 31;
export const MAX_ANCHOR_COLUMNS = 60;

export type CellKind = 'none' | 'unspez' | 'value' | 'recorded';
export interface Cell { kind: CellKind; intensity: number } // intensity 0..1, meaningful for 'value'
export interface NumberDomain { min: number; max: number }

export interface HeatmapColumn { anchorDate: string; cells: Cell[] }
export interface HeatmapModel {
  columns: HeatmapColumn[];
  offsets: number[];
  zeroIndex: number;
}

const NONE: Cell = { kind: 'none', intensity: 0 };

/** Min/max of a number field's values across the given entries. Used as a
    stable normalization domain over the whole selected range (never the
    viewport). Returns null when there is no numeric data. */
export function valueNumberDomain(entries: Entry[], field: NumberField): NumberDomain | null {
  const nums = entries
    .map((e) => e.values?.[field.id])
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Numeric weight of the option an entry selected, or null when nothing was
    chosen or the chosen option has no value. Deleted options still resolve —
    their value is kept — so historical intensity is preserved even after the
    option is removed from the live dropdown. */
export function selectEntryValue(field: SelectField, entry: Entry): number | null {
  const key = entry.values?.[field.id];
  if (typeof key !== 'string') return null;
  const opt = field.options.find((o) => o.key === key);
  if (!opt || opt.value === null || opt.value === undefined || Number.isNaN(opt.value)) return null;
  return opt.value;
}

/** Stable normalization domain over a select field's option values. */
export function selectValueDomain(entries: Entry[], field: SelectField): NumberDomain | null {
  const nums = entries
    .map((e) => selectEntryValue(field, e))
    .filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Normalization domain for the selected value field (number or select). */
export function valueDomain(entries: Entry[], field: MetaField): NumberDomain | null {
  if (field.type === 'number') return valueNumberDomain(entries, field);
  if (field.type === 'select') return selectValueDomain(entries, field);
  return null;
}

export function classifyCell(field: MetaField, entry: Entry | undefined, domain: NumberDomain | null): Cell {
  if (!entry) return NONE;
  const v = entry.values?.[field.id];
  if (field.type === 'slider') {
    if (v === null || v === undefined) return { kind: 'unspez', intensity: 0 };
    const t = (Math.max(1, Math.min(100, v as number)) - 1) / 99;
    return { kind: 'value', intensity: t };
  }
  if (field.type === 'number') {
    if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) return NONE;
    if (!domain || domain.max === domain.min) return { kind: 'value', intensity: 1 };
    const t = ((v as number) - domain.min) / (domain.max - domain.min);
    return { kind: 'value', intensity: Math.max(0, Math.min(1, t)) };
  }
  if (field.type === 'select') {
    if (v === null || v === undefined) return { kind: 'unspez', intensity: 0 };
    const sv = selectEntryValue(field, entry);
    if (sv === null) return { kind: 'recorded', intensity: 1 };
    if (!domain || domain.max === domain.min) return { kind: 'value', intensity: 1 };
    const t = (sv - domain.min) / (domain.max - domain.min);
    return { kind: 'value', intensity: Math.max(0, Math.min(1, t)) };
  }
  return { kind: 'recorded', intensity: 1 }; // text — presence only
}

/** Build the column×offset matrix. `entriesByDate` must contain ONLY the value
    field's entries, keyed by date. Each column is anchored at its own
    occurrence; offset o maps to addDays(anchorDate, o). */
export function buildHeatmap(
  anchorDates: string[],
  entriesByDate: Map<string, Entry>,
  field: MetaField,
  domain: NumberDomain | null,
  offsetMin: number,
  offsetMax: number
): HeatmapModel {
  const offsets: number[] = [];
  for (let o = offsetMin; o <= offsetMax; o++) offsets.push(o);
  const columns = anchorDates.map((anchorDate) => ({
    anchorDate,
    cells: offsets.map((o) => classifyCell(field, entriesByDate.get(addDays(anchorDate, o)), domain))
  }));
  return { columns, offsets, zeroIndex: offsets.indexOf(0) };
}

export function cellColor(cell: Cell, symptomColor: string): string {
  switch (cell.kind) {
    case 'none': return 'var(--c-surface-3)';
    case 'unspez': return hexToRgba(symptomColor, 0.18);
    case 'recorded': return hexToRgba(symptomColor, 0.9);
    case 'value': return hexToRgba(symptomColor, 0.15 + 0.85 * cell.intensity);
  }
}
