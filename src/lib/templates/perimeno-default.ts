import type { MetaField } from '$lib/db';
import { newField } from '$lib/db/fields';

export interface TemplateTag { name: string; }
export interface TemplateSymptom {
  name: string;
  icon: string;
  color: string;
  tags?: string[];
  children?: TemplateSymptom[];
  fields?: MetaField[];
  daily?: boolean;
}
export interface Template {
  tags: TemplateTag[];
  roots: TemplateSymptom[];
}

// A symptom with a slider (labeled "Intensität") plus a free-text note.
const slider = (low: string, high: string, required = true): MetaField[] => {
  const s = newField('slider');
  if (s.type === 'slider') { s.lowLabel = low; s.highLabel = high; s.required = required; }
  return [s, newField('text')];
};
// A symptom with a number (unit becomes the label) plus a free-text note.
const number = (unit: string, integer = true): MetaField[] => {
  const n = newField('number');
  if (n.type === 'number') { n.unit = unit; n.integer = integer; n.required = true; n.label = unit; }
  return [n, newField('text')];
};
// An event symptom: just a free-text note.
const event = (): MetaField[] => [newField('text')];

export const DEFAULT_TEMPLATE: Template = {
  tags: [
    { name: 'körperlich' },
    { name: 'emotional' },
    { name: 'schlafrelevant' },
    { name: 'hormonell' }
  ],
  roots: [
    {
      name: 'Zyklus', icon: '🩸', color: '#be123c',
      children: [
        { name: 'Start Mens', icon: '🔴', color: '#be123c', tags: ['hormonell'], fields: event() },
        { name: 'Ende Mens',  icon: '🏁', color: '#be123c', tags: ['hormonell'], fields: event() }
      ]
    },
    {
      name: 'Körperlich', icon: '🏃', color: '#10b981',
      children: [
        { name: 'Hitzewallungen',  icon: '🔥', color: '#f59e0b', tags: ['körperlich', 'hormonell'],                    fields: (() => { const f = slider('kurz', 'lang'); const n = number('Schübe'); return [f[0], n[0], f[1]]; })() },
        { name: 'Nachtschweiss',   icon: '💦', color: '#06b6d4', tags: ['körperlich', 'schlafrelevant', 'hormonell'],  fields: slider('leicht', 'stark') },
        { name: 'Herzrasen',       icon: '💓', color: '#ef4444', tags: ['körperlich'],                                 fields: slider('leicht', 'stark') },
        { name: 'Gelenkschmerzen', icon: '🦴', color: '#84cc16', tags: ['körperlich'],                                 fields: slider('leicht', 'stark') },
        { name: 'Kopfschmerzen',   icon: '🧠', color: '#6366f1', tags: ['körperlich'],                                 fields: slider('leicht', 'stark') },
        { name: 'Schwindel',       icon: '✨', color: '#8b5cf6', tags: ['körperlich'],                                 fields: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Stimmung & Gefühle', icon: '❤️', color: '#ec4899',
      children: [
        { name: 'Reizbarkeit',                   icon: '😡', color: '#f97316', tags: ['emotional'], fields: slider('kaum', 'sehr', false),     daily: true },
        { name: 'Stimmungstief',                 icon: '🙁', color: '#3b82f6', tags: ['emotional'], fields: slider('leicht', 'stark', false), daily: true },
        { name: 'Angst',                         icon: '⚠️', color: '#dc2626', tags: ['emotional'], fields: slider('leicht', 'stark') },
        { name: 'Konzentrationsschwierigkeiten', icon: '🌫️', color: '#6b7280', tags: ['emotional'], fields: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Schlaf', icon: '🌙', color: '#6366f1',
      children: [
        { name: 'Einschlafstörungen',   icon: '🛏️', color: '#6366f1', tags: ['schlafrelevant'], fields: slider('leicht', 'stark') },
        { name: 'Durchschlafstörungen', icon: '🌙', color: '#8b5cf6', tags: ['schlafrelevant'], fields: number('Aufwachvorgänge') },
        { name: 'Schlafqualität',       icon: '😴', color: '#6366f1', tags: ['schlafrelevant'], fields: slider('schlecht', 'gut', false), daily: true }
      ]
    },
    {
      name: 'Energie & Antrieb', icon: '⚡', color: '#eab308',
      children: [
        { name: 'Müdigkeit',   icon: '🥱', color: '#f59e0b', tags: ['körperlich', 'emotional'], fields: slider('leicht', 'stark', false), daily: true },
        { name: 'Erschöpfung', icon: '☁️', color: '#6b7280', tags: ['körperlich', 'emotional'], fields: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Konsum', icon: '🥤', color: '#0ea5e9',
      children: [
        { name: 'Kaffee', icon: '☕', color: '#a16207', fields: number('Tassen') },
        { name: 'Wasser', icon: '💧', color: '#06b6d4', fields: number('Glas') }
      ]
    }
  ]
};
