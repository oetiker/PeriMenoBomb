import { db, type MetaField } from '$lib/db';

export type OpenDialogState =
  | {
      kind: 'entry-editor';
      route: string;
      payload: {
        date: string;
        symptomId: string;
        values: Record<string, number | string | null>;
      };
    }
  | {
      kind: 'symptom-edit';
      route: string;
      payload: {
        symptomId: string | null;
        isNew: boolean;
        isFolder: boolean;
        name: string;
        color: string;
        icon: string;
        tagIds: string[];
        parentId: string | null;
        fields: MetaField[];
        daily: boolean;
        duotone: boolean;
        bg: boolean;
        view: 'main' | 'icons';
      };
    };

const META_KEY = 'openDialog';

// Reactive trigger: when the layout reads a persisted dialog at mount and
// has navigated to its route, it sets pendingRestore so that the route's
// page component can react and open the matching dialog.
let _pending = $state<OpenDialogState | null>(null);

export const pendingRestore = {
  get value(): OpenDialogState | null { return _pending; },
  set(s: OpenDialogState | null) { _pending = s; },
  consume<K extends OpenDialogState['kind']>(kind: K): Extract<OpenDialogState, { kind: K }> | null {
    const cur = _pending;
    if (cur && cur.kind === kind) {
      _pending = null;
      return cur as Extract<OpenDialogState, { kind: K }>;
    }
    return null;
  }
};

export async function persistDialog(state: OpenDialogState): Promise<void> {
  await db.meta.put({ key: META_KEY, value: state });
}

type Patch<K extends OpenDialogState['kind']> =
  Partial<Extract<OpenDialogState, { kind: K }>['payload']>;

export async function updateDialogPayload<K extends OpenDialogState['kind']>(
  patch: Patch<K>
): Promise<void> {
  const row = await db.meta.get(META_KEY);
  if (!row) return;
  const cur = row.value as OpenDialogState;
  const next: OpenDialogState = {
    ...cur,
    payload: { ...(cur.payload as object), ...(patch as object) }
  } as OpenDialogState;
  await db.meta.put({ key: META_KEY, value: next });
}

export async function clearDialog(): Promise<void> {
  await db.meta.delete(META_KEY);
}

export async function loadOpenDialog(): Promise<OpenDialogState | null> {
  const row = await db.meta.get(META_KEY);
  return (row?.value as OpenDialogState | undefined) ?? null;
}
