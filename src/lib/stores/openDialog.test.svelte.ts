import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import {
  persistDialog, updateDialogPayload, clearDialog, loadOpenDialog,
  type OpenDialogState
} from './openDialog.svelte';

describe('openDialog store', () => {
  beforeEach(() => resetDatabase());

  it('persistDialog writes meta.openDialog', async () => {
    const s: OpenDialogState = {
      kind: 'entry-editor',
      route: '/day/2026-05-28',
      payload: { date: '2026-05-28', symptomId: 'x', values: {} }
    };
    await persistDialog(s);
    const row = await db.meta.get('openDialog');
    expect(row?.value).toEqual(s);
  });

  it('updateDialogPayload patches the payload', async () => {
    const s: OpenDialogState = {
      kind: 'entry-editor',
      route: '/day/2026-05-28',
      payload: { date: '2026-05-28', symptomId: 'x', values: {} }
    };
    await persistDialog(s);
    await updateDialogPayload({ values: { comment: 'hello' } });
    const loaded = await loadOpenDialog();
    expect(loaded?.kind).toBe('entry-editor');
    expect((loaded as Extract<OpenDialogState, { kind: 'entry-editor' }>).payload.values).toEqual({ comment: 'hello' });
  });

  it('clearDialog removes the row', async () => {
    await persistDialog({
      kind: 'entry-editor', route: '/day/2026-05-28',
      payload: { date: '2026-05-28', symptomId: 'x', values: {} }
    });
    await clearDialog();
    expect(await loadOpenDialog()).toBeNull();
  });

  it('updateDialogPayload no-ops when nothing persisted', async () => {
    await expect(updateDialogPayload({ values: { x: null } })).resolves.toBeUndefined();
    expect(await loadOpenDialog()).toBeNull();
  });
});
