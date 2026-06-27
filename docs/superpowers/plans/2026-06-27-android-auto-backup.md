# Android Auto-Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a File-System-Access-capable browser back the app's data up to a user-chosen folder automatically, with one compressed file per day and N-day rotation, plus make all backups gzip-compressed and restore-compatible.

**Architecture:** Pure, unit-tested helpers (`gzip`, `backupRotation`) at the bottom; a thin FSA/IndexedDB glue layer (`fsBackup`) over them; compression folded into the existing export/import boundary in `transfer.ts`; triggers wired via Dexie write-hooks (debounced) + a launch call in the root layout; Settings UI and a reminder-suppression hook on top.

**Tech Stack:** Svelte 5 (runes), SvelteKit (adapter-static), Dexie 4, Vitest + fake-indexeddb, native Compression Streams API + File System Access API.

## Global Constraints

- Comments / identifiers / keys in **English**; user-facing UI strings in **German** (no generic masculine).
- Package manager **pnpm**; tests `CI=1 pnpm exec vitest run <file>`; type-check `pnpm run check`.
- Offline-first PWA: **no CDN / runtime fetches**, no new runtime dependencies (gzip is native).
- Snapshot Svelte `$state` with `$state.snapshot()` before persisting to Dexie (avoids `DataCloneError`).
- All File System Access paths gated on `'showDirectoryPicker' in window`; unsupported browsers keep the existing manual export + reminder unchanged.
- Compression format: **gzip**. Backup file name: `perimenobomb-YYYY-MM-DD.json.gz`. Retention default **14** days.
- Atomic writes only: temp file then `move()` to final name; never overwrite the last good file in place.
- Run compiler/tests with ≤4 cores.

---

### Task 1: gzip utility

**Files:**
- Create: `src/lib/utils/gzip.ts`
- Test: `src/lib/utils/gzip.test.ts`

**Interfaces:**
- Produces: `gzip(data: Uint8Array): Promise<Uint8Array>`, `gunzip(data: Uint8Array): Promise<Uint8Array>`, `isGzip(data: Uint8Array): boolean`, `encodeText(s: string): Uint8Array`, `decodeText(b: Uint8Array): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/utils/gzip.test.ts
import { describe, it, expect } from 'vitest';
import { gzip, gunzip, isGzip, encodeText, decodeText } from './gzip';

describe('gzip utility', () => {
  it('round-trips text through gzip/gunzip', async () => {
    const original = JSON.stringify({ hello: 'wörld', n: [1, 2, 3] });
    const compressed = await gzip(encodeText(original));
    expect(decodeText(await gunzip(compressed))).toBe(original);
  });

  it('compressed output carries the gzip magic bytes', async () => {
    const compressed = await gzip(encodeText('aaaaaaaaaaaaaaaaaaaa'));
    expect(isGzip(compressed)).toBe(true);
  });

  it('isGzip is false for plain bytes', () => {
    expect(isGzip(encodeText('{"a":1}'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=1 pnpm exec vitest run src/lib/utils/gzip.test.ts`
Expected: FAIL — `Cannot find module './gzip'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/utils/gzip.ts
// Native gzip via the Compression Streams API — no dependency. Backups are
// gzip so the magic bytes (1f 8b) let restore auto-detect compression.
export function encodeText(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function decodeText(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

async function pipe(data: Uint8Array, transform: ReadableWritablePair): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function gzip(data: Uint8Array): Promise<Uint8Array> {
  return pipe(data, new CompressionStream('gzip'));
}

export function gunzip(data: Uint8Array): Promise<Uint8Array> {
  return pipe(data, new DecompressionStream('gzip'));
}

export function isGzip(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=1 pnpm exec vitest run src/lib/utils/gzip.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/gzip.ts src/lib/utils/gzip.test.ts
git commit -m "feat(backup): native gzip/gunzip utility"
```

---

### Task 2: backup rotation logic

**Files:**
- Create: `src/lib/utils/backupRotation.ts`
- Test: `src/lib/utils/backupRotation.test.ts`

