import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import SwipeRow from './SwipeRow.svelte';

const snip = (html: string) => createRawSnippet(() => ({ render: () => `<span>${html}</span>` }));

const ptr = (clientX: number, clientY = 0) => ({ clientX, clientY, pointerId: 1, pointerType: 'touch', button: 0 });

describe('SwipeRow', () => {
  it('fires onSwipe when swipe left exceeds threshold', async () => {
    let swiped = 0;
    const { container } = render(SwipeRow, { props: { onSwipe: () => { swiped++; }, children: snip('row') } as any });
    const el = container.querySelector('.swipe-row') as HTMLElement;
    await fireEvent.pointerDown(el, ptr(200));
    await fireEvent.pointerMove(el, ptr(50));
    await fireEvent.pointerUp(el, ptr(50));
    expect(swiped).toBe(1);
  });

  it('does not fire for short swipe', async () => {
    let swiped = 0;
    const { container } = render(SwipeRow, { props: { onSwipe: () => { swiped++; }, children: snip('row') } as any });
    const el = container.querySelector('.swipe-row') as HTMLElement;
    await fireEvent.pointerDown(el, ptr(200));
    await fireEvent.pointerMove(el, ptr(180));
    await fireEvent.pointerUp(el, ptr(180));
    expect(swiped).toBe(0);
  });

  it('does not fire for a vertical drag (lets the page scroll)', async () => {
    let swiped = 0;
    const { container } = render(SwipeRow, { props: { onSwipe: () => { swiped++; }, children: snip('row') } as any });
    const el = container.querySelector('.swipe-row') as HTMLElement;
    await fireEvent.pointerDown(el, ptr(200, 100));
    await fireEvent.pointerMove(el, ptr(190, 300)); // mostly vertical
    await fireEvent.pointerUp(el, ptr(190, 300));
    expect(swiped).toBe(0);
  });
});
