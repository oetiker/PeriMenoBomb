import type { SymptomInputs } from '$lib/db';

export interface TemplateTag { name: string; }
export interface TemplateSymptom {
  name: string;
  icon: string;
  color: string;
  tags?: string[];
  children?: TemplateSymptom[];
  inputs?: Partial<SymptomInputs>;
  daily?: boolean;
}
export interface Template {
  tags: TemplateTag[];
  roots: TemplateSymptom[];
}

const slider = (low: string, high: string, required = true): Partial<SymptomInputs> => ({
  slider:  { enabled: true, required, lowLabel: low, highLabel: high },
  comment: { enabled: true, required: false }
});
const number = (unit: string, integer = true): Partial<SymptomInputs> => ({
  number:  { enabled: true, required: true, unit, integer },
  comment: { enabled: true, required: false }
});
const event = (): Partial<SymptomInputs> => ({
  comment: { enabled: true, required: false }
});

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
        { name: 'Start Mens', icon: '🔴', color: '#be123c', tags: ['hormonell'], inputs: event() },
        { name: 'Ende Mens',  icon: '🏁', color: '#be123c', tags: ['hormonell'], inputs: event() }
      ]
    },
    {
      name: 'Körperlich', icon: '🏃', color: '#10b981',
      children: [
        { name: 'Hitzewallungen',  icon: '🔥', color: '#f59e0b', tags: ['körperlich', 'hormonell'],                    inputs: { ...slider('kurz', 'lang'), ...number('Schübe') } },
        { name: 'Nachtschweiss',   icon: '💦', color: '#06b6d4', tags: ['körperlich', 'schlafrelevant', 'hormonell'],  inputs: slider('leicht', 'stark') },
        { name: 'Herzrasen',       icon: '💓', color: '#ef4444', tags: ['körperlich'],                                 inputs: slider('leicht', 'stark') },
        { name: 'Gelenkschmerzen', icon: '🦴', color: '#84cc16', tags: ['körperlich'],                                 inputs: slider('leicht', 'stark') },
        { name: 'Kopfschmerzen',   icon: '🧠', color: '#6366f1', tags: ['körperlich'],                                 inputs: slider('leicht', 'stark') },
        { name: 'Schwindel',       icon: '✨', color: '#8b5cf6', tags: ['körperlich'],                                 inputs: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Stimmung & Gefühle', icon: '❤️', color: '#ec4899',
      children: [
        { name: 'Reizbarkeit',                   icon: '😡', color: '#f97316', tags: ['emotional'], inputs: slider('kaum', 'sehr', false),     daily: true },
        { name: 'Stimmungstief',                 icon: '🙁', color: '#3b82f6', tags: ['emotional'], inputs: slider('leicht', 'stark', false), daily: true },
        { name: 'Angst',                         icon: '⚠️', color: '#dc2626', tags: ['emotional'], inputs: slider('leicht', 'stark') },
        { name: 'Konzentrationsschwierigkeiten', icon: '🌫️', color: '#6b7280', tags: ['emotional'], inputs: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Schlaf', icon: '🌙', color: '#6366f1',
      children: [
        { name: 'Einschlafstörungen',   icon: '🛏️', color: '#6366f1', tags: ['schlafrelevant'], inputs: slider('leicht', 'stark') },
        { name: 'Durchschlafstörungen', icon: '🌙', color: '#8b5cf6', tags: ['schlafrelevant'], inputs: number('Aufwachvorgänge') },
        { name: 'Schlafqualität',       icon: '😴', color: '#6366f1', tags: ['schlafrelevant'], inputs: slider('schlecht', 'gut', false), daily: true }
      ]
    },
    {
      name: 'Energie & Antrieb', icon: '⚡', color: '#eab308',
      children: [
        { name: 'Müdigkeit',   icon: '🥱', color: '#f59e0b', tags: ['körperlich', 'emotional'], inputs: slider('leicht', 'stark', false), daily: true },
        { name: 'Erschöpfung', icon: '☁️', color: '#6b7280', tags: ['körperlich', 'emotional'], inputs: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Konsum', icon: '🥤', color: '#0ea5e9',
      children: [
        { name: 'Kaffee', icon: '☕', color: '#a16207', inputs: number('Tassen') },
        { name: 'Wasser', icon: '💧', color: '#06b6d4', inputs: number('Glas') }
      ]
    }
  ]
};
