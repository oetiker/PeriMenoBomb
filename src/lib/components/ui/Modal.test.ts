import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import Modal from './Modal.svelte';

const snip = (html: string) => createRawSnippet(() => ({ render: () => `<span>${html}</span>` }));

describe('Modal', () => {
  it('renders body content when open', async () => {
    const { getByText } = render(Modal, { props: { open: true, title: 'Bearbeiten', children: snip('CONTENT') } as any });
    expect(getByText('CONTENT')).toBeTruthy();
  });

  it('emits onClose on backdrop click', async () => {
    let closed = false;
    const { container } = render(Modal, { props: { open: true, title: 't', onClose: () => { closed = true; }, children: snip('x') } as any });
    const backdrop = container.querySelector('.backdrop') as HTMLElement;
    await fireEvent.click(backdrop);
    await tick();
    expect(closed).toBe(true);
  });
});
