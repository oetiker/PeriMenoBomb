import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import SymptomSheet from './SymptomSheet.svelte';
import { resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';

describe('SymptomSheet', () => {
  beforeEach(() => resetDatabase());

  it('drills into a folder on tap', async () => {
    const folder = await createSymptom({ name: 'Körperlich', isFolder: true });
    await createSymptom({ name: 'Hitzewallungen', parentId: folder.id });
    let picked: string | null = null;
    const { findByText, queryByText } = render(SymptomSheet, {
      props: { open: true, onClose: () => {}, onPick: (id: string) => { picked = id; } } as any
    });
    const folderRow = await findByText('Körperlich');
    await fireEvent.click(folderRow);
    await tick();
    expect(queryByText('Hitzewallungen')).toBeTruthy();
    expect(picked).toBeNull();
  });

  it('calls onPick when a symptom row is tapped', async () => {
    const sym = await createSymptom({ name: 'Migräne' });
    let picked: string | null = null;
    const { findByText } = render(SymptomSheet, {
      props: { open: true, onClose: () => {}, onPick: (id: string) => { picked = id; } } as any
    });
    const row = await findByText('Migräne');
    await fireEvent.click(row);
    await tick();
    expect(picked).toBe(sym.id);
  });
});
