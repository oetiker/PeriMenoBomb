export interface TemplateTag { name: string; }
export interface TemplateSymptom {
  name: string;
  icon: string;
  color: string;
  tags?: string[];
  children?: TemplateSymptom[];
}
export interface Template {
  tags: TemplateTag[];
  roots: TemplateSymptom[];
}

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
        { name: 'Hitzewallungen',  icon: 'flame',       color: '#f59e0b', tags: ['körperlich', 'hormonell'] },
        { name: 'Nachtschweiss',   icon: 'cloud-drizzle', color: '#06b6d4', tags: ['körperlich', 'schlafrelevant', 'hormonell'] },
        { name: 'Herzrasen',       icon: 'heart-pulse', color: '#ef4444', tags: ['körperlich'] },
        { name: 'Gelenkschmerzen', icon: 'bandage',     color: '#84cc16', tags: ['körperlich'] },
        { name: 'Kopfschmerzen',   icon: 'brain',       color: '#6366f1', tags: ['körperlich'] },
        { name: 'Schwindel',       icon: 'sparkles',    color: '#8b5cf6', tags: ['körperlich'] }
      ]
    },
    {
      name: 'Stimmung & Gefühle', icon: 'heart', color: '#ec4899',
      children: [
        { name: 'Reizbarkeit',     icon: 'angry', color: '#f97316', tags: ['emotional'] },
        { name: 'Stimmungstief',   icon: 'frown', color: '#3b82f6', tags: ['emotional'] },
        { name: 'Angst',           icon: 'alert-triangle', color: '#dc2626', tags: ['emotional'] },
        { name: 'Konzentrationsschwierigkeiten', icon: 'cloud-fog', color: '#6b7280', tags: ['emotional'] }
      ]
    },
    {
      name: 'Schlaf', icon: 'moon', color: '#6366f1',
      children: [
        { name: 'Einschlafstörungen', icon: 'bed', color: '#6366f1', tags: ['schlafrelevant'] },
        { name: 'Durchschlafstörungen', icon: 'moon', color: '#8b5cf6', tags: ['schlafrelevant'] }
      ]
    },
    {
      name: 'Energie & Antrieb', icon: 'zap', color: '#eab308',
      children: [
        { name: 'Müdigkeit', icon: 'coffee', color: '#f59e0b', tags: ['körperlich', 'emotional'] },
        { name: 'Erschöpfung', icon: 'cloud', color: '#6b7280', tags: ['körperlich', 'emotional'] }
      ]
    }
  ]
};
