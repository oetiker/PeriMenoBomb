import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { snackbar } from './snackbar.svelte';

describe('snackbar store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); snackbar.dismiss(); });

  it('shows a message and auto-dismisses after timeout', () => {
    snackbar.show({ message: 'X entfernt' });
    expect(snackbar.current?.message).toBe('X entfernt');
    vi.advanceTimersByTime(5100);
    expect(snackbar.current).toBeNull();
  });

  it('action callback fires on tap and dismisses', () => {
    let undone = 0;
    snackbar.show({ message: 'X', actionLabel: 'Rückgängig', onAction: () => { undone++; } });
    snackbar.invokeAction();
    expect(undone).toBe(1);
    expect(snackbar.current).toBeNull();
  });
});
