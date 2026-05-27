import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Sheet from './Sheet.svelte';

const snip = (html: string) => createRawSnippet(() => ({ render: () => `<span>${html}</span>` }));

describe('Sheet', () => {
  it('shows title and back button when canGoBack', () => {
    let backed = false;
    const { getByText } = render(Sheet, {
      props: { open: true, title: 'Körperlich', canGoBack: true, onBack: () => { backed = true; }, onClose: () => {}, children: snip('list') } as any
    });
    fireEvent.click(getByText('‹ Zurück'));
    expect(backed).toBe(true);
  });

  it('hides back button when canGoBack is false', () => {
    const { queryByText } = render(Sheet, {
      props: { open: true, title: 't', canGoBack: false, onBack: () => {}, onClose: () => {}, children: snip('x') } as any
    });
    expect(queryByText('‹ Zurück')).toBeNull();
  });
});