**Interfaces:**
- Produces: `backupFileName(dateKey: string): string`, `parseBackupDate(name: string): string | null`, `selectForPruning(names: string[], today: string, retentionDays: number): { keep: string[]; delete: string[] }`, `coerceRetentionDays(value: unknown): number`, `DEFAULT_RETENTION_DAYS: number`.
- `dateKey`/`today` are `YYYY-MM-DD` strings (matches `src/lib/utils/date.ts` `todayKey()`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/utils/backupRotation.test.ts
import { describe, it, expect } from 'vitest';
import { backupFileName, parseBackupDate, selectForPruning, coerceRetentionDays, DEFAULT_RETENTION_DAYS } from './backupRotation';

describe('backup file names', () => {
  it('builds and parses a dated name', () => {
    expect(backupFileName('2026-06-27')).toBe('perimenobomb-2026-06-27.json.gz');
    expect(parseBackupDate('perimenobomb-2026-06-27.json.gz')).toBe('2026-06-27');
  });
  it('returns null for non-backup names (incl. our temp file)', () => {
    expect(parseBackupDate('perimenobomb-2026-06-27.json.gz.tmp')).toBeNull();
    expect(parseBackupDate('notes.txt')).toBeNull();
  });
});

describe('coerceRetentionDays', () => {
  it('defaults / clamps', () => {
    expect(coerceRetentionDays(undefined)).toBe(DEFAULT_RETENTION_DAYS);
    expect(coerceRetentionDays(0)).toBe(1);
    expect(coerceRetentionDays(10000)).toBe(365);
    expect(coerceRetentionDays(7.9)).toBe(7);
  });
});

describe('selectForPruning', () => {
  const names = [
    'perimenobomb-2026-06-27.json.gz', // today
    'perimenobomb-2026-06-26.json.gz',
    'perimenobomb-2026-06-14.json.gz', // exactly 14th day back (keep, N=14)
    'perimenobomb-2026-06-13.json.gz', // older than 14 days (delete)
    'perimenobomb-2026-06-27.json.gz.tmp', // stray temp — left alone
    'README.txt' // foreign — left alone
  ];
  it('keeps files within N days, deletes older, ignores foreign/temp', () => {
    const { keep, delete: del } = selectForPruning(names, '2026-06-27', 14);
    expect(keep).toContain('perimenobomb-2026-06-14.json.gz');
    expect(keep).toContain('perimenobomb-2026-06-27.json.gz');
    expect(del).toEqual(['perimenobomb-2026-06-13.json.gz']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=1 pnpm exec vitest run src/lib/utils/backupRotation.test.ts`
Expected: FAIL — `Cannot find module './backupRotation'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/utils/backupRotation.ts
export const DEFAULT_RETENTION_DAYS = 14;
const MAX_RETENTION_DAYS = 365;
const NAME_RE = /^perimenobomb-(\d{4}-\d{2}-\d{2})\.json\.gz$/;
const DAY_MS = 86_400_000;

export function backupFileName(dateKey: string): string {
  return `perimenobomb-${dateKey}.json.gz`;
}

export function parseBackupDate(name: string): string | null {
  const m = NAME_RE.exec(name);
  return m ? m[1] : null;
}

export function coerceRetentionDays(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(1, Math.floor(n)));
}

// Parse a YYYY-MM-DD key to UTC epoch ms (date-only, so DST/timezone never
// shifts the comparison).
function keyToMs(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

export function selectForPruning(
  names: string[],
  today: string,
  retentionDays: number
): { keep: string[]; delete: string[] } {
  const cutoff = keyToMs(today) - (coerceRetentionDays(retentionDays) - 1) * DAY_MS;
  const keep: string[] = [];
  const del: string[] = [];
  for (const name of names) {
    const date = parseBackupDate(name);
    if (date === null) continue; // foreign / temp file: never touch
    if (keyToMs(date) >= cutoff) keep.push(name);
    else del.push(name);
  }
  return { keep, delete: del };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=1 pnpm exec vitest run src/lib/utils/backupRotation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/backupRotation.ts src/lib/utils/backupRotation.test.ts
git commit -m "feat(backup): dated file names and N-day pruning logic"
```

---

### Task 3: compression at the export/import boundary

**Files:**
- Modify: `src/lib/utils/transfer.ts` (add `gzipExport`, `downloadBlob`, `readImportFile`; remove now-unused `downloadJson`/`readFileAsText`)
- Modify: `src/lib/db/backup.ts:35-39` (`performBackup` writes `.json.gz`)
- Test: `src/lib/utils/transfer.test.ts` (extend)

**Interfaces:**
- Consumes: `gzip`, `gunzip`, `isGzip`, `encodeText`, `decodeText` (Task 1).
- Produces: `gzipExport(payload: ExportPayload): Promise<Blob>`, `downloadBlob(filename: string, blob: Blob): void`, `readImportFile(file: File): Promise<unknown>`.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/utils/transfer.test.ts (add imports at top:
//   import { gzipExport, readImportFile } from './transfer';
//   import { gunzip, decodeText, isGzip } from '$lib/utils/gzip'; )
it('gzipExport produces gzip that readImportFile reads back', async () => {
  await db.tags.add({ id: 't1', name: 'x', createdAt: 1 });
  const payload = await exportAll();
  const blob = await gzipExport(payload);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  expect(isGzip(bytes)).toBe(true);
  const file = new File([blob], 'b.json.gz');
  const parsed = await readImportFile(file) as { tags: unknown[] };
  expect(parsed.tags).toHaveLength(1);
});

it('readImportFile also reads a plain-JSON file', async () => {
  const file = new File(['{"version":1,"symptoms":[],"tags":[],"entries":[],"meta":[]}'], 'b.json');
  const parsed = await readImportFile(file) as { version: number };
  expect(parsed.version).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=1 pnpm exec vitest run src/lib/utils/transfer.test.ts`
Expected: FAIL — `gzipExport`/`readImportFile` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/utils/transfer.ts`, add the import at the top:

```ts
import { gzip, gunzip, isGzip, encodeText, decodeText } from '$lib/utils/gzip';
```

Replace `downloadJson` and `readFileAsText` (lines 57-75) with:

```ts
export async function gzipExport(payload: ExportPayload): Promise<Blob> {
  const bytes = await gzip(encodeText(JSON.stringify(payload)));
  return new Blob([bytes], { type: 'application/gzip' });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Read an export file regardless of compression: gzip is detected by its magic
// bytes (so both .json and .json.gz work, by content not extension), then JSON-
// parsed. Throws on invalid JSON for the caller to surface.
export async function readImportFile(file: File): Promise<unknown> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = isGzip(bytes) ? decodeText(await gunzip(bytes)) : decodeText(bytes);
  return JSON.parse(text);
}
```

In `src/lib/db/backup.ts`, change the import on line 2 and `performBackup` (lines 35-39):

```ts
import { exportAll, gzipExport, downloadBlob } from '$lib/utils/transfer';
import { backupFileName } from '$lib/utils/backupRotation';
```

```ts
export async function performBackup(now: number = Date.now()): Promise<void> {
  const payload = await exportAll();
  const blob = await gzipExport(payload);
  downloadBlob(backupFileName(todayKey()), blob);
  await recordBackupTime(now);
}
```

(Leave the existing `import { todayKey } from '$lib/utils/date'` in place.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=1 pnpm exec vitest run src/lib/utils/transfer.test.ts src/lib/db/backup.test.ts`
Expected: PASS. (The existing `performBackup` test stubs `URL.createObjectURL` + anchor `click`; it still asserts a download click + `lastBackupAt`, which hold.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/transfer.ts src/lib/db/backup.ts src/lib/utils/transfer.test.ts
git commit -m "feat(backup): gzip all exports, auto-detect on import"
```

---

### Task 4: wire compressed read + accept into Settings import

**Files:**
- Modify: `src/routes/settings/+page.svelte` (`onFile` uses `readImportFile`; import statement; file-input `accept`)

**Interfaces:**
- Consumes: `readImportFile` (Task 3).

- [ ] **Step 1: Update the import line**

In `src/routes/settings/+page.svelte`, change the transfer import to:

```ts
import { importAll, readImportFile, validateExportPayload, type ExportPayload } from '$lib/utils/transfer';
```

- [ ] **Step 2: Replace `onFile` (lines 48-62)**

```ts
  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    let payload: unknown;
    try { payload = await readImportFile(f); }
    catch { snackbar.show({ message: 'Datei konnte nicht gelesen werden.' }); return; }
    if (!validateExportPayload(payload)) {
      snackbar.show({ message: 'Datei hat nicht das erwartete Export-Format.' });
      return;
    }
    importState = { payload };
  }
```

- [ ] **Step 3: Widen the file-input `accept`**

Find `<input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />` and change `accept` to:

```
accept="application/json,application/gzip,.json,.gz,.json.gz"
```

- [ ] **Step 4: Verify type-check passes**

Run: `pnpm run check`
Expected: `0 ERRORS 0 WARNINGS`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat(backup): import accepts gzipped and plain backups"
```

---

### Task 5: fsBackup — support detection, config, and directory handle

**Files:**
- Create: `src/lib/db/fsBackup.ts`
- Test: `src/lib/db/fsBackup.test.ts` (only the parts testable in jsdom: support flag false-path + config coercion)

**Interfaces:**
- Consumes: `coerceRetentionDays` (Task 2), `db`/`getMeta`/`setMeta`.
- Produces: `isAutoBackupSupported(): boolean`; `getBackupDirHandle(): Promise<FileSystemDirectoryHandle | undefined>`; `setBackupDirHandle(h: FileSystemDirectoryHandle): Promise<void>`; `clearBackupDirHandle(): Promise<void>`; `isAutoBackupEnabled(): Promise<boolean>`; `setAutoBackupEnabled(on: boolean): Promise<void>`; `getRetentionDays(): Promise<number>`; `setRetentionDays(v: unknown): Promise<void>`; `getAutoBackupStatus(): Promise<{ lastSuccess?: number; lastError?: string }>`; meta keys `autoBackupDirHandle`, `autoBackupEnabled`, `autoBackupRetentionDays`, `autoBackupLastSuccess`, `autoBackupLastError`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/db/fsBackup.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import { isAutoBackupSupported, getRetentionDays, setRetentionDays, isAutoBackupEnabled, setAutoBackupEnabled } from './fsBackup';

describe('fsBackup config', () => {
  beforeEach(() => resetDatabase());

  it('reports unsupported when showDirectoryPicker is absent (jsdom)', () => {
    expect(isAutoBackupSupported()).toBe(false);
  });

  it('retention defaults to 14 and clamps', async () => {
    expect(await getRetentionDays()).toBe(14);
    await setRetentionDays(1000);
    expect(await getRetentionDays()).toBe(365);
  });

  it('enabled flag round-trips', async () => {
    expect(await isAutoBackupEnabled()).toBe(false);
    await setAutoBackupEnabled(true);
    expect(await isAutoBackupEnabled()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=1 pnpm exec vitest run src/lib/db/fsBackup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/db/fsBackup.ts
import { db } from './index';
import { getMeta, setMeta } from './meta';
import { coerceRetentionDays } from '$lib/utils/backupRotation';

const DIR_HANDLE_KEY = 'autoBackupDirHandle';
const ENABLED_KEY = 'autoBackupEnabled';
const RETENTION_KEY = 'autoBackupRetentionDays';
const LAST_SUCCESS_KEY = 'autoBackupLastSuccess';
const LAST_ERROR_KEY = 'autoBackupLastError';

// File System Access pickers exist on Chromium (desktop + Android M132+); absent
// on iOS Safari / Firefox, where the feature is hidden entirely.
export function isAutoBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// FileSystemDirectoryHandle is structured-cloneable, so Dexie can persist it.
export async function getBackupDirHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return getMeta<FileSystemDirectoryHandle>(DIR_HANDLE_KEY);
}
export async function setBackupDirHandle(h: FileSystemDirectoryHandle): Promise<void> {
  await setMeta(DIR_HANDLE_KEY, h);
}
export async function clearBackupDirHandle(): Promise<void> {
  await db.meta.delete(DIR_HANDLE_KEY);
}

export async function isAutoBackupEnabled(): Promise<boolean> {
  return (await getMeta<boolean>(ENABLED_KEY)) === true;
}
export async function setAutoBackupEnabled(on: boolean): Promise<void> {
  await setMeta(ENABLED_KEY, on === true);
}

export async function getRetentionDays(): Promise<number> {
  return coerceRetentionDays(await getMeta(RETENTION_KEY));
}
export async function setRetentionDays(v: unknown): Promise<void> {
  await setMeta(RETENTION_KEY, coerceRetentionDays(v));
}

export async function getAutoBackupStatus(): Promise<{ lastSuccess?: number; lastError?: string }> {
  const ls = await getMeta<unknown>(LAST_SUCCESS_KEY);
  const le = await getMeta<unknown>(LAST_ERROR_KEY);
  return {
    lastSuccess: typeof ls === 'number' && Number.isFinite(ls) ? ls : undefined,
    lastError: typeof le === 'string' && le.length > 0 ? le : undefined
  };
}

export async function recordAutoBackupSuccess(now: number): Promise<void> {
  await setMeta(LAST_SUCCESS_KEY, now);
  await db.meta.delete(LAST_ERROR_KEY);
}
export async function recordAutoBackupError(message: string): Promise<void> {
  await setMeta(LAST_ERROR_KEY, message);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=1 pnpm exec vitest run src/lib/db/fsBackup.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/fsBackup.ts src/lib/db/fsBackup.test.ts
git commit -m "feat(backup): fsBackup support flag, handle persistence, config"
```

---

### Task 6: fsBackup — permission, atomic write, prune, pick

**Files:**
- Modify: `src/lib/db/fsBackup.ts`

**Interfaces:**
- Consumes: `gzip`/`encodeText` (Task 1), `backupFileName`/`selectForPruning` (Task 2), `exportAll` (`transfer`).
- Produces: `pickBackupFolder(): Promise<FileSystemDirectoryHandle | null>`; `queryBackupAccess(h): Promise<PermissionState>`; `requestBackupAccess(h): Promise<boolean>`; `writeBackupFile(dir, bytes: Uint8Array, dateKey: string): Promise<void>`; `pruneBackups(dir, retentionDays: number, today: string): Promise<string[]>`.

> **Testing note:** the File System Access API has no fake implementation in jsdom, so these functions are verified in Task 12 via the Chromium preview/Playwright harness, not unit tests. Implement them with complete code here.

- [ ] **Step 1: Add permission + pick helpers**

Append to `src/lib/db/fsBackup.ts`:

```ts
// The handle's permission methods are not yet in the TS DOM lib; declare the
// minimum we use.
type Perm = { mode: 'read' | 'readwrite' };
type WithPerms = FileSystemDirectoryHandle & {
  queryPermission(p: Perm): Promise<PermissionState>;
  requestPermission(p: Perm): Promise<PermissionState>;
};

export async function pickBackupFolder(): Promise<FileSystemDirectoryHandle | null> {
  // Must be called from a user gesture (a click handler).
  const picker = (window as unknown as {
    showDirectoryPicker(opts?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  try {
    return await picker({ mode: 'readwrite' });
  } catch {
    return null; // user cancelled
  }
}

export function queryBackupAccess(h: FileSystemDirectoryHandle): Promise<PermissionState> {
  return (h as WithPerms).queryPermission({ mode: 'readwrite' });
}

export async function requestBackupAccess(h: FileSystemDirectoryHandle): Promise<boolean> {
  // Must be called from a user gesture.
  return (await (h as WithPerms).requestPermission({ mode: 'readwrite' })) === 'granted';
}
```

- [ ] **Step 2: Add atomic write + prune**

```ts
import { gzip, encodeText } from '$lib/utils/gzip';
import { backupFileName, selectForPruning } from '$lib/utils/backupRotation';

// Atomic: write a temp file, then move() it onto the final name only after a
// clean close, so an interrupted write never clobbers the last good backup.
export async function writeBackupFile(
  dir: FileSystemDirectoryHandle,
  bytes: Uint8Array,
  dateKey: string
): Promise<void> {
  const finalName = backupFileName(dateKey);
  const tmpName = `${finalName}.tmp`;
  const tmp = await dir.getFileHandle(tmpName, { create: true });
  const w = await tmp.createWritable();
  await w.write(bytes);
  await w.close();
  const movable = tmp as FileSystemFileHandle & { move?(name: string): Promise<void> };
  if (typeof movable.move === 'function') {
    await movable.move(finalName); // replaces an existing same-day file
  } else {
    // Fallback for engines without move(): copy then drop the temp.
    const out = await dir.getFileHandle(finalName, { create: true });
    const ow = await out.createWritable();
    await ow.write(bytes);
    await ow.close();
    await dir.removeEntry(tmpName);
  }
}

export async function pruneBackups(
  dir: FileSystemDirectoryHandle,
  retentionDays: number,
  today: string
): Promise<string[]> {
  const names: string[] = [];
  // AsyncIterable keys(); not yet in the TS DOM lib.
  for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) {
    names.push(name);
  }
  const { delete: del } = selectForPruning(names, today, retentionDays);
  for (const name of del) await dir.removeEntry(name);
  return del;
}
```

- [ ] **Step 3: Verify type-check passes**

Run: `pnpm run check`
Expected: `0 ERRORS 0 WARNINGS`.

- [ ] **Step 4: Run the fsBackup config tests (still green)**

Run: `CI=1 pnpm exec vitest run src/lib/db/fsBackup.test.ts`
Expected: PASS (unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/fsBackup.ts
git commit -m "feat(backup): folder pick, permission, atomic write, prune"
```

---

### Task 7: fsBackup — runAutoBackup orchestration + health

**Files:**
- Modify: `src/lib/db/fsBackup.ts`

**Interfaces:**
- Consumes: everything above + `exportAll` (`transfer`), `recordBackupTime` (`backup.ts`), `todayKey` (`date`).
- Produces: `runAutoBackup(now?: number): Promise<'skipped' | 'ok' | 'unhealthy' | 'error'>`; `autoBackupHealth(): Promise<{ enabled: boolean; healthy: boolean; reason?: string }>`.

> **Testing note:** orchestration over FSA — verified in Task 12 (preview). Implement fully here.

- [ ] **Step 1: Implement**

Append to `src/lib/db/fsBackup.ts`:

```ts
import { exportAll } from '$lib/utils/transfer';
import { recordBackupTime } from './backup';
import { todayKey } from '$lib/utils/date';

// Write today's backup file (overwriting) and prune. Silent and best-effort:
// never throws into the caller; failures are recorded for the Settings status.
// `withGesture` allows requesting permission (only true when called from a tap).
export async function runAutoBackup(now: number = Date.now(), withGesture = false): Promise<'skipped' | 'ok' | 'unhealthy' | 'error'> {
  if (!isAutoBackupSupported()) return 'skipped';
  if (!(await isAutoBackupEnabled())) return 'skipped';
  const dir = await getBackupDirHandle();
  if (!dir) return 'unhealthy';

  let access = await queryBackupAccess(dir);
  if (access !== 'granted' && withGesture) {
    access = (await requestBackupAccess(dir)) ? 'granted' : access;
  }
  if (access !== 'granted') {
    await recordAutoBackupError('permission');
    return 'unhealthy';
  }

  try {
    const payload = await exportAll();
    const bytes = await gzip(encodeText(JSON.stringify(payload)));
    const day = todayKey();
    await writeBackupFile(dir, bytes, day);
    await pruneBackups(dir, await getRetentionDays(), day);
    await recordAutoBackupSuccess(now);
    await recordBackupTime(now); // keep the reminder clock consistent
    return 'ok';
  } catch (err) {
    await recordAutoBackupError((err as Error)?.message ?? 'write failed');
    return 'error';
  }
}

export async function autoBackupHealth(): Promise<{ enabled: boolean; healthy: boolean; reason?: string }> {
  const enabled = isAutoBackupSupported() && (await isAutoBackupEnabled());
  if (!enabled) return { enabled: false, healthy: false };
  const dir = await getBackupDirHandle();
  if (!dir) return { enabled: true, healthy: false, reason: 'no-folder' };
  if ((await queryBackupAccess(dir)) !== 'granted') return { enabled: true, healthy: false, reason: 'permission' };
  const { lastError } = await getAutoBackupStatus();
  if (lastError) return { enabled: true, healthy: false, reason: lastError };
  return { enabled: true, healthy: true };
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm run check`
Expected: `0 ERRORS 0 WARNINGS`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/fsBackup.ts
git commit -m "feat(backup): runAutoBackup orchestration and health check"
```

---

### Task 8: triggers — Dexie write-hooks (debounced) + launch call

**Files:**
- Create: `src/lib/db/autoBackupTriggers.ts`
- Modify: `src/routes/+layout.svelte` (call register + launch run in `onMount`)

**Interfaces:**
- Consumes: `runAutoBackup`, `isAutoBackupSupported` (Task 7); `db` (`index`).
- Produces: `registerAutoBackupTriggers(): void`, `scheduleAutoBackup(delayMs?: number): void`.

> **Testing note:** debounced side-effect over FSA; verified in Task 12. Implement fully.

- [ ] **Step 1: Implement the trigger module**

```ts
// src/lib/db/autoBackupTriggers.ts
import { db } from './index';
import { isAutoBackupSupported, runAutoBackup } from './fsBackup';

let timer: ReturnType<typeof setTimeout> | undefined;
let registered = false;

// Coalesce bursts of writes into one backup a few seconds after the last change.
export function scheduleAutoBackup(delayMs = 5000): void {
  if (!isAutoBackupSupported()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; void runAutoBackup(); }, delayMs);
}

// Register once. Hook the data tables (NOT meta — runAutoBackup writes meta and
// would otherwise re-trigger itself). Hooks fire inside the write transaction,
// so we only schedule (the actual backup runs later, outside it).
export function registerAutoBackupTriggers(): void {
  if (registered || !isAutoBackupSupported()) return;
  registered = true;
  for (const table of [db.symptoms, db.entries, db.tags]) {
    table.hook('creating', () => { scheduleAutoBackup(); });
    table.hook('updating', () => { scheduleAutoBackup(); });
    table.hook('deleting', () => { scheduleAutoBackup(); });
  }
}
```

- [ ] **Step 2: Wire into the layout**

In `src/routes/+layout.svelte`, add the import alongside the others:

```ts
import { registerAutoBackupTriggers } from '$lib/db/autoBackupTriggers';
import { runAutoBackup } from '$lib/db/fsBackup';
```

In the `onMount` callback, after `void requestPersistentStorage();`, add:

```ts
    // Auto-backup: register change-triggers and write today's file on launch
    // (no-op when unsupported / disabled / no folder).
    registerAutoBackupTriggers();
    void runAutoBackup();
```

- [ ] **Step 3: Verify type-check + full suite**

Run: `pnpm run check && CI=1 pnpm exec vitest run`
Expected: type-check clean; all tests pass (no behavior change in jsdom — unsupported short-circuits).

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/autoBackupTriggers.ts src/routes/+layout.svelte
git commit -m "feat(backup): debounced change-triggers + launch auto-backup"
```

---

### Task 9: Settings UI — "Automatisches Backup" section

**Files:**
- Modify: `src/routes/settings/+page.svelte`

**Interfaces:**
- Consumes: `isAutoBackupSupported`, `pickBackupFolder`, `setBackupDirHandle`, `getBackupDirHandle`, `requestBackupAccess`, `isAutoBackupEnabled`, `setAutoBackupEnabled`, `getRetentionDays`, `setRetentionDays`, `runAutoBackup`, `getAutoBackupStatus`, `clearBackupDirHandle` (Tasks 5-7); `liveQuery` (`$lib/stores/liveQuery.svelte`).

- [ ] **Step 1: Add script state + handlers**

In `src/routes/settings/+page.svelte` `<script>`, add imports:

```ts
import {
  isAutoBackupSupported, pickBackupFolder, setBackupDirHandle, getBackupDirHandle,
  requestBackupAccess, isAutoBackupEnabled, setAutoBackupEnabled,
  getRetentionDays, setRetentionDays, runAutoBackup, getAutoBackupStatus, clearBackupDirHandle
} from '$lib/db/fsBackup';
```

Add state + handlers (near the other backup state):

```ts
  const autoSupported = isAutoBackupSupported();
  let autoEnabled = $state(false);
  let autoFolder = $state<string | null>(null);
  let autoRetention = $state(14);
  onMount(async () => {
    if (!autoSupported) return;
    autoEnabled = await isAutoBackupEnabled();
    autoRetention = await getRetentionDays();
    autoFolder = (await getBackupDirHandle())?.name ?? null;
  });

  const autoStatusQ = liveQuery(async () => (autoSupported ? getAutoBackupStatus() : { }), { } as { lastSuccess?: number; lastError?: string });
  $effect(() => () => autoStatusQ.dispose());

  async function onPickFolder() {
    const dir = await pickBackupFolder();
    if (!dir) return;
    if (!(await requestBackupAccess(dir))) {
      snackbar.show({ message: 'Schreibzugriff auf den Ordner wurde nicht erlaubt.' });
      return;
    }
    await setBackupDirHandle(dir);
    autoFolder = dir.name;
    await setAutoBackupEnabled(true);
    autoEnabled = true;
    const r = await runAutoBackup(Date.now(), true);
    snackbar.show({ message: r === 'ok' ? 'Auto-Backup eingerichtet.' : 'Ordner gewählt, Backup folgt.' });
  }
  async function onToggleAuto(e: Event) {
    autoEnabled = (e.currentTarget as HTMLInputElement).checked;
    await setAutoBackupEnabled(autoEnabled);
    if (autoEnabled) await runAutoBackup(Date.now(), true);
  }
  async function onAutoRetentionChange(e: Event) {
    await setRetentionDays((e.currentTarget as HTMLInputElement).value || 14);
    autoRetention = await getRetentionDays();
  }
  async function onForgetFolder() {
    await clearBackupDirHandle();
    await setAutoBackupEnabled(false);
    autoEnabled = false; autoFolder = null;
  }
```

- [ ] **Step 2: Add the markup** (after the existing "Backup & Übertragung" `</section>`)

```svelte
{#if autoSupported}
  <section>
    <h2>Automatisches Backup</h2>
    <p>Wähle einen Ordner; die App legt dort täglich ein komprimiertes Backup ab und bewahrt die letzten Tage auf.</p>
    {#if autoFolder}
      <p class="last-backup">Ordner: <strong>{autoFolder}</strong></p>
      <label class="field"><span>Aktiv</span>
        <input type="checkbox" checked={autoEnabled} onchange={onToggleAuto} />
      </label>
      <label class="field reminder-field"><span>Aufbewahrung (Tage)</span>
        <input type="number" min="1" max="365" inputmode="numeric" value={autoRetention} onchange={onAutoRetentionChange} />
      </label>
      {#if autoStatusQ.current.lastError}
        <p class="last-backup warn-text">Auto-Backup unterbrochen – Ordner erneut wählen.</p>
      {:else if autoStatusQ.current.lastSuccess}
        <p class="last-backup">Letztes Auto-Backup: {new Date(autoStatusQ.current.lastSuccess).toLocaleString('de')}</p>
      {/if}
      <button type="button" onclick={onPickFolder}>Ordner ändern</button>
      <button type="button" onclick={onForgetFolder}>Ordner vergessen</button>
    {:else}
      <button type="button" onclick={onPickFolder}>Backup-Ordner wählen</button>
    {/if}
  </section>
{/if}
```

Add to the `<style>` block:

```css
  .warn-text { color: var(--c-danger); }
```

- [ ] **Step 3: Verify type-check passes**

Run: `pnpm run check`
Expected: `0 ERRORS 0 WARNINGS`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat(backup): Settings UI for automatic backup folder"
```

---

### Task 10: reminder suppression when auto-backup is on

**Files:**
- Modify: `src/routes/day/[date]/+page.svelte` (extend `backupQ`)
- Modify: `src/lib/components/DayView/BackupReminder.svelte` (optional "broken" variant)

**Interfaces:**
- Consumes: `autoBackupHealth` (Task 7).

- [ ] **Step 1: Extend the day-page backup query**

In `src/routes/day/[date]/+page.svelte`, add to the imports:

```ts
import { autoBackupHealth } from '$lib/db/fsBackup';
```

Replace the `backupQ` definition (lines 36-43) with:

```ts
  const backupQ = liveQuery(
    async () => {
      const health = await autoBackupHealth();
      // Auto-backup on and healthy → no reminder at all.
      if (health.enabled && health.healthy) return { due: false, broken: false, daysSince: null as number | null };
      // Auto-backup on but broken → show the "interrupted" warning regardless of interval.
      if (health.enabled && !health.healthy) return { due: true, broken: true, daysSince: null as number | null };
      const [days, last] = await Promise.all([getReminderDays(), getLastBackupAt()]);
      const now = Date.now();
      return { due: isBackupDue(days, last, now), broken: false, daysSince: daysSinceBackup(last, now) };
    },
    { due: false, broken: false, daysSince: null as number | null }
  );
```

- [ ] **Step 2: Pass `broken` to the banner**

In the same file, update the `<BackupReminder ... />` usage to add `broken={backupQ.current.broken}`.

In `src/lib/components/DayView/BackupReminder.svelte`, add `broken?: boolean` to the `Props` type and `$props()` destructure, and change the message block so that when `broken` is true it reads:

```svelte
    {#if broken}
      <span class="icon" aria-hidden="true">⚠</span>
      Auto-Backup unterbrochen. Bitte in den Einstellungen den Ordner erneut wählen.
    {:else if daysSince === null}
      … (existing "noch kein Backup" text) …
    {:else}
      … (existing "vor N Tagen" text) …
    {/if}
```

When `broken`, hide the "Jetzt sichern"/"Später" buttons or relabel "Jetzt sichern" to navigate to Settings — simplest: render only a "Später" dismiss when `broken`. (Implementer's choice; keep it minimal.)

- [ ] **Step 3: Verify type-check + suite**

Run: `pnpm run check && CI=1 pnpm exec vitest run`
Expected: clean; all pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/day/[date]/+page.svelte src/lib/components/DayView/BackupReminder.svelte
git commit -m "feat(backup): hide reminder when auto-backup healthy, warn when broken"
```

---

### Task 11: full verification (types + suite + build)

**Files:** none (verification only).

- [ ] **Step 1: Type-check**

Run: `pnpm run check`
Expected: `0 ERRORS 0 WARNINGS`.

- [ ] **Step 2: Full test suite**

Run: `CI=1 pnpm exec vitest run`
Expected: all green (existing + new gzip/rotation/fsBackup/transfer tests).

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: `BUILD OK` (no errors).

- [ ] **Step 4: Commit (if any incidental fixes were needed)**

```bash
git add -A && git commit -m "chore(backup): verification fixes" || echo "nothing to commit"
```

---

### Task 12: real-browser verification (FSA glue)

**Files:** none (manual/e2e; the FSA layer has no jsdom coverage).

This reuses the Chromium preview + Playwright approach already used in this repo (a built preview on `127.0.0.1`, driven headless). The directory picker itself needs a real user gesture and a native folder dialog, which headless Playwright cannot fully drive — so do this verification **manually in Chrome** (desktop is fine; Android optional), checking each behavior:

- [ ] **Step 1:** `pnpm build && pnpm preview --port 4173 --host 127.0.0.1`; open in Chrome.
- [ ] **Step 2:** Settings → "Automatisches Backup" section is visible (it's hidden in Firefox). Click **Backup-Ordner wählen**, pick an empty folder, allow write. Confirm a `perimenobomb-YYYY-MM-DD.json.gz` file appears.
- [ ] **Step 3:** Add/edit an entry; wait ~6 s; confirm the same-day file's modified time updates (one file, not many).
- [ ] **Step 4:** Confirm no stray `*.tmp` remains after a successful write.
- [ ] **Step 5:** Import the produced `.json.gz` via Settings → Daten importieren → confirm data restores (gzip auto-detected).
- [ ] **Step 6:** Set retention to 1, create a file dated yesterday by hand (or change device date), trigger a backup, confirm the old file is pruned.
- [ ] **Step 7:** With auto-backup enabled+healthy, confirm the day-view reminder banner does **not** show; revoke the folder permission (or "Ordner vergessen"), reload, confirm the "Auto-Backup unterbrochen" warning shows.
- [ ] **Step 8:** Record results; if any FSA call needed a workaround, note it for a follow-up.

---
```
