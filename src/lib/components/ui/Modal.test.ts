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
    // Real clicks emit pointerdown before click; the Modal now requires both
    // to land on the backdrop so a drag that ends on the backdrop doesn't dismiss.
    await fireEvent.pointerDown(backdrop, { pointerId: 1 });
    await fireEvent.click(backdrop);
    await tick();
    expect(closed).toBe(true);
  });

  it('does NOT emit onClose when pointerdown is inside the sheet and click bubbles to the backdrop', async () => {
    let closed = false;
    const { container } = render(Modal, { props: { open: true, title: 't', onClose: () => { closed = true; }, children: snip('x') } as any });
    const backdrop = container.querySelector('.backdrop') as HTMLElement;
    const sheet = container.querySelector('.sheet') as HTMLElement;
    // Simulate a drag that started in the sheet (e.g. on a slider) and released on the backdrop.
    await fireEvent.pointerDown(sheet, { pointerId: 1 });
    await fireEvent.click(backdrop);
    await tick();
    expect(closed).toBe(false);
  });
});
