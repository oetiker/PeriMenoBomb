import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestPersistentStorage, isPersistenceSupported } from './persist';

function setStorage(storage: unknown): void {
  Object.defineProperty(globalThis.navigator, 'storage', { configurable: true, value: storage });
}

afterEach(() => {
  Object.defineProperty(globalThis.navigator, 'storage', { configurable: true, value: undefined });
});

describe('requestPersistentStorage', () => {
  it('returns false when the Storage API is unavailable', async () => {
    setStorage(undefined);
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('returns true without requesting when already persisted', async () => {
    const persist = vi.fn();
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('requests persistence and returns the grant result when not yet persisted', async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(true) });
    expect(await requestPersistentStorage()).toBe(true);
  });

  it('returns false when the grant is declined', async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('returns false when a non-secure context throws', async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockRejectedValue(new Error('insecure')) });
    expect(await requestPersistentStorage()).toBe(false);
  });
});

describe('isPersistenceSupported', () => {
  it('is false when the Storage API has no persist()', () => {
    setStorage(undefined);
    expect(isPersistenceSupported()).toBe(false);
    setStorage({});
    expect(isPersistenceSupported()).toBe(false);
  });

  it('is true when persist() exists', () => {
    setStorage({ persist: vi.fn(), persisted: vi.fn() });
    expect(isPersistenceSupported()).toBe(true);
  });
});
