import type { Entry, Symptom } from '$lib/db';
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

/** Min/max of a number-input symptom's values across the given entries. Used as
    a STABLE normalization domain over the whole selected range (never the
    viewport). Returns null for non-number symptoms or when there is no data. */
export function valueNumberDomain(entries: Entry[], valueSymptom: Symptom): NumberDomain | null {
  if (!valueSymptom.inputs.number.enabled) return null;
  const nums = entries
    .map((e) => e.numberValue)
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Numeric weight of the option an entry selected, or null when the symptom is
    not a select, nothing was chosen, or the chosen option has no value. Deleted
    options still resolve — their value is kept — so historical intensity is
    preserved even after the option is removed from the live dropdown. */
export function selectEntryValue(valueSymptom: Symptom, entry: Entry): number | null {
  const opts = valueSymptom.inputs.select?.options;
  if (!opts || entry.selectKey === null || entry.selectKey === undefined) return null;
  const opt = opts.find((o) => o.key === entry.selectKey);
  if (!opt || opt.value === null || opt.value === undefined || Number.isNaN(opt.value)) return null;
  return opt.value;
}

/** Stable normalization domain over a select symptom's option values. */
export function selectValueDomain(entries: Entry[], valueSymptom: Symptom): NumberDomain | null {
  if (!valueSymptom.inputs.select?.enabled) return null;
  const nums = entries
    .map((e) => selectEntryValue(valueSymptom, e))
    .filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Pick the right normalization domain for whichever value-bearing input the
    focus symptom uses (number or select). */
export function valueDomain(entries: Entry[], valueSymptom: Symptom): NumberDomain | null {
  if (valueSymptom.inputs.number.enabled) return valueNumberDomain(entries, valueSymptom);
  if (valueSymptom.inputs.select?.enabled) return selectValueDomain(entries, valueSymptom);
  return null;
}

export function classifyCell(valueSymptom: Symptom, entry: Entry | undefined, domain: NumberDomain | null): Cell {
  if (!entry) return NONE;
  const i = valueSymptom.inputs;
  if (i.slider.enabled) {
    if (entry.sliderValue === null) return { kind: 'unspez', intensity: 0 };
    const t = (Math.max(1, Math.min(100, entry.sliderValue)) - 1) / 99;
    return { kind: 'value', intensity: t };
  }
  if (i.number.enabled && entry.numberValue !== null && !Number.isNaN(entry.numberValue)) {
    if (!domain || domain.max === domain.min) return { kind: 'value', intensity: 1 };
    const t = (entry.numberValue - domain.min) / (domain.max - domain.min);
    return { kind: 'value', intensity: Math.max(0, Math.min(1, t)) };
  }
  if (i.select?.enabled) {
    if (entry.selectKey === null || entry.selectKey === undefined) return { kind: 'unspez', intensity: 0 };
    const v = selectEntryValue(valueSymptom, entry);
    if (v === null) return { kind: 'recorded', intensity: 1 };
    if (!domain || domain.max === domain.min) return { kind: 'value', intensity: 1 };
    const t = (v - domain.min) / (domain.max - domain.min);
    return { kind: 'value', intensity: Math.max(0, Math.min(1, t)) };
  }
  return { kind: 'recorded', intensity: 1 };
}

/** Build the column×offset matrix. `entriesByDate` must contain ONLY the value
    symptom's entries, keyed by date. Each column is anchored at its own
    occurrence; offset o maps to addDays(anchorDate, o). */
export function buildHeatmap(
  anchorDates: string[],
  entriesByDate: Map<string, Entry>,
  valueSymptom: Symptom,
  domain: NumberDomain | null,
  offsetMin: number,
  offsetMax: number
): HeatmapModel {
  const offsets: number[] = [];
  for (let o = offsetMin; o <= offsetMax; o++) offsets.push(o);
  const columns = anchorDates.map((anchorDate) => ({
    anchorDate,
    cells: offsets.map((o) => classifyCell(valueSymptom, entriesByDate.get(addDays(anchorDate, o)), domain))
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
