import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SliderInput from './SliderInput.svelte';

function makeRect(left: number, width: number) {
  return { left, right: left + width, top: 0, bottom: 32, width, height: 32, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
}

describe('SliderInput', () => {
  it('initial value=null shows thumb on unspez slot', () => {
    const { container } = render(SliderInput, {
      props: { value: null, lowLabel: 'leicht', highLabel: 'hoch', onChange: () => {} }
    });
    const thumb = container.querySelector('[data-thumb]') as HTMLElement;
    expect(thumb.dataset.zone).toBe('unspez');
  });

  it('initial value=50 shows thumb on continuous track', () => {
    const { container } = render(SliderInput, {
      props: { value: 50, lowLabel: 'leicht', highLabel: 'hoch', onChange: () => {} }
    });
    const thumb = container.querySelector('[data-thumb]') as HTMLElement;
    expect(thumb.dataset.zone).toBe('continuous');
  });

  it('clicking on the continuous track calls onChange with a 1..100 number', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: null, lowLabel: 'leicht', highLabel: 'hoch', onChange }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    // Pretend the track is 200px wide, unspez=0..30, gap=30..48, cont=48..170 (30px right indent).
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    // Pointer at x=109 → middle of continuous range → ~50.
    await fireEvent.pointerDown(track, { clientX: 109, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenCalled();
    const v = onChange.mock.calls[0][0];
    expect(v).toBeGreaterThanOrEqual(40);
    expect(v).toBeLessThanOrEqual(60);
  });

  it('clicking on the unspez slot calls onChange(null)', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: 50, lowLabel: 'leicht', highLabel: 'hoch', onChange }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    await fireEvent.pointerDown(track, { clientX: 10, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('clicking in the gap from null stays null', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: null, lowLabel: 'leicht', highLabel: 'hoch', onChange }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    // Pointer at x=40 → in the gap (30..48).
    await fireEvent.pointerDown(track, { clientX: 40, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('clicking in the gap from continuous stays at value 1', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: 50, lowLabel: 'leicht', highLabel: 'hoch', onChange }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    await fireEvent.pointerDown(track, { clientX: 40, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('with step=25 snaps the committed value to a multiple of 25', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: null, lowLabel: 'leicht', highLabel: 'hoch', onChange, step: 25 }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    // Middle of the continuous range → snaps to 50.
    await fireEvent.pointerDown(track, { clientX: 109, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(50);
  });

  it('with step=25 a click near the low end snaps up to the lowest stop (25)', async () => {
    const onChange = vi.fn();
    const { container } = render(SliderInput, {
      props: { value: null, lowLabel: 'leicht', highLabel: 'hoch', onChange, step: 25 }
    });
    const track = container.querySelector('[data-track]') as HTMLElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(makeRect(0, 200));
    // Just inside the continuous zone (cont starts at x=48).
    await fireEvent.pointerDown(track, { clientX: 52, clientY: 16, pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(25);
  });

  it('renders one tick per stop when stepped, and none when stepless', () => {
    const stepped = render(SliderInput, {
      props: { value: null, lowLabel: 'l', highLabel: 'h', onChange: () => {}, step: 25 }
    });
    expect(stepped.container.querySelectorAll('.tick').length).toBe(4);

    const free = render(SliderInput, {
      props: { value: null, lowLabel: 'l', highLabel: 'h', onChange: () => {}, step: 1 }
    });
    expect(free.container.querySelectorAll('.tick').length).toBe(0);
  });
});
