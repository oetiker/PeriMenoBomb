import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chooseDeliveryMode } from './deliver';

describe('chooseDeliveryMode', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('prefers share when navigator.canShare(files) is true', () => {
    const nav = { canShare: () => true, share: () => Promise.resolve() } as unknown as Navigator;
    expect(chooseDeliveryMode(nav, true)).toBe('share');
  });

  it('falls back to new-tab when share is unavailable but popups allowed', () => {
    const nav = {} as Navigator;
    expect(chooseDeliveryMode(nav, true)).toBe('newtab');
  });

  it('falls back to download when share unavailable and popups blocked', () => {
    const nav = {} as Navigator;
    expect(chooseDeliveryMode(nav, false)).toBe('download');
  });
});
