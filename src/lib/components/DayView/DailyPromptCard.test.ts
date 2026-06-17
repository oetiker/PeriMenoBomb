import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DailyPromptCard from './DailyPromptCard.svelte';
import { type Symptom } from '$lib/db';

function makeSym(p: Partial<Symptom> = {}): Symptom {
  return {
    id: 's1', name: 'Stimmung', color: '#3b82f6', icon: 'smile',
    tagIds: [], parentId: null, sortIndex: 0, depth: 0,
    isFolder: false, archived: false, createdAt: 0, updatedAt: 0,
    fields: [], daily: true, ...p
  };
}

describe('DailyPromptCard', () => {
  it('renders symptom name and a hint', () => {
    const { getByText } = render(DailyPromptCard, {
      props: { symptom: makeSym(), onTap: () => {} }
    });
    expect(getByText('Stimmung')).toBeTruthy();
    expect(getByText('noch nicht erfasst')).toBeTruthy();
  });

  it('calls onTap when clicked', async () => {
    const onTap = vi.fn();
    const { getByRole } = render(DailyPromptCard, {
      props: { symptom: makeSym(), onTap }
    });
    await fireEvent.click(getByRole('button'));
    expect(onTap).toHaveBeenCalled();
  });

  it('has muted styling via data-muted', () => {
    const { getByRole } = render(DailyPromptCard, {
      props: { symptom: makeSym(), onTap: () => {} }
    });
    expect(getByRole('button').dataset.muted).toBe('true');
  });
});
