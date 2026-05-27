import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Badge from './Badge.svelte';

describe('Badge', () => {
  it('renders a circular container with the given color and size', () => {
    const { container } = render(Badge, { props: { icon: 'flame', color: '#ef4444', size: 28 } });
    const root = container.querySelector('.badge') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.style.background).toContain('rgb(239, 68, 68)');
    expect(root.style.width).toBe('28px');
    expect(root.style.height).toBe('28px');
  });

  it('shows reduced opacity when archived', () => {
    const { container } = render(Badge, { props: { icon: 'flame', color: '#ef4444', archived: true } });
    const root = container.querySelector('.badge') as HTMLElement;
    expect(root.style.opacity).toBe('0.5');
  });
});
