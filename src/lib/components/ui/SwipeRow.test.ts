import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import SwipeRow from './SwipeRow.svelte';

const snip = (html: string) => createRawSnippet(() => ({ render: () => `<span>${html}</span>` }));

function touch(x: number, y = 0): Touch {
  return { clientX: x, clientY: y, identifier: 1, pageX: x, pageY: y, screenX: x, screenY: y, target: document.body, force: 1, radiusX: 1, radiusY: 1, rotationAngle: 0 } as unknown as Touch;
}

describe('SwipeRow', () => {
  it('fires onSwipe when swipe left exceeds threshold', async () => {
    let swiped = 0;
    const { container } = render(SwipeRow, { props: { onSwipe: () => { swiped++; }, children: snip('row') } as any });
    const el = container.querySelector('.swipe-row') as HTMLElement;
    await fireEvent.touchStart(el, { touches: [touch(200)] });
    await fireEvent.touchMove(el, { touches: [touch(50)] });
    await fireEvent.touchEnd(el, { changedTouches: [touch(50)] });
    expect(swiped).toBe(1);
  });

  it('does not fire for short swipe', async () => {
    let swiped = 0;
    const { container } = render(SwipeRow, { props: { onSwipe: () => { swiped++; }, children: snip('row') } as any });
    const el = container.querySelector('.swipe-row') as HTMLElement;
    await fireEvent.touchStart(el, { touches: [touch(200)] });
    await fireEvent.touchMove(el, { touches: [touch(180)] });
    await fireEvent.touchEnd(el, { changedTouches: [touch(180)] });
    expect(swiped).toBe(0);
  });
});
