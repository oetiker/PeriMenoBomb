import { db, type Symptom } from './index';
import { newId } from '$lib/utils/uuid';

export interface CreateSymptomInput {
  name: string;
  isFolder?: boolean;
  parentId?: string | null;
  color?: string;
  icon?: string;
  tagIds?: string[];
}

export const DEFAULT_COLOR = '#6b7280';
export const DEFAULT_ICON = 'circle';
export const DEFAULT_FOLDER_ICON = 'folder';
export const MAX_DEPTH = 2; // 0,1,2 = drei Ebenen

async function nextSortIndex(parentId: string | null): Promise<number> {
  return db.symptoms.filter((s) => s.parentId === parentId).count();
}

async function computeDepth(parentId: string | null): Promise<number> {
  if (parentId === null) return 0;
  const parent = await db.symptoms.get(parentId);
  if (!parent) throw new Error(`parent ${parentId} not found`);
  return parent.depth + 1;
}

export async function createSymptom(input: CreateSymptomInput): Promise<Symptom> {
  const parentId = input.parentId ?? null;
  const depth = await computeDepth(parentId);
  if (depth > MAX_DEPTH) {
    throw new Error(`max hierarchy depth ${MAX_DEPTH + 1} exceeded`);
  }
  const now = Date.now();
  const isFolder = input.isFolder ?? false;
  const sym: Symptom = {
    id: newId(),
    name: input.name,
    color: input.color ?? DEFAULT_COLOR,
    icon: input.icon ?? (isFolder ? DEFAULT_FOLDER_ICON : DEFAULT_ICON),
    tagIds: input.tagIds ?? [],
    parentId,
    sortIndex: await nextSortIndex(parentId),
    depth,
    isFolder,
    archived: false,
    createdAt: now,
    updatedAt: now
  };
  await db.symptoms.add(sym);
  return sym;
}

export async function getSymptom(id: string): Promise<Symptom | undefined> {
  return db.symptoms.get(id);
}

export async function updateSymptom(
  id: string,
  patch: Partial<Omit<Symptom, 'id' | 'createdAt' | 'parentId' | 'depth' | 'sortIndex'>>
): Promise<void> {
  await db.symptoms.update(id, { ...patch, updatedAt: Date.now() });
}

export async function archiveSymptom(id: string): Promise<void> {
  await db.symptoms.update(id, { archived: true, updatedAt: Date.now() });
}

export async function listAllSymptoms(): Promise<Symptom[]> {
  return db.symptoms.toArray();
}

export async function listChildren(parentId: string | null): Promise<Symptom[]> {
  const rows = await db.symptoms.filter((s) => s.parentId === parentId && !s.archived).toArray();
  return rows.sort((a, b) => a.sortIndex - b.sortIndex);
}
