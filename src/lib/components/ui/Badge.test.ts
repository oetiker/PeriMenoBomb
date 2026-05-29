import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Badge from './Badge.svelte';

describe('Badge', () => {
  it('renders a circular container with a tinted background derived from the chosen color', () => {
    const { container } = render(Badge, { props: { icon: '🔥', color: '#ef4444', size: 28 } });
    const root = container.querySelector('.badge') as HTMLElement;
    expect(root).toBeTruthy();
    // 18% color-mix lands between the chosen color and the surface — the raw
    // hex shouldn't appear as a solid fill anymore.
    expect(root.style.background).toContain('color-mix');
    expect(root.style.background).toContain('#ef4444');
    expect(root.style.width).toBe('28px');
    expect(root.style.height).toBe('28px');
  });

  it('shows reduced opacity when archived', () => {
    const { container } = render(Badge, { props: { icon: '🔥', color: '#ef4444', archived: true } });
    const root = container.querySelector('.badge') as HTMLElement;
    expect(root.style.opacity).toBe('0.5');
  });

  it('renders the emoji as its glyph', () => {
    const { container } = render(Badge, { props: { icon: '🔥', color: '#ef4444' } });
    expect(container.querySelector('.emoji')?.textContent).toBe('🔥');
  });

  it('applies a hue-rotating filter when duotone is enabled', () => {
    const { container } = render(Badge, { props: { icon: '🔥', color: '#ef4444', duotone: true } });
    const el = container.querySelector('.emoji') as HTMLElement;
    expect(el.style.filter).toContain('hue-rotate');
  });

  it('uses no filter when duotone is disabled', () => {
    const { container } = render(Badge, { props: { icon: '🔥', color: '#ef4444', duotone: false } });
    const el = container.querySelector('.emoji') as HTMLElement;
    expect(el.style.filter).toBe('none');
  });
});
