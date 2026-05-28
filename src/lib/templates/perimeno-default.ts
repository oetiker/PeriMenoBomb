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

export const DEFAULT_TEMPLATE: Template = {
  tags: [
    { name: 'körperlich' },
    { name: 'emotional' },
    { name: 'schlafrelevant' },
    { name: 'hormonell' }
  ],
  roots: [
    {
      name: 'Körperlich', icon: 'activity', color: '#10b981',
      children: [
        { name: 'Hitzewallungen',  icon: 'flame',         color: '#f59e0b', tags: ['körperlich', 'hormonell'],                    inputs: { ...slider('kurz', 'lang'), ...number('Schübe') } },
        { name: 'Nachtschweiss',   icon: 'cloud-drizzle', color: '#06b6d4', tags: ['körperlich', 'schlafrelevant', 'hormonell'],  inputs: slider('leicht', 'stark') },
        { name: 'Herzrasen',       icon: 'heart-pulse',   color: '#ef4444', tags: ['körperlich'],                                 inputs: slider('leicht', 'stark') },
        { name: 'Gelenkschmerzen', icon: 'bandage',       color: '#84cc16', tags: ['körperlich'],                                 inputs: slider('leicht', 'stark') },
        { name: 'Kopfschmerzen',   icon: 'brain',         color: '#6366f1', tags: ['körperlich'],                                 inputs: slider('leicht', 'stark') },
        { name: 'Schwindel',       icon: 'sparkles',      color: '#8b5cf6', tags: ['körperlich'],                                 inputs: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Stimmung & Gefühle', icon: 'heart', color: '#ec4899',
      children: [
        { name: 'Reizbarkeit',                   icon: 'angry',          color: '#f97316', tags: ['emotional'], inputs: slider('kaum', 'sehr', false),     daily: true },
        { name: 'Stimmungstief',                 icon: 'frown',          color: '#3b82f6', tags: ['emotional'], inputs: slider('leicht', 'stark', false), daily: true },
        { name: 'Angst',                         icon: 'alert-triangle', color: '#dc2626', tags: ['emotional'], inputs: slider('leicht', 'stark') },
        { name: 'Konzentrationsschwierigkeiten', icon: 'cloud-fog',      color: '#6b7280', tags: ['emotional'], inputs: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Schlaf', icon: 'moon', color: '#6366f1',
      children: [
        { name: 'Einschlafstörungen',   icon: 'bed',        color: '#6366f1', tags: ['schlafrelevant'], inputs: slider('leicht', 'stark') },
        { name: 'Durchschlafstörungen', icon: 'moon',       color: '#8b5cf6', tags: ['schlafrelevant'], inputs: number('Aufwachvorgänge') },
        { name: 'Schlafqualität',       icon: 'bed-double', color: '#6366f1', tags: ['schlafrelevant'], inputs: slider('schlecht', 'gut', false), daily: true }
      ]
    },
    {
      name: 'Energie & Antrieb', icon: 'zap', color: '#eab308',
      children: [
        { name: 'Müdigkeit',   icon: 'coffee', color: '#f59e0b', tags: ['körperlich', 'emotional'], inputs: slider('leicht', 'stark', false), daily: true },
        { name: 'Erschöpfung', icon: 'cloud',  color: '#6b7280', tags: ['körperlich', 'emotional'], inputs: slider('leicht', 'stark') }
      ]
    },
    {
      name: 'Konsum', icon: 'cup-soda', color: '#0ea5e9',
      children: [
        { name: 'Kaffee', icon: 'coffee',  color: '#a16207', inputs: number('Tassen') },
        { name: 'Wasser', icon: 'droplet', color: '#06b6d4', inputs: number('Glas') }
      ]
    }
  ]
};
