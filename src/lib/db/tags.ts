import { db, type Tag } from './index';
import { newId } from '$lib/utils/uuid';

export async function createTag(name: string): Promise<Tag> {
  const tag: Tag = { id: newId(), name, createdAt: Date.now() };
  await db.tags.add(tag);
  return tag;
}

export async function listTags(): Promise<Tag[]> {
  const all = await db.tags.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
}

export async function renameTag(id: string, name: string): Promise<void> {
  await db.tags.update(id, { name });
}

export async function deleteTag(id: string): Promise<void> {
  await db.transaction('rw', db.tags, db.symptoms, async () => {
    await db.tags.delete(id);
    const affected = await db.symptoms.filter((s) => s.tagIds.includes(id)).toArray();
    for (const s of affected) {
      await db.symptoms.update(s.id, {
        tagIds: s.tagIds.filter((t) => t !== id),
        updatedAt: Date.now()
      });
    }
  });
}

export async function countSymptomsUsingTag(id: string): Promise<number> {
  return db.symptoms.filter((s) => !s.archived && s.tagIds.includes(id)).count();
}
