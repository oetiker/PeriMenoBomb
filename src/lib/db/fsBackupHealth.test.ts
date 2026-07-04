// src/lib/db/fsBackupHealth.test.ts
//
// Permission-state behavior of runAutoBackup / autoBackupHealth. On Chrome
// Android, closing the installed PWA demotes the granted folder permission to
// 'prompt' — an expected state that heals itself on the next gesture-driven
// backup. These tests pin down that 'prompt' stays silent while 'denied' (or a
// user turning down the re-grant prompt) is still surfaced as broken.
//
// The meta module is mocked with an in-memory map so a fake directory handle
// (with queryPermission/requestPermission methods) can be "persisted" — the
// real Dexie table can't structured-clone functions.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// vi.mock() calls are hoisted above ordinary declarations, so the map the
// factory closes over must be hoisted too or it lands in the temporal dead
// zone under some transforms.
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock('./meta', () => ({
  getMeta: async (key: string) => store.get(key),
  setMeta: async (key: string, value: unknown) => {
    store.set(key, value);
  }
}));

import { runAutoBackup, autoBackupHealth } from './fsBackup';

function fakeDirHandle(
  state: PermissionState,
  requestResult: PermissionState = state
): unknown {
  return {
    queryPermission: async () => state,
    requestPermission: async () => requestResult
  };
}

beforeEach(() => {
  store.clear();
  store.set('autoBackupEnabled', true);
  // Make isAutoBackupSupported() true in jsdom.
  (window as unknown as Record<string, unknown>).showDirectoryPicker = () => undefined;
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
});

describe('runAutoBackup permission handling', () => {
  it("stays silent on 'prompt' without a gesture (cold start)", async () => {
    store.set('autoBackupDirHandle', fakeDirHandle('prompt'));
    expect(await runAutoBackup(1000)).toBe('unhealthy');
    expect(store.get('autoBackupLastError')).toBeUndefined();
  });

  it("records an error on 'denied'", async () => {
    store.set('autoBackupDirHandle', fakeDirHandle('denied'));
    expect(await runAutoBackup(1000)).toBe('unhealthy');
    expect(store.get('autoBackupLastError')).toBe('permission');
  });

  it('records an error when the user turns down the re-grant prompt', async () => {
    // gesture available, requestPermission comes back 'prompt' (dismissed)
    store.set('autoBackupDirHandle', fakeDirHandle('prompt', 'prompt'));
    expect(await runAutoBackup(1000, true)).toBe('unhealthy');
    expect(store.get('autoBackupLastError')).toBe('permission');
  });
});

describe('autoBackupHealth permission handling', () => {
  it("treats 'prompt' with a prior success as healthy (no banner)", async () => {
    store.set('autoBackupDirHandle', fakeDirHandle('prompt'));
    store.set('autoBackupLastSuccess', 1000);
    expect(await autoBackupHealth()).toEqual({ enabled: true, healthy: true });
  });

  it("treats 'prompt' without any success yet as 'no-backup-yet'", async () => {
    store.set('autoBackupDirHandle', fakeDirHandle('prompt'));
    expect(await autoBackupHealth()).toEqual({
      enabled: true,
      healthy: false,
      reason: 'no-backup-yet'
    });
  });

  it("reports 'permission' on 'denied'", async () => {
    store.set('autoBackupDirHandle', fakeDirHandle('denied'));
    store.set('autoBackupLastSuccess', 1000);
    expect(await autoBackupHealth()).toEqual({
      enabled: true,
      healthy: false,
      reason: 'permission'
    });
  });

  it("still reports a recorded 'permission' error while access is 'prompt'", async () => {
    // The user explicitly turned down a re-grant prompt earlier; the banner
    // must persist so the "Fortsetzen" path stays discoverable.
    store.set('autoBackupDirHandle', fakeDirHandle('prompt'));
    store.set('autoBackupLastSuccess', 1000);
    store.set('autoBackupLastError', 'permission');
    expect(await autoBackupHealth()).toEqual({
      enabled: true,
      healthy: false,
      reason: 'permission'
    });
  });
});
