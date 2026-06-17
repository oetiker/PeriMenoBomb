import { db, defaultSymptomFields, type MetaField } from '$lib/db';
import { createTag } from '$lib/db/tags';
import { createSymptom } from '$lib/db/symptoms';
import type { Template, TemplateSymptom } from './perimeno-default';

function fieldsFor(s: TemplateSymptom): MetaField[] {
  return s.fields ?? defaultSymptomFields();
}

export async function importTemplate(t: Template): Promise<void> {
  await db.transaction('rw', db.tags, db.symptoms, async () => {
    const tagIdByName = new Map<string, string>();
    for (const tg of t.tags) {
      const created = await createTag(tg.name);
      tagIdByName.set(tg.name, created.id);
    }
    async function recur(s: TemplateSymptom, parentId: string | null) {
      const isFolder = !!s.children && s.children.length > 0;
      const created = await createSymptom({
        name: s.name,
        icon: s.icon,
        color: s.color,
        isFolder,
        parentId,
        tagIds: (s.tags ?? []).map((n) => tagIdByName.get(n)).filter((x): x is string => !!x),
        fields: isFolder ? undefined : fieldsFor(s),
        daily: isFolder ? false : (s.daily ?? false)
      });
      if (s.children) for (const c of s.children) await recur(c, created.id);
    }
    for (const r of t.roots) await recur(r, null);
  });
}
