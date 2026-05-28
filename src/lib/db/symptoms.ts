import { db, type Symptom, defaultSymptomInputs } from './index';
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
    updatedAt: now,
    inputs: defaultSymptomInputs(),
    daily: false
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

export interface TreeNode extends Symptom {
  children: TreeNode[];
}

export async function listTree(): Promise<TreeNode[]> {
  const all = (await db.symptoms.filter((s) => !s.archived).toArray()).sort(
    (a, b) => a.sortIndex - b.sortIndex
  );
  const byParent = new Map<string | null, Symptom[]>();
  for (const s of all) {
    const list = byParent.get(s.parentId) ?? [];
    list.push(s);
    byParent.set(s.parentId, list);
  }
  function build(node: Symptom): TreeNode {
    return { ...node, children: (byParent.get(node.id) ?? []).map(build) };
  }
  return (byParent.get(null) ?? []).map(build);
}

export async function subtreeDepth(id: string): Promise<number> {
  const root = await db.symptoms.get(id);
  if (!root) throw new Error(`symptom ${id} not found`);
  const all = await db.symptoms.toArray();
  const byParent = new Map<string | null, Symptom[]>();
  for (const s of all) {
    const list = byParent.get(s.parentId) ?? [];
    list.push(s);
    byParent.set(s.parentId, list);
  }
  function walk(node: Symptom, d: number): number {
    const kids = byParent.get(node.id) ?? [];
    if (kids.length === 0) return d;
    return Math.max(...kids.map((k) => walk(k, d + 1)));
  }
  return walk(root, 0);
}

async function descendantIds(id: string): Promise<Set<string>> {
  const all = await db.symptoms.toArray();
  const byParent = new Map<string | null, Symptom[]>();
  for (const s of all) {
    const list = byParent.get(s.parentId) ?? [];
    list.push(s);
    byParent.set(s.parentId, list);
  }
  const out = new Set<string>();
  function walk(nid: string) {
    for (const k of byParent.get(nid) ?? []) {
      out.add(k.id);
      walk(k.id);
    }
  }
  walk(id);
  return out;
}

export async function moveSymptom(id: string, newParentId: string | null): Promise<void> {
  if (id === newParentId) throw new Error('cycle: cannot make node its own parent');
  if (newParentId !== null) {
    const desc = await descendantIds(id);
    if (desc.has(newParentId)) throw new Error('cycle: target is a descendant of source');
  }
  const node = await db.symptoms.get(id);
  if (!node) throw new Error(`symptom ${id} not found`);
  const newDepth = newParentId === null ? 0 : (await db.symptoms.get(newParentId))!.depth + 1;
  const sub = await subtreeDepth(id);
  if (newDepth + sub > MAX_DEPTH) {
    throw new Error(`max hierarchy depth exceeded (would be ${newDepth + sub + 1} levels)`);
  }
  await db.transaction('rw', db.symptoms, async () => {
    const all = await db.symptoms.toArray();
    const byParent = new Map<string | null, Symptom[]>();
    for (const s of all) {
      const list = byParent.get(s.parentId) ?? [];
      list.push(s);
      byParent.set(s.parentId, list);
    }
    const delta = newDepth - node.depth;
    const sub2 = await descendantIds(id);
    const nowTs = Date.now();
    await db.symptoms.update(id, {
      parentId: newParentId,
      depth: newDepth,
      sortIndex: (byParent.get(newParentId)?.length ?? 0),
      updatedAt: nowTs
    });
    for (const sid of sub2) {
      const s = await db.symptoms.get(sid);
      if (s) await db.symptoms.update(sid, { depth: s.depth + delta, updatedAt: nowTs });
    }
  });
}

export async function reorderSiblings(parentId: string | null, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.symptoms, async () => {
    const nowTs = Date.now();
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const s = await db.symptoms.get(id);
      if (!s || s.parentId !== parentId) {
        throw new Error(`symptom ${id} not a child of ${parentId}`);
      }
      await db.symptoms.update(id, { sortIndex: i, updatedAt: nowTs });
    }
  });
}
