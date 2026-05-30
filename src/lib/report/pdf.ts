import type { Symptom, Tag, Entry } from '$lib/db';
import { selectLabelFor } from '$lib/db/entries';
import type { DayGroup } from './filter';

export interface PdfRow {
  date: string;
  /** [Symptom, Intensität, Anzahl, Kommentar, Tags] */
  cells: [string, string, string, string, string];
}

export interface PdfHeader {
  title: string;
  rangeLabel: string;
  filterLabel: string;
  generatedLabel: string;
}

/** First value column: slider intensity and/or the chosen select label. A
    symptom usually uses one or the other; if it has both, they're joined. */
function intensityCell(s: Symptom, e: Entry): string {
  const parts: string[] = [];
  if (s.inputs.slider.enabled) parts.push(e.sliderValue === null ? 'unspez' : String(e.sliderValue));
  const sel = selectLabelFor(s, e);
  if (sel) parts.push(sel);
  return parts.join(' / ');
}
function numberCell(s: Symptom, v: number | null): string {
  if (!s.inputs.number.enabled || v === null) return '';
  const unit = s.inputs.number.unit;
  return unit ? `${v} ${unit}` : String(v);
}
function tagsCell(s: Symptom, tags: Map<string, Tag>): string {
  return s.tagIds.map((id) => tags.get(id)?.name).filter(Boolean).join(', ');
}

/** Flatten day groups into tabular rows. Pure; no jsPDF dependency. */
export function entriesToPdfBody(
  groups: DayGroup[],
  symptoms: Map<string, Symptom>,
  tags: Map<string, Tag>
): PdfRow[] {
  const rows: PdfRow[] = [];
  for (const g of groups) {
    for (const e of g.entries) {
      const s = symptoms.get(e.symptomId);
      if (!s) continue;
      rows.push({
        date: g.date,
        cells: [
          s.name,
          intensityCell(s, e),
          numberCell(s, e.numberValue),
          e.comment ?? '',
          tagsCell(s, tags)
        ]
      });
    }
  }
  return rows;
}

/** Render a day-grouped table to a PDF Blob. Dynamically imports jsPDF so the
    library never enters the main bundle (export is a rare, on-demand action). */
export async function buildEntriesPdfBlob(
  groups: DayGroup[],
  symptoms: Map<string, Symptom>,
  tags: Map<string, Tag>,
  header: PdfHeader
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.text(header.title, 40, 48);
  doc.setFontSize(10);
  doc.text(`Zeitraum: ${header.rangeLabel}`, 40, 66);
  doc.text(`Filter: ${header.filterLabel}`, 40, 80);
  doc.text(`Erstellt: ${header.generatedLabel}`, 40, 94);

  let startY = 112;
  for (const g of groups) {
    const body = entriesToPdfBody([g], symptoms, tags).map((r) => r.cells);
    if (body.length === 0) continue;
    autoTable(doc, {
      startY,
      head: [[g.date, 'Intensität', 'Anzahl', 'Kommentar', 'Tags']],
      body,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [107, 74, 138] },
      margin: { left: 40, right: 40 }
    });
    // @ts-expect-error autotable augments the doc with lastAutoTable at runtime
    startY = (doc.lastAutoTable?.finalY ?? startY) + 18;
  }

  return doc.output('blob');
}
