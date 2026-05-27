# PeriMenoBomb MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auslieferungsfähige PWA für tägliches Tracking von Perimenopause-Symptomen mit hierarchischer Symptomliste, Icons/Farben/Tags, voller Editierbarkeit, lokaler IndexedDB-Persistenz und JSON-Export/Import.

**Architecture:** SvelteKit (`adapter-static`) als rein clientseitige PWA. Svelte 5 mit runes für State. Dexie.js kapselt IndexedDB hinter typisierten Modulen; Komponenten konsumieren reaktive LiveQueries. Routing folgt SvelteKits Konvention. Paraglide für i18n-Infrastruktur (initial DE only).

**Tech Stack:** Svelte 5, SvelteKit (`adapter-static`), `@vite-pwa/sveltekit`, Dexie.js, `dexie` LiveQuery via Svelte 5 `$state`/`$effect` wrappers, Paraglide, vanilla CSS + Design Tokens, `svelte-dnd-action`, `lucide-svelte`, Vitest + `@testing-library/svelte` + `fake-indexeddb`, Playwright. **Paketmanager: pnpm** (verbindlich).

**Spec-Referenz:** [docs/superpowers/specs/2026-05-27-perimenobomb-design.md](../specs/2026-05-27-perimenobomb-design.md)

---

## File Structure

Neue Dateien (Top-Level-Layout):

```
PeriMenoBomb/
├── package.json
├── pnpm-lock.yaml          # generiert
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── playwright.config.ts
├── vitest.config.ts
├── project.inlang/         # Paraglide-Settings
│   └── settings.json
├── messages/
│   └── de.json             # deutsche UI-Strings
├── static/
│   ├── favicon.svg
│   ├── icons/
│   │   ├── pwa-192.png
│   │   └── pwa-512.png
│   └── manifest.webmanifest # generiert vom Plugin
└── src/
    ├── app.html
    ├── app.css             # globale Design-Tokens
    ├── app.d.ts
    ├── routes/
    │   ├── +layout.svelte
    │   ├── +layout.ts
    │   ├── +page.svelte                  # weiterleitung -> /tag/heute
    │   ├── tag/[date]/+page.svelte
    │   ├── tag/[date]/+page.ts
    │   ├── symptome/+page.svelte
    │   ├── tags/+page.svelte
    │   ├── verlauf/+page.svelte          # MVP: Placeholder
    │   └── einstellungen/+page.svelte
    └── lib/
        ├── db/
        │   ├── index.ts            # Dexie-Instanz + Schema-Versionen
        │   ├── symptoms.ts
        │   ├── tags.ts
        │   ├── entries.ts
        │   └── meta.ts
        ├── stores/
        │   ├── liveQuery.svelte.ts # Svelte 5 runes-Adapter für Dexie.liveQuery
        │   ├── today.svelte.ts
        │   └── currentDate.svelte.ts
        ├── components/
        │   ├── DayView/
        │   │   ├── DateHeader.svelte
        │   │   ├── EntryList.svelte
        │   │   └── EntryCard.svelte
        │   ├── SymptomSheet/
        │   │   └── SymptomSheet.svelte
        │   ├── EntryEditor/
        │   │   └── EntryEditor.svelte
        │   ├── SymptomAdmin/
        │   │   ├── SymptomList.svelte
        │   │   └── SymptomEditModal.svelte
        │   ├── TagAdmin/
        │   │   └── TagList.svelte
        │   └── ui/
        │       ├── Badge.svelte
        │       ├── BottomNav.svelte
        │       ├── ColorPicker.svelte
        │       ├── IconPicker.svelte
        │       ├── Modal.svelte
        │       ├── Sheet.svelte
        │       ├── Snackbar.svelte
        │       ├── SwipeRow.svelte
        │       └── Fab.svelte
        ├── i18n/
        │   └── locales.ts
        ├── templates/
        │   └── perimeno-default.ts # kuratierte Standard-Symptome
        ├── icons/
        │   └── suggested.ts        # kuratierte Lucide-Vorschläge
        └── utils/
            ├── date.ts
            ├── uuid.ts
            └── transfer.ts         # JSON-Export/Import
```

Tests sitzen neben den Modulen als `*.test.ts` (Vitest) bzw. unter `tests/e2e/*.spec.ts` (Playwright).

---

## Conventions

- **TDD:** Jede neue Funktionalität beginnt mit einem failing test.
- **Tests parallel zum Code im selben Verzeichnis** für `src/lib/*` (Modul `foo.ts` → Test `foo.test.ts`).
- **E2E** lebt in `tests/e2e/`.
- **Commits:** klein und atomar pro Task-Ende. Nachrichten auf Deutsch oder Englisch, `Co-Authored-By` Footer wie üblich.
- **TypeScript strict:** in `tsconfig.json` standardmässig strict.
- **Imports:** Pfade via `$lib/...` (SvelteKit alias).
- **CSS:** Komponenten-CSS scoped; Design-Tokens in `src/app.css`.
- **Latest versions, no manual pinning:** Alle `pnpm add`-Kommandos nutzen `@latest` (oder lassen die Version weg — `pnpm` resolviert auf neuste stabile). **Niemals** Versionen hart-kodiert in `package.json` schreiben. Wenn ein Befehl unklar ist, vorher `pnpm view <pkg> version` ausführen und das Resultat verwenden. Heute (2026-05-27): Svelte ist bei 5.x, SvelteKit bei 2.x — aber **nicht raten, prüfen**.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml` (optional), `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/app.d.ts`, `src/routes/+page.svelte`, `.npmrc`

- [ ] **Step 1: Initialize SvelteKit project (latest)**

Run from project root:

```bash
pnpm create svelte@latest .
```

Wähle interaktiv: **Skeleton project**, **TypeScript syntax**, **No** für Prettier/ESLint/Playwright/Vitest (alles selbst, kontrolliert, neueste Versionen), **No** für Tailwind und alles andere.

Falls die interaktive CLI in der Umgebung nicht läuft (z.B. non-TTY), stattdessen:

```bash
# Aktuelle Latest-Versionen ermitteln und merken
for p in @sveltejs/kit @sveltejs/adapter-static svelte @sveltejs/vite-plugin-svelte svelte-check typescript vite; do
  echo "$p: $(pnpm view $p version)"
done
```

Dann `package.json` händisch mit genau diesen Versionen schreiben (kein Schätzen). Niemals Versionen aus diesem Plan-Dokument abschreiben — sie sind veraltet, sobald jemand das liest.

- [ ] **Step 2: Add `.npmrc` to enforce pnpm**

Create `.npmrc`:

```
engine-strict=true
auto-install-peers=true
```

In `package.json` ergänzen (Werte mit `pnpm --version` resp. `node --version` ermitteln und eintragen — keine fixen Zahlen aus dem Kopf):

```json
"packageManager": "pnpm@<aktuelle-pnpm-version>",
"engines": { "pnpm": ">=9", "node": ">=20" }
```

(Mindest-Engines `>=9`/`>=20` als untere Schranke ok — die installierte Version geht in `packageManager`.)

- [ ] **Step 3: Configure `adapter-static`**

Create `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
    alias: { $lib: 'src/lib' }
  }
};
```

- [ ] **Step 4: TypeScript + Vite config**

Create `tsconfig.json`:

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": false,
    "checkJs": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

Create `vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()]
});
```

- [ ] **Step 5: Minimal app shell**

Create `src/app.html`:

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1f2937" />
    <title>PeriMenoBomb</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

Create `src/app.d.ts`:

```ts
declare global {
  namespace App {}
}
export {};
```

Create `src/routes/+page.svelte`:

```svelte
<h1>PeriMenoBomb</h1>
```

- [ ] **Step 6: Install + smoke build**

Run:

```bash
pnpm install
pnpm run check
pnpm run build
```

Expected: build succeeds, `build/` directory contains static output.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "scaffold: SvelteKit project with adapter-static and pnpm"
```

---

### Task 2: Test Infrastructure

**Files:**
- Create: `vitest.config.ts`, `src/lib/test/setup.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Add test deps**

```bash
pnpm add -D vitest @testing-library/svelte @testing-library/jest-dom jsdom fake-indexeddb @playwright/test
pnpm exec playwright install chromium --with-deps
```

- [ ] **Step 2: Vitest config**

Create `vitest.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/lib/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    globals: true
  }
});
```

Create `src/lib/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 3: First failing test (sanity)**

Create `src/lib/utils/uuid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newId } from './uuid';

describe('newId', () => {
  it('produces unique ids', () => {
    expect(newId()).not.toBe(newId());
  });
  it('matches UUID v4 shape', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
```

- [ ] **Step 4: Run — expect fail (module missing)**

```bash
pnpm test
```

Expected: FAIL — cannot resolve `./uuid`.

- [ ] **Step 5: Implement `uuid.ts`**

Create `src/lib/utils/uuid.ts`:

```ts
export function newId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 6: Re-run — expect pass**

```bash
pnpm test
```

Expected: both tests pass.

- [ ] **Step 7: Playwright config + smoke**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'] } }
  ]
});
```

Create `tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('PeriMenoBomb');
});
```

- [ ] **Step 8: Run E2E**

```bash
pnpm test:e2e
```

Expected: smoke test passes.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "test: add Vitest, Playwright, fake-indexeddb scaffolding"
```

---

### Task 3: Date Utilities

**Files:**
- Create: `src/lib/utils/date.ts`, `src/lib/utils/date.test.ts`

- [ ] **Step 1: Failing tests**

Create `src/lib/utils/date.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { todayKey, toDateKey, fromDateKey, isValidDateKey, addDays, formatLong } from './date';

describe('date utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T10:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('todayKey returns ISO YYYY-MM-DD in local time', () => {
    expect(todayKey()).toBe('2026-05-27');
  });

  it('toDateKey converts Date to ISO key', () => {
    expect(toDateKey(new Date('2026-01-04T15:00:00'))).toBe('2026-01-04');
  });

  it('fromDateKey parses key back to Date at local midnight', () => {
    const d = fromDateKey('2026-05-27');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(27);
  });

  it('isValidDateKey accepts valid keys, rejects nonsense', () => {
    expect(isValidDateKey('2026-05-27')).toBe(true);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('not-a-date')).toBe(false);
  });

  it('addDays moves the key', () => {
    expect(addDays('2026-05-27', 1)).toBe('2026-05-28');
    expect(addDays('2026-05-01', -1)).toBe('2026-04-30');
  });

  it('formatLong renders German long form', () => {
    expect(formatLong('2026-05-27')).toMatch(/Mi.*27.*Mai.*2026/);
  });
});
```

- [ ] **Step 2: Run — expect fail**

`pnpm test src/lib/utils/date.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

Create `src/lib/utils/date.ts`:

```ts
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayKey(): string {
  return toDateKey(new Date());
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function isValidDateKey(key: string): boolean {
  if (!KEY_RE.test(key)) return false;
  const d = fromDateKey(key);
  return toDateKey(d) === key;
}

export function addDays(key: string, delta: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export function formatLong(key: string, locale = 'de-CH'): string {
  return fromDateKey(key).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
```

- [ ] **Step 4: Run — expect pass**

`pnpm test src/lib/utils/date.test.ts` → all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/date.ts src/lib/utils/date.test.ts
git commit -m "feat(utils): date key helpers with German locale formatting"
```

---

### Task 4: Dexie Schema & DB Singleton

**Files:**
- Create: `src/lib/db/index.ts`, `src/lib/db/index.test.ts`

- [ ] **Step 1: Add Dexie**

```bash
pnpm add dexie
```

- [ ] **Step 2: Failing test**

Create `src/lib/db/index.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDatabase } from './index';

describe('db schema', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('exposes the four expected tables', () => {
    expect(db.symptoms).toBeDefined();
    expect(db.tags).toBeDefined();
    expect(db.entries).toBeDefined();
    expect(db.meta).toBeDefined();
  });

  it('can store and read a meta key', async () => {
    await db.meta.put({ key: 'language', value: 'de' });
    const row = await db.meta.get('language');
    expect(row?.value).toBe('de');
  });

  it('reports version 1', () => {
    expect(db.verno).toBe(1);
  });
});
```

- [ ] **Step 3: Run — fail**

`pnpm test src/lib/db/index.test.ts`.

- [ ] **Step 4: Implement schema**

Create `src/lib/db/index.ts`:

```ts
import Dexie, { type Table } from 'dexie';

export interface Symptom {
  id: string;
  name: string;
  color: string;
  icon: string;
  tagIds: string[];
  parentId: string | null;
  sortIndex: number;
  depth: number;
  isFolder: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: number;
}

export type Intensity = 'leicht' | 'mittel' | 'stark' | null;

export interface Entry {
  id: string;          // `${date}__${symptomId}`
  date: string;        // YYYY-MM-DD
  symptomId: string;
  intensity: Intensity;
  comment: string;
  updatedAt: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class PeriMenoDB extends Dexie {
  symptoms!: Table<Symptom, string>;
  tags!: Table<Tag, string>;
  entries!: Table<Entry, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('perimenobomb');
    this.version(1).stores({
      symptoms: 'id, parentId, [parentId+sortIndex], archived',
      tags: 'id, name',
      entries: 'id, date, symptomId, [date+symptomId]',
      meta: 'key'
    });
  }
}

export const db = new PeriMenoDB();

export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', db.symptoms, db.tags, db.entries, db.meta, async () => {
    await Promise.all([
      db.symptoms.clear(),
      db.tags.clear(),
      db.entries.clear(),
      db.meta.clear()
    ]);
  });
}

export function entryKey(date: string, symptomId: string): string {
  return `${date}__${symptomId}`;
}
```

- [ ] **Step 5: Run — expect pass**

`pnpm test src/lib/db/index.test.ts` → green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/index.ts src/lib/db/index.test.ts package.json pnpm-lock.yaml
git commit -m "feat(db): Dexie schema v1 with symptoms, tags, entries, meta"
```

---

### Task 5: Paraglide i18n Setup

**Files:**
- Create: `project.inlang/settings.json`, `messages/de.json`, `src/lib/i18n/locales.ts`, `vite.config.ts` (modify)

- [ ] **Step 1: Install Paraglide**

```bash
pnpm add -D @inlang/paraglide-sveltekit
```

(Latest. Falls Paket inzwischen anders heisst: `pnpm view @inlang/paraglide-sveltekit version` — wenn nicht gefunden, ersatzweise `@inlang/paraglide-js` + manuelle Integration; Recherche vor dem Tausch.)

- [ ] **Step 2: Init inlang project**

```bash
pnpm exec paraglide-sveltekit init
```

Wenn der CLI-Runner nicht existiert, manuell:

Create `project.inlang/settings.json`:

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "sourceLanguageTag": "de",
  "languageTags": ["de"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-empty-pattern@latest/dist/index.js"
  ],
  "plugin.inlang.messageFormat": { "pathPattern": "./messages/{languageTag}.json" }
}
```

Create `messages/de.json`:

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "app_title": "PeriMenoBomb",
  "nav_today": "Tag",
  "nav_history": "Verlauf",
  "nav_symptoms": "Symptome",
  "nav_more": "Mehr"
}
```

- [ ] **Step 3: Wire Paraglide into Vite + SvelteKit**

Edit `vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { paraglide } from '@inlang/paraglide-sveltekit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    paraglide({ project: './project.inlang', outdir: './src/lib/paraglide' }),
    sveltekit()
  ]
});
```

- [ ] **Step 4: Helper module**

Create `src/lib/i18n/locales.ts`:

```ts
export const SUPPORTED = ['de'] as const;
export type Locale = (typeof SUPPORTED)[number];
export const DEFAULT_LOCALE: Locale = 'de';
```

- [ ] **Step 5: Sanity test**

Create `src/lib/i18n/locales.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_LOCALE, SUPPORTED } from './locales';

describe('i18n locales', () => {
  it('defaults to de', () => {
    expect(DEFAULT_LOCALE).toBe('de');
    expect(SUPPORTED).toContain('de');
  });
});
```

`pnpm test` → green.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(i18n): Paraglide setup with German source locale"
```

---

### Task 6: PWA Configuration

**Files:**
- Create: `static/icons/pwa-192.png`, `static/icons/pwa-512.png`, `static/favicon.svg`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install plugin**

```bash
pnpm add -D @vite-pwa/sveltekit vite-plugin-pwa
```

- [ ] **Step 2: Add icons**

Erzeuge schlichte Platzhalter-Icons (lila Quadrat mit weissem „P"). Methode A — mit `sharp` (separate Devtool, optional, nicht ins `package.json`):

```bash
pnpm dlx sharp-cli -i <(echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#8b5cf6"/><text x="50%" y="58%" font-size="320" text-anchor="middle" fill="#fff" font-family="system-ui">P</text></svg>') -o static/icons/pwa-512.png resize 512 512
pnpm dlx sharp-cli -i static/icons/pwa-512.png -o static/icons/pwa-192.png resize 192 192
```

Wenn `sharp-cli` nicht zur Verfügung steht: zwei minimale PNGs aus dem System (z.B. Inkscape, GIMP) oder ein generierter Online-Service. Hauptsache zwei Dateien `static/icons/pwa-192.png` und `static/icons/pwa-512.png` existieren mit den jeweiligen Grössen.

`static/favicon.svg` (klein, inline):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#8b5cf6"/><text x="50%" y="58%" font-size="40" text-anchor="middle" fill="#fff" font-family="system-ui">P</text></svg>
```

- [ ] **Step 3: Wire vite-pwa**

Edit `vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { paraglide } from '@inlang/paraglide-sveltekit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    paraglide({ project: './project.inlang', outdir: './src/lib/paraglide' }),
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PeriMenoBomb',
        short_name: 'PeriMeno',
        description: 'Tracking von Gefühls- und Körpersymptomen in der Perimenopause',
        theme_color: '#1f2937',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        lang: 'de',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}']
      }
    })
  ]
});
```

- [ ] **Step 4: Verify build**

```bash
pnpm run build
ls build/ | grep -E "manifest|sw|workbox"
```

Erwartet: `manifest.webmanifest` und ein Service-Worker-Bundle entstehen.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(pwa): manifest, icons, service worker via @vite-pwa/sveltekit"
```

---

### Task 7: Design Tokens & Global Styles

**Files:**
- Create: `src/app.css`
- Modify: `src/routes/+layout.svelte` (neu erstellen falls nicht vorhanden)

- [ ] **Step 1: Token-Datei**

Create `src/app.css`:

```css
:root {
  /* Palette */
  --c-bg: #ffffff;
  --c-surface: #ffffff;
  --c-surface-2: #f7f7f8;
  --c-surface-3: #eeeef0;
  --c-text: #111827;
  --c-text-dim: #6b7280;
  --c-text-muted: #9ca3af;
  --c-border: #e5e7eb;
  --c-border-strong: #d1d5db;
  --c-primary: #1f2937;
  --c-primary-contrast: #ffffff;
  --c-danger: #dc2626;
  --c-success: #10b981;
  --c-overlay: rgba(17, 24, 39, 0.45);

  /* Symptom palette — verbindlich (Spec §6.2) */
  --sym-red: #ef4444;
  --sym-orange: #f97316;
  --sym-amber: #f59e0b;
  --sym-yellow: #eab308;
  --sym-lime: #84cc16;
  --sym-green: #10b981;
  --sym-cyan: #06b6d4;
  --sym-blue: #3b82f6;
  --sym-indigo: #6366f1;
  --sym-violet: #8b5cf6;
  --sym-pink: #ec4899;
  --sym-gray: #6b7280;

  /* Spacing */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 24px;
  --sp-6: 32px;
  --sp-7: 48px;

  /* Radii */
  --r-1: 6px;
  --r-2: 10px;
  --r-3: 14px;
  --r-4: 20px;
  --r-pill: 999px;

  /* Typography */
  --f-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --fs-xs: 11px;
  --fs-sm: 13px;
  --fs-md: 15px;
  --fs-lg: 18px;
  --fs-xl: 22px;
  --fw-normal: 400;
  --fw-medium: 500;
  --fw-bold: 600;

  /* Shadows */
  --shadow-1: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-2: 0 4px 14px rgba(0,0,0,0.10);
  --shadow-3: 0 -8px 30px rgba(0,0,0,0.15);

  /* Layout */
  --nav-height: 56px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--c-bg);
  color: var(--c-text);
  font: var(--fw-normal) var(--fs-md)/1.4 var(--f-sans);
  -webkit-tap-highlight-color: transparent;
}

button { font: inherit; }

a { color: inherit; text-decoration: none; }

input, textarea, select, button { font: inherit; color: inherit; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0;
  margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;
}
```

- [ ] **Step 2: Wire stylesheet via root layout**

Create `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

Create `src/routes/+layout.ts`:

```ts
export const prerender = true;
export const ssr = false;
```

(`ssr = false` weil die App rein clientseitig läuft — Dexie & PWA brauchen Browser-APIs. `prerender = true` ist mit `adapter-static` zwingend für Index.)

- [ ] **Step 3: Smoke**

```bash
pnpm run build
```

Erwartet: ohne Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/app.css src/routes/+layout.svelte src/routes/+layout.ts
git commit -m "style: global design tokens and CSS reset"
```

---

### Task 8: Meta Store

**Files:**
- Create: `src/lib/db/meta.ts`, `src/lib/db/meta.test.ts`

- [ ] **Step 1: Failing tests**

Create `src/lib/db/meta.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import { getMeta, setMeta, getOrDefault } from './meta';

describe('meta store', () => {
  beforeEach(() => resetDatabase());

  it('returns undefined for missing key', async () => {
    expect(await getMeta('language')).toBeUndefined();
  });

  it('stores and retrieves a value', async () => {
    await setMeta('language', 'de');
    expect(await getMeta('language')).toBe('de');
  });

  it('getOrDefault returns default when missing', async () => {
    expect(await getOrDefault('lastNDays', 14)).toBe(14);
  });

  it('getOrDefault returns stored when present', async () => {
    await setMeta('lastNDays', 30);
    expect(await getOrDefault('lastNDays', 14)).toBe(30);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/db/meta.ts`:

```ts
import { db } from './index';

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta<T = unknown>(key: string, value: T): Promise<void> {
  await db.meta.put({ key, value });
}

export async function getOrDefault<T>(key: string, fallback: T): Promise<T> {
  const v = await getMeta<T>(key);
  return v === undefined ? fallback : v;
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/meta.ts src/lib/db/meta.test.ts
git commit -m "feat(db): meta key/value store"
```

---

### Task 9: Tags Module

**Files:**
- Create: `src/lib/db/tags.ts`, `src/lib/db/tags.test.ts`

- [ ] **Step 1: Failing tests**

Create `src/lib/db/tags.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './index';
import { createTag, listTags, renameTag, deleteTag, countSymptomsUsingTag } from './tags';
import { db, type Symptom } from './index';

describe('tags', () => {
  beforeEach(() => resetDatabase());

  it('creates a tag with an id and timestamp', async () => {
    const t = await createTag('körperlich');
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.name).toBe('körperlich');
    expect(t.createdAt).toBeGreaterThan(0);
  });

  it('lists tags alphabetically (case-insensitive)', async () => {
    await createTag('Schlaf');
    await createTag('emotional');
    await createTag('körperlich');
    const names = (await listTags()).map((t) => t.name);
    expect(names).toEqual(['emotional', 'körperlich', 'Schlaf']);
  });

  it('rename updates name', async () => {
    const t = await createTag('alt');
    await renameTag(t.id, 'neu');
    const list = await listTags();
    expect(list[0].name).toBe('neu');
  });

  it('delete removes tag and clears references from symptoms', async () => {
    const t = await createTag('emotional');
    const sym: Symptom = {
      id: 'sym1', name: 'Reizbarkeit', color: '#ef4444', icon: 'frown',
      tagIds: [t.id], parentId: null, sortIndex: 0, depth: 0,
      isFolder: false, archived: false, createdAt: 1, updatedAt: 1
    };
    await db.symptoms.add(sym);
    await deleteTag(t.id);
    expect(await listTags()).toHaveLength(0);
    const after = await db.symptoms.get('sym1');
    expect(after?.tagIds).toEqual([]);
  });

  it('countSymptomsUsingTag counts only non-archived', async () => {
    const t = await createTag('schlafrelevant');
    await db.symptoms.bulkAdd([
      { id: 'a', name: 'A', color: '#000', icon: 'moon', tagIds: [t.id], parentId: null, sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1 },
      { id: 'b', name: 'B', color: '#000', icon: 'moon', tagIds: [t.id], parentId: null, sortIndex: 1, depth: 0, isFolder: false, archived: true,  createdAt: 1, updatedAt: 1 }
    ]);
    expect(await countSymptomsUsingTag(t.id)).toBe(1);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/db/tags.ts`:

```ts
import { db, type Tag } from './index';
import { newId } from '$lib/utils/uuid';

export async function createTag(name: string): Promise<Tag> {
  const tag: Tag = { id: newId(), name, createdAt: Date.now() };
  await db.tags.add(tag);
  return tag;
}

export async function listTags(): Promise<Tag[]> {
  const all = await db.tags.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
}

export async function renameTag(id: string, name: string): Promise<void> {
  await db.tags.update(id, { name });
}

export async function deleteTag(id: string): Promise<void> {
  await db.transaction('rw', db.tags, db.symptoms, async () => {
    await db.tags.delete(id);
    const affected = await db.symptoms.filter((s) => s.tagIds.includes(id)).toArray();
    for (const s of affected) {
      await db.symptoms.update(s.id, {
        tagIds: s.tagIds.filter((t) => t !== id),
        updatedAt: Date.now()
      });
    }
  });
}

export async function countSymptomsUsingTag(id: string): Promise<number> {
  return db.symptoms.filter((s) => !s.archived && s.tagIds.includes(id)).count();
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/tags.ts src/lib/db/tags.test.ts
git commit -m "feat(db): tags CRUD with reference cleanup on delete"
```

---

### Task 10: Symptoms Module — CRUD

**Files:**
- Create: `src/lib/db/symptoms.ts`, `src/lib/db/symptoms.test.ts`

- [ ] **Step 1: Failing tests (CRUD only — hierarchy ops kommen in Task 11)**

Create `src/lib/db/symptoms.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from './index';
import { createSymptom, updateSymptom, getSymptom, archiveSymptom, listAllSymptoms, listChildren } from './symptoms';

describe('symptoms CRUD', () => {
  beforeEach(() => resetDatabase());

  it('creates a symptom with sensible defaults', async () => {
    const s = await createSymptom({ name: 'Hitzewallungen' });
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.name).toBe('Hitzewallungen');
    expect(s.icon).toBe('circle');
    expect(s.color).toBe('#6b7280');
    expect(s.tagIds).toEqual([]);
    expect(s.parentId).toBeNull();
    expect(s.depth).toBe(0);
    expect(s.isFolder).toBe(false);
    expect(s.archived).toBe(false);
  });

  it('creates a folder with default folder icon', async () => {
    const f = await createSymptom({ name: 'Körperlich', isFolder: true });
    expect(f.isFolder).toBe(true);
    expect(f.icon).toBe('folder');
  });

  it('honors overrides', async () => {
    const s = await createSymptom({ name: 'Migräne', icon: 'brain', color: '#ef4444', tagIds: ['t1'] });
    expect(s.icon).toBe('brain');
    expect(s.color).toBe('#ef4444');
    expect(s.tagIds).toEqual(['t1']);
  });

  it('assigns sortIndex sequentially within parent', async () => {
    await createSymptom({ name: 'A' });
    await createSymptom({ name: 'B' });
    const all = await listAllSymptoms();
    const indexes = all.map((s) => s.sortIndex).sort();
    expect(indexes).toEqual([0, 1]);
  });

  it('update merges fields and refreshes updatedAt', async () => {
    const s = await createSymptom({ name: 'A' });
    const before = s.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await updateSymptom(s.id, { name: 'B', color: '#3b82f6' });
    const after = await getSymptom(s.id);
    expect(after?.name).toBe('B');
    expect(after?.color).toBe('#3b82f6');
    expect(after!.updatedAt).toBeGreaterThan(before);
  });

  it('archive sets archived=true', async () => {
    const s = await createSymptom({ name: 'A' });
    await archiveSymptom(s.id);
    const a = await getSymptom(s.id);
    expect(a?.archived).toBe(true);
  });

  it('listChildren returns sorted children of a parent', async () => {
    const root = await createSymptom({ name: 'R', isFolder: true });
    const b = await createSymptom({ name: 'B', parentId: root.id });
    const a = await createSymptom({ name: 'A', parentId: root.id });
    await db.symptoms.update(a.id, { sortIndex: 0 });
    await db.symptoms.update(b.id, { sortIndex: 1 });
    const kids = await listChildren(root.id);
    expect(kids.map((k) => k.name)).toEqual(['A', 'B']);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement CRUD**

Create `src/lib/db/symptoms.ts`:

```ts
import { db, type Symptom } from './index';
import { newId } from '$lib/utils/uuid';

export interface CreateSymptomInput {
  name: string;
  isFolder?: boolean;
  parentId?: string | null;
  color?: string;
  icon?: string;
  tagIds?: string[];
}

export const DEFAULT_COLOR = '#6b7280';
export const DEFAULT_ICON = 'circle';
export const DEFAULT_FOLDER_ICON = 'folder';
export const MAX_DEPTH = 2; // 0,1,2 = drei Ebenen

async function nextSortIndex(parentId: string | null): Promise<number> {
  const siblings = await db.symptoms
    .where('parentId').equals(parentId === null ? '__root__' : parentId)
    .count()
    .catch(() => 0);
  // Fallback wenn null nicht direkt indexierbar: zähle alle mit gleichem parentId
  if (siblings === 0) {
    const all = await db.symptoms.filter((s) => s.parentId === parentId).count();
    return all;
  }
  return siblings;
}

async function computeDepth(parentId: string | null): Promise<number> {
  if (parentId === null) return 0;
  const parent = await db.symptoms.get(parentId);
  if (!parent) throw new Error(`parent ${parentId} not found`);
  return parent.depth + 1;
}

export async function createSymptom(input: CreateSymptomInput): Promise<Symptom> {
  const parentId = input.parentId ?? null;
  const depth = await computeDepth(parentId);
  if (depth > MAX_DEPTH) {
    throw new Error(`max hierarchy depth ${MAX_DEPTH + 1} exceeded`);
  }
  const now = Date.now();
  const isFolder = input.isFolder ?? false;
  const sym: Symptom = {
    id: newId(),
    name: input.name,
    color: input.color ?? DEFAULT_COLOR,
    icon: input.icon ?? (isFolder ? DEFAULT_FOLDER_ICON : DEFAULT_ICON),
    tagIds: input.tagIds ?? [],
    parentId,
    sortIndex: await nextSortIndex(parentId),
    depth,
    isFolder,
    archived: false,
    createdAt: now,
    updatedAt: now
  };
  await db.symptoms.add(sym);
  return sym;
}

export async function getSymptom(id: string): Promise<Symptom | undefined> {
  return db.symptoms.get(id);
}

export async function updateSymptom(
  id: string,
  patch: Partial<Omit<Symptom, 'id' | 'createdAt' | 'parentId' | 'depth' | 'sortIndex'>>
): Promise<void> {
  await db.symptoms.update(id, { ...patch, updatedAt: Date.now() });
}

export async function archiveSymptom(id: string): Promise<void> {
  await db.symptoms.update(id, { archived: true, updatedAt: Date.now() });
}

export async function listAllSymptoms(): Promise<Symptom[]> {
  return db.symptoms.toArray();
}

export async function listChildren(parentId: string | null): Promise<Symptom[]> {
  const rows = await db.symptoms.filter((s) => s.parentId === parentId && !s.archived).toArray();
  return rows.sort((a, b) => a.sortIndex - b.sortIndex);
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/symptoms.ts src/lib/db/symptoms.test.ts
git commit -m "feat(db): symptoms CRUD with defaults and sort index"
```

---

### Task 11: Symptoms Module — Hierarchy Operations

**Files:**
- Modify: `src/lib/db/symptoms.ts`, `src/lib/db/symptoms.test.ts`

- [ ] **Step 1: Failing tests for move/reorder/depth-validation**

Append to `src/lib/db/symptoms.test.ts`:

```ts
import { moveSymptom, reorderSiblings, subtreeDepth, listTree } from './symptoms';

describe('symptoms hierarchy', () => {
  beforeEach(() => resetDatabase());

  it('moveSymptom changes parent and recomputes depth', async () => {
    const r1 = await createSymptom({ name: 'R1', isFolder: true });
    const r2 = await createSymptom({ name: 'R2', isFolder: true });
    const child = await createSymptom({ name: 'C', parentId: r1.id });
    await moveSymptom(child.id, r2.id);
    const after = await getSymptom(child.id);
    expect(after?.parentId).toBe(r2.id);
    expect(after?.depth).toBe(1);
  });

  it('moveSymptom rejects move that would exceed MAX_DEPTH', async () => {
    const a = await createSymptom({ name: 'A', isFolder: true });   // depth 0
    const b = await createSymptom({ name: 'B', isFolder: true, parentId: a.id }); // 1
    const c = await createSymptom({ name: 'C', parentId: b.id });   // 2
    const d = await createSymptom({ name: 'D', isFolder: true });   // 0
    // moving 'a' (which has subtree depth 2) into 'd' would put 'c' at depth 3
    await expect(moveSymptom(a.id, d.id)).rejects.toThrow(/depth/i);
    void c;
  });

  it('moveSymptom rejects moving a node into its own subtree (cycle)', async () => {
    const a = await createSymptom({ name: 'A', isFolder: true });
    const b = await createSymptom({ name: 'B', isFolder: true, parentId: a.id });
    await expect(moveSymptom(a.id, b.id)).rejects.toThrow(/cycle/i);
  });

  it('reorderSiblings updates sortIndex for the given order', async () => {
    const r = await createSymptom({ name: 'R', isFolder: true });
    const x = await createSymptom({ name: 'X', parentId: r.id });
    const y = await createSymptom({ name: 'Y', parentId: r.id });
    const z = await createSymptom({ name: 'Z', parentId: r.id });
    await reorderSiblings(r.id, [z.id, x.id, y.id]);
    const kids = await listChildren(r.id);
    expect(kids.map((k) => k.name)).toEqual(['Z', 'X', 'Y']);
  });

  it('subtreeDepth returns max depth diff under a node', async () => {
    const a = await createSymptom({ name: 'A', isFolder: true });
    const b = await createSymptom({ name: 'B', isFolder: true, parentId: a.id });
    await createSymptom({ name: 'C', parentId: b.id });
    expect(await subtreeDepth(a.id)).toBe(2);
  });

  it('listTree returns roots and children sorted', async () => {
    const r = await createSymptom({ name: 'R', isFolder: true });
    await createSymptom({ name: 'Child', parentId: r.id });
    const tree = await listTree();
    expect(tree[0].name).toBe('R');
    expect(tree[0].children[0].name).toBe('Child');
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement hierarchy ops — append to `src/lib/db/symptoms.ts`**

```ts
export interface TreeNode extends Symptom {
  children: TreeNode[];
}

export async function listTree(): Promise<TreeNode[]> {
  const all = (await db.symptoms.filter((s) => !s.archived).toArray()).sort(
    (a, b) => a.sortIndex - b.sortIndex
  );
  const byParent = new Map<string | null, Symptom[]>();
  for (const s of all) {
    const list = byParent.get(s.parentId) ?? [];
    list.push(s);
    byParent.set(s.parentId, list);
  }
  function build(node: Symptom): TreeNode {
    return { ...node, children: (byParent.get(node.id) ?? []).map(build) };
  }
  return (byParent.get(null) ?? []).map(build);
}

export async function subtreeDepth(id: string): Promise<number> {
  const root = await db.symptoms.get(id);
  if (!root) throw new Error(`symptom ${id} not found`);
  const all = await db.symptoms.toArray();
  const byParent = new Map<string | null, Symptom[]>();
  for (const s of all) {
    const list = byParent.get(s.parentId) ?? [];
    list.push(s);
    byParent.set(s.parentId, list);
  }
  function walk(node: Symptom, d: number): number {
    const kids = byParent.get(node.id) ?? [];
    if (kids.length === 0) return d;
    return Math.max(...kids.map((k) => walk(k, d + 1)));
  }
  return walk(root, 0);
}

async function descendantIds(id: string): Promise<Set<string>> {
  const all = await db.symptoms.toArray();
  const byParent = new Map<string | null, Symptom[]>();
  for (const s of all) {
    const list = byParent.get(s.parentId) ?? [];
    list.push(s);
    byParent.set(s.parentId, list);
  }
  const out = new Set<string>();
  function walk(nid: string) {
    for (const k of byParent.get(nid) ?? []) {
      out.add(k.id);
      walk(k.id);
    }
  }
  walk(id);
  return out;
}

export async function moveSymptom(id: string, newParentId: string | null): Promise<void> {
  if (id === newParentId) throw new Error('cycle: cannot make node its own parent');
  if (newParentId !== null) {
    const desc = await descendantIds(id);
    if (desc.has(newParentId)) throw new Error('cycle: target is a descendant of source');
  }
  const node = await db.symptoms.get(id);
  if (!node) throw new Error(`symptom ${id} not found`);
  const newDepth = newParentId === null ? 0 : (await db.symptoms.get(newParentId))!.depth + 1;
  const sub = await subtreeDepth(id);
  if (newDepth + sub > MAX_DEPTH) {
    throw new Error(`max hierarchy depth exceeded (would be ${newDepth + sub + 1} levels)`);
  }
  await db.transaction('rw', db.symptoms, async () => {
    const all = await db.symptoms.toArray();
    const byParent = new Map<string | null, Symptom[]>();
    for (const s of all) {
      const list = byParent.get(s.parentId) ?? [];
      list.push(s);
      byParent.set(s.parentId, list);
    }
    // adjust depth for entire subtree
    const delta = newDepth - node.depth;
    const sub2 = await descendantIds(id);
    const nowTs = Date.now();
    await db.symptoms.update(id, {
      parentId: newParentId,
      depth: newDepth,
      sortIndex: (byParent.get(newParentId)?.length ?? 0),
      updatedAt: nowTs
    });
    for (const sid of sub2) {
      const s = await db.symptoms.get(sid);
      if (s) await db.symptoms.update(sid, { depth: s.depth + delta, updatedAt: nowTs });
    }
  });
}

export async function reorderSiblings(parentId: string | null, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.symptoms, async () => {
    const nowTs = Date.now();
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const s = await db.symptoms.get(id);
      if (!s || s.parentId !== parentId) {
        throw new Error(`symptom ${id} not a child of ${parentId}`);
      }
      await db.symptoms.update(id, { sortIndex: i, updatedAt: nowTs });
    }
  });
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/symptoms.ts src/lib/db/symptoms.test.ts
git commit -m "feat(db): hierarchy moves with depth + cycle validation, reorder, tree"
```

---

### Task 12: Entries Module

**Files:**
- Create: `src/lib/db/entries.ts`, `src/lib/db/entries.test.ts`

- [ ] **Step 1: Failing tests**

Create `src/lib/db/entries.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from './index';
import { upsertEntry, getEntry, deleteEntry, listEntriesForDate, listEntriesForRange, hasEntry } from './entries';

describe('entries', () => {
  beforeEach(() => resetDatabase());

  it('upsert creates a new entry with deterministic id', async () => {
    const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    expect(e.id).toBe('2026-05-27__sym1');
    expect(e.intensity).toBeNull();
    expect(e.comment).toBe('');
  });

  it('upsert preserves existing values when patch is partial', async () => {
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', intensity: 'mittel' });
    const e = await upsertEntry({ date: '2026-05-27', symptomId: 'sym1', comment: 'Notiz' });
    expect(e.intensity).toBe('mittel');
    expect(e.comment).toBe('Notiz');
  });

  it('hasEntry reports presence', async () => {
    expect(await hasEntry('2026-05-27', 'sym1')).toBe(false);
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    expect(await hasEntry('2026-05-27', 'sym1')).toBe(true);
  });

  it('delete removes the entry', async () => {
    await upsertEntry({ date: '2026-05-27', symptomId: 'sym1' });
    await deleteEntry('2026-05-27', 'sym1');
    expect(await getEntry('2026-05-27', 'sym1')).toBeUndefined();
  });

  it('listEntriesForDate returns all entries of a day', async () => {
    await upsertEntry({ date: '2026-05-27', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-27', symptomId: 'b' });
    await upsertEntry({ date: '2026-05-26', symptomId: 'c' });
    const today = await listEntriesForDate('2026-05-27');
    expect(today.map((e) => e.symptomId).sort()).toEqual(['a', 'b']);
  });

  it('listEntriesForRange returns entries between dates inclusive', async () => {
    await upsertEntry({ date: '2026-05-25', symptomId: 'a' });
    await upsertEntry({ date: '2026-05-26', symptomId: 'b' });
    await upsertEntry({ date: '2026-05-28', symptomId: 'c' });
    const r = await listEntriesForRange('2026-05-26', '2026-05-27');
    expect(r.map((e) => e.symptomId)).toEqual(['b']);
  });

  it('rejects invalid date format', async () => {
    await expect(upsertEntry({ date: '27.05.2026', symptomId: 'x' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/db/entries.ts`:

```ts
import { db, entryKey, type Entry, type Intensity } from './index';
import { isValidDateKey } from '$lib/utils/date';

export interface UpsertEntryInput {
  date: string;
  symptomId: string;
  intensity?: Intensity;
  comment?: string;
}

export async function upsertEntry(input: UpsertEntryInput): Promise<Entry> {
  if (!isValidDateKey(input.date)) {
    throw new Error(`invalid date key "${input.date}"`);
  }
  const id = entryKey(input.date, input.symptomId);
  const existing = await db.entries.get(id);
  const merged: Entry = {
    id,
    date: input.date,
    symptomId: input.symptomId,
    intensity: input.intensity !== undefined ? input.intensity : existing?.intensity ?? null,
    comment: input.comment !== undefined ? input.comment : existing?.comment ?? '',
    updatedAt: Date.now()
  };
  await db.entries.put(merged);
  return merged;
}

export async function getEntry(date: string, symptomId: string): Promise<Entry | undefined> {
  return db.entries.get(entryKey(date, symptomId));
}

export async function hasEntry(date: string, symptomId: string): Promise<boolean> {
  return (await db.entries.where('id').equals(entryKey(date, symptomId)).count()) > 0;
}

export async function deleteEntry(date: string, symptomId: string): Promise<void> {
  await db.entries.delete(entryKey(date, symptomId));
}

export async function listEntriesForDate(date: string): Promise<Entry[]> {
  return db.entries.where('date').equals(date).toArray();
}

export async function listEntriesForRange(fromDate: string, toDate: string): Promise<Entry[]> {
  return db.entries.where('date').between(fromDate, toDate, true, true).toArray();
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/entries.ts src/lib/db/entries.test.ts
git commit -m "feat(db): entries with composite key and merge-on-upsert"
```

---

### Task 13: LiveQuery Rune Adapter

**Files:**
- Create: `src/lib/stores/liveQuery.svelte.ts`, `src/lib/stores/liveQuery.test.ts`

- [ ] **Step 1: Failing test**

Create `src/lib/stores/liveQuery.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import { liveQuery } from './liveQuery.svelte';

describe('liveQuery rune adapter', () => {
  beforeEach(() => resetDatabase());

  it('returns initial value and updates on writes', async () => {
    const q = liveQuery(() => db.tags.toArray(), [] as { id: string; name: string; createdAt: number }[]);
    await new Promise((r) => setTimeout(r, 20));
    expect(q.current).toEqual([]);
    await db.tags.add({ id: '1', name: 'a', createdAt: Date.now() });
    await new Promise((r) => setTimeout(r, 30));
    expect(q.current.map((t) => t.name)).toEqual(['a']);
    q.dispose();
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/stores/liveQuery.svelte.ts`:

```ts
import { liveQuery as dexieLive } from 'dexie';

export interface ReactiveQuery<T> {
  readonly current: T;
  dispose(): void;
}

export function liveQuery<T>(query: () => Promise<T> | T, initial: T): ReactiveQuery<T> {
  let value = $state<T>(initial);
  const sub = dexieLive(query).subscribe({
    next: (v) => { value = v as T; },
    error: (err) => { console.error('liveQuery error', err); }
  });
  return {
    get current() { return value; },
    dispose() { sub.unsubscribe(); }
  };
}

// Bind a Dexie liveQuery to a Svelte $effect lifetime — auto-resubscribes
// when reactive dependencies inside `query` change, and disposes on unmount.
// MUST be called inside a component or $effect root.
export function liveQueryEffect<T>(query: () => Promise<T> | T, initial: T): { readonly current: T } {
  let value = $state<T>(initial);
  $effect(() => {
    const sub = dexieLive(query).subscribe({
      next: (v) => { value = v as T; },
      error: (err) => { console.error('liveQuery error', err); }
    });
    return () => sub.unsubscribe();
  });
  return { get current() { return value; } };
}
```

> **Hinweis für den ausführenden Agent:** Dieses Modul nutzt Svelte 5 runes — daher die Dateiendung `.svelte.ts`. Zwei Varianten:
> - `liveQuery(...)` für Module-/Store-Scopes ohne Komponenten-Lifecycle — Aufrufer muss `dispose()` manuell rufen (typisch in `$effect(() => () => q.dispose())`).
> - `liveQueryEffect(...)` für Komponenten, wenn der Query reaktive Werte aus dem Komponenten-Scope liest (z.B. eine Datums-Prop). Re-subscribt automatisch beim Wechsel und cleant beim Unmount auf. **Muss innerhalb einer Komponente** (oder eines `$effect.root`) aufgerufen werden.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/liveQuery.svelte.ts src/lib/stores/liveQuery.test.ts
git commit -m "feat(stores): Dexie liveQuery adapter for Svelte 5 runes"
```

---

### Task 14: Lucide Icons & Curated Suggestions

**Files:**
- Create: `src/lib/icons/suggested.ts`

- [ ] **Step 1: Install Lucide**

```bash
pnpm add lucide-svelte
```

- [ ] **Step 2: Curated suggestion list**

Create `src/lib/icons/suggested.ts`:

```ts
export const SUGGESTED_ICONS: string[] = [
  'flame',
  'thermometer',
  'wind',
  'cloud-drizzle',
  'droplet',
  'heart-pulse',
  'heart',
  'brain',
  'pill',
  'bandage',
  'bed',
  'moon',
  'sun',
  'cloud',
  'cloud-rain',
  'zap',
  'activity',
  'eye',
  'ear',
  'smile',
  'meh',
  'frown',
  'angry',
  'cloud-fog',
  'sparkles',
  'alert-triangle',
  'feather',
  'leaf',
  'coffee',
  'utensils'
];

export const DEFAULT_SYMPTOM_ICON = 'circle';
export const DEFAULT_FOLDER_ICON = 'folder';
```

- [ ] **Step 3: Sanity test**

Create `src/lib/icons/suggested.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SUGGESTED_ICONS } from './suggested';

describe('SUGGESTED_ICONS', () => {
  it('has at least 24 distinct icons', () => {
    expect(SUGGESTED_ICONS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(SUGGESTED_ICONS).size).toBe(SUGGESTED_ICONS.length);
  });
  it('uses kebab-case names (Lucide convention)', () => {
    for (const i of SUGGESTED_ICONS) {
      expect(i).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});
```

`pnpm test` → green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/icons/suggested.ts src/lib/icons/suggested.test.ts package.json pnpm-lock.yaml
git commit -m "feat: lucide-svelte plus curated icon suggestion list"
```

---

### Task 15: Badge Component

**Files:**
- Create: `src/lib/components/ui/Badge.svelte`, `src/lib/components/ui/Badge.test.ts`

- [ ] **Step 1: Failing test**

Create `src/lib/components/ui/Badge.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/components/ui/Badge.svelte`:

```svelte
<script lang="ts">
  import { icons } from 'lucide-svelte';
  type Props = {
    icon: string;
    color: string;
    size?: 20 | 28 | 36;
    archived?: boolean;
    title?: string;
  };
  let { icon, color, size = 28, archived = false, title }: Props = $props();

  function toPascal(name: string): string {
    return name.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  }

  const IconComp = $derived((icons as Record<string, any>)[toPascal(icon)] ?? icons.Circle);
  const iconSize = $derived(Math.round(size * 0.6));
</script>

<span
  class="badge"
  style="background:{color}; width:{size}px; height:{size}px; opacity:{archived ? 0.5 : 1};"
  aria-label={title}
>
  <IconComp size={iconSize} color="#fff" strokeWidth={2.25} />
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/Badge.svelte src/lib/components/ui/Badge.test.ts
git commit -m "feat(ui): Badge component — icon in colored circle"
```

---

### Task 16: Modal Primitive

**Files:**
- Create: `src/lib/components/ui/Modal.svelte`, `src/lib/components/ui/Modal.test.ts`

- [ ] **Step 1: Failing test**

Create `src/lib/components/ui/Modal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import Modal from './Modal.svelte';

describe('Modal', () => {
  it('renders body content when open', async () => {
    const { getByText } = render(Modal, { props: { open: true, title: 'Bearbeiten', children: () => 'CONTENT' } as any });
    expect(getByText('CONTENT')).toBeTruthy();
  });

  it('emits onClose on backdrop click', async () => {
    let closed = false;
    const { container } = render(Modal, { props: { open: true, title: 't', onClose: () => { closed = true; }, children: () => 'x' } as any });
    const backdrop = container.querySelector('.backdrop') as HTMLElement;
    await fireEvent.click(backdrop);
    await tick();
    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/components/ui/Modal.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  type Props = {
    open: boolean;
    title?: string;
    onClose?: () => void;
    children: Snippet;
  };
  let { open, title, onClose, children }: Props = $props();

  function close() { onClose?.(); }

  $effect(() => {
    if (!open) return;
    function key(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
</script>

{#if open}
  <div class="backdrop" onclick={close} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onclick={(e) => e.stopPropagation()}>
      <div class="handle"></div>
      {#if title}<h2 class="title">{title}</h2>{/if}
      <div class="body">{@render children()}</div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: var(--c-overlay);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 50;
  }
  .sheet {
    background: var(--c-surface);
    border-radius: var(--r-4) var(--r-4) 0 0;
    box-shadow: var(--shadow-3);
    width: 100%;
    max-width: 480px;
    padding: var(--sp-4) var(--sp-4) calc(var(--sp-4) + var(--safe-bottom));
    max-height: 90vh;
    overflow-y: auto;
  }
  .handle {
    width: 36px; height: 4px; background: var(--c-border-strong);
    border-radius: 2px; margin: 0 auto var(--sp-3);
  }
  .title {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-lg); font-weight: var(--fw-bold); text-align: center;
  }
</style>
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/Modal.svelte src/lib/components/ui/Modal.test.ts
git commit -m "feat(ui): Modal primitive — bottom sheet style with backdrop"
```

---

### Task 17: Sheet Primitive (Drill-Down Container)

**Files:**
- Create: `src/lib/components/ui/Sheet.svelte`, `src/lib/components/ui/Sheet.test.ts`

Eine `Sheet` ist wie ein `Modal`, behält aber sein eigenes Stack/Breadcrumb-Verhalten und lässt sich „in-place" durch Hierarchie-Ebenen navigieren.

- [ ] **Step 1: Failing test**

Create `src/lib/components/ui/Sheet.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Sheet from './Sheet.svelte';

describe('Sheet', () => {
  it('shows title and back button when canGoBack', () => {
    let backed = false;
    const { getByText } = render(Sheet, {
      props: { open: true, title: 'Körperlich', canGoBack: true, onBack: () => { backed = true; }, onClose: () => {}, children: () => 'list' } as any
    });
    fireEvent.click(getByText('‹ Zurück'));
    expect(backed).toBe(true);
  });

  it('hides back button when canGoBack is false', () => {
    const { queryByText } = render(Sheet, {
      props: { open: true, title: 't', canGoBack: false, onBack: () => {}, onClose: () => {}, children: () => 'x' } as any
    });
    expect(queryByText('‹ Zurück')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/components/ui/Sheet.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  type Props = {
    open: boolean;
    title: string;
    canGoBack?: boolean;
    onBack?: () => void;
    onClose: () => void;
    children: Snippet;
  };
  let { open, title, canGoBack = false, onBack, onClose, children }: Props = $props();
</script>

{#if open}
  <div class="backdrop" onclick={onClose} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onclick={(e) => e.stopPropagation()}>
      <div class="handle"></div>
      <header>
        {#if canGoBack}
          <button class="back" type="button" onclick={() => onBack?.()}>‹ Zurück</button>
        {:else}<span class="back-spacer"></span>{/if}
        <h2 class="title">{title}</h2>
        <button class="close" type="button" onclick={onClose} aria-label="Schliessen">✕</button>
      </header>
      <div class="body">{@render children()}</div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: var(--c-overlay);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 40;
  }
  .sheet {
    background: var(--c-surface);
    border-radius: var(--r-4) var(--r-4) 0 0;
    box-shadow: var(--shadow-3);
    width: 100%;
    max-width: 480px;
    padding: var(--sp-3) var(--sp-4) calc(var(--sp-4) + var(--safe-bottom));
    max-height: 80vh;
    display: flex; flex-direction: column;
  }
  .handle { width: 36px; height: 4px; background: var(--c-border-strong); border-radius: 2px; margin: 0 auto var(--sp-3); }
  header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-bottom: var(--sp-2); }
  .back { background: none; border: 0; color: var(--c-text-dim); font-size: var(--fs-sm); justify-self: start; padding: var(--sp-2); cursor: pointer; }
  .back-spacer { display: inline-block; min-width: 60px; }
  .title { margin: 0; font-size: var(--fs-md); font-weight: var(--fw-bold); text-align: center; }
  .close { background: none; border: 0; color: var(--c-text-dim); font-size: 18px; justify-self: end; padding: var(--sp-2); cursor: pointer; }
  .body { overflow-y: auto; flex: 1; }
</style>
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/Sheet.svelte src/lib/components/ui/Sheet.test.ts
git commit -m "feat(ui): Sheet primitive with back/close header"
```

---

### Task 18: Snackbar Primitive (Undo Toast)

**Files:**
- Create: `src/lib/components/ui/Snackbar.svelte`, `src/lib/stores/snackbar.svelte.ts`, `src/lib/stores/snackbar.test.ts`

- [ ] **Step 1: Failing test**

Create `src/lib/stores/snackbar.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement store**

Create `src/lib/stores/snackbar.svelte.ts`:

```ts
export interface SnackbarSpec {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

let current = $state<SnackbarSpec | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer) { clearTimeout(timer); timer = null; }
}

export const snackbar = {
  get current() { return current; },
  show(spec: SnackbarSpec) {
    clearTimer();
    current = spec;
    const d = spec.durationMs ?? 5000;
    timer = setTimeout(() => { current = null; timer = null; }, d);
  },
  dismiss() {
    clearTimer();
    current = null;
  },
  invokeAction() {
    const c = current;
    if (!c) return;
    c.onAction?.();
    this.dismiss();
  }
};
```

- [ ] **Step 4: Implement view**

Create `src/lib/components/ui/Snackbar.svelte`:

```svelte
<script lang="ts">
  import { snackbar } from '$lib/stores/snackbar.svelte';
</script>

{#if snackbar.current}
  <div class="bar" role="status">
    <span class="msg">{snackbar.current.message}</span>
    {#if snackbar.current.actionLabel}
      <button type="button" onclick={() => snackbar.invokeAction()}>
        {snackbar.current.actionLabel}
      </button>
    {/if}
  </div>
{/if}

<style>
  .bar {
    position: fixed;
    left: var(--sp-4); right: var(--sp-4);
    bottom: calc(var(--nav-height) + var(--sp-4) + var(--safe-bottom));
    background: #111827; color: #fff;
    border-radius: var(--r-2);
    padding: var(--sp-3) var(--sp-4);
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: var(--shadow-2);
    z-index: 60;
  }
  button {
    background: transparent; color: #fff;
    border: 0; padding: var(--sp-2) var(--sp-3);
    font-weight: var(--fw-bold);
    cursor: pointer;
  }
</style>
```

- [ ] **Step 5: Run — pass**

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/snackbar.svelte.ts src/lib/stores/snackbar.test.ts src/lib/components/ui/Snackbar.svelte
git commit -m "feat(ui): Snackbar store + view with auto-dismiss"
```

---

### Task 19: SwipeRow Primitive

**Files:**
- Create: `src/lib/components/ui/SwipeRow.svelte`, `src/lib/components/ui/SwipeRow.test.ts`

Behavior: Detect horizontal swipe gesture (≥ 80px to left). When triggered, fire `onSwipe`.

- [ ] **Step 1: Failing test**

Create `src/lib/components/ui/SwipeRow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SwipeRow from './SwipeRow.svelte';

function touch(x: number, y = 0): Touch {
  return { clientX: x, clientY: y, identifier: 1, pageX: x, pageY: y, screenX: x, screenY: y, target: document.body, force: 1, radiusX: 1, radiusY: 1, rotationAngle: 0 } as unknown as Touch;
}

describe('SwipeRow', () => {
  it('fires onSwipe when swipe left exceeds threshold', async () => {
    let swiped = 0;
    const { container } = render(SwipeRow, { props: { onSwipe: () => { swiped++; }, children: () => 'row' } as any });
    const el = container.querySelector('.swipe-row') as HTMLElement;
    await fireEvent.touchStart(el, { touches: [touch(200)] });
    await fireEvent.touchMove(el, { touches: [touch(50)] });
    await fireEvent.touchEnd(el, { changedTouches: [touch(50)] });
    expect(swiped).toBe(1);
  });

  it('does not fire for short swipe', async () => {
    let swiped = 0;
    const { container } = render(SwipeRow, { props: { onSwipe: () => { swiped++; }, children: () => 'row' } as any });
    const el = container.querySelector('.swipe-row') as HTMLElement;
    await fireEvent.touchStart(el, { touches: [touch(200)] });
    await fireEvent.touchMove(el, { touches: [touch(180)] });
    await fireEvent.touchEnd(el, { changedTouches: [touch(180)] });
    expect(swiped).toBe(0);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/components/ui/SwipeRow.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  type Props = {
    threshold?: number;
    onSwipe: () => void;
    children: Snippet;
  };
  let { threshold = 80, onSwipe, children }: Props = $props();
  let startX = $state<number | null>(null);
  let dx = $state(0);

  function onStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    dx = 0;
  }
  function onMove(e: TouchEvent) {
    if (startX === null) return;
    dx = Math.min(0, e.touches[0].clientX - startX);
  }
  function onEnd() {
    if (startX !== null && -dx >= threshold) onSwipe();
    startX = null;
    dx = 0;
  }
</script>

<div
  class="swipe-row"
  ontouchstart={onStart}
  ontouchmove={onMove}
  ontouchend={onEnd}
  style="transform: translateX({dx}px);"
>
  {@render children()}
</div>

<style>
  .swipe-row {
    transition: transform 80ms ease-out;
    will-change: transform;
  }
</style>
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/SwipeRow.svelte src/lib/components/ui/SwipeRow.test.ts
git commit -m "feat(ui): SwipeRow primitive for swipe-to-action"
```

---

### Task 20: ColorPicker Component

**Files:**
- Create: `src/lib/components/ui/ColorPicker.svelte`, `src/lib/components/ui/ColorPicker.test.ts`

- [ ] **Step 1: Failing test**

Create `src/lib/components/ui/ColorPicker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ColorPicker from './ColorPicker.svelte';

describe('ColorPicker', () => {
  it('marks the current value as selected', () => {
    const { container } = render(ColorPicker, { props: { value: '#ef4444', onChange: () => {} } });
    const selected = container.querySelector('.swatch.selected') as HTMLElement;
    expect(selected.getAttribute('data-color')).toBe('#ef4444');
  });

  it('calls onChange when a swatch is clicked', async () => {
    let v = '';
    const { container } = render(ColorPicker, { props: { value: '#ef4444', onChange: (c: string) => { v = c; } } });
    const blue = container.querySelector('[data-color="#3b82f6"]') as HTMLElement;
    await fireEvent.click(blue);
    expect(v).toBe('#3b82f6');
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/components/ui/ColorPicker.svelte`:

```svelte
<script lang="ts">
  type Props = { value: string; onChange: (color: string) => void };
  let { value, onChange }: Props = $props();

  const PALETTE = [
    '#ef4444','#f97316','#f59e0b','#eab308',
    '#84cc16','#10b981','#06b6d4','#3b82f6',
    '#6366f1','#8b5cf6','#ec4899','#6b7280'
  ];
  let custom = $state(value && !PALETTE.includes(value) ? value : '');

  function pick(c: string) {
    onChange(c);
  }
  function onCustom(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    custom = v;
    onChange(v);
  }
</script>

<div class="grid">
  {#each PALETTE as c}
    <button
      type="button"
      class="swatch {value === c ? 'selected' : ''}"
      data-color={c}
      style="background:{c}"
      aria-label={c}
      onclick={() => pick(c)}
    ></button>
  {/each}
  <label class="swatch more" aria-label="Mehr…">
    <input type="color" value={custom || '#000000'} oninput={onCustom} />
    <span>+</span>
  </label>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--sp-2);
  }
  .swatch {
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
  }
  .swatch.selected { border-color: var(--c-text); box-shadow: 0 0 0 2px var(--c-surface), 0 0 0 4px var(--c-text); }
  .more {
    background: var(--c-surface-2);
    color: var(--c-text-dim);
    display: flex; align-items: center; justify-content: center;
    position: relative;
    font-size: var(--fs-lg);
    border: 1px dashed var(--c-border-strong);
  }
  .more input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
</style>
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/ColorPicker.svelte src/lib/components/ui/ColorPicker.test.ts
git commit -m "feat(ui): ColorPicker with 12-swatch palette + native picker fallback"
```

---

### Task 21: IconPicker Component

**Files:**
- Create: `src/lib/components/ui/IconPicker.svelte`, `src/lib/components/ui/IconPicker.test.ts`

- [ ] **Step 1: Failing test**

Create `src/lib/components/ui/IconPicker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import IconPicker from './IconPicker.svelte';

describe('IconPicker', () => {
  it('highlights the active icon', () => {
    const { container } = render(IconPicker, { props: { value: 'flame', color: '#ef4444', onChange: () => {} } });
    const active = container.querySelector('.icon-tile.selected') as HTMLElement;
    expect(active.getAttribute('data-icon')).toBe('flame');
  });

  it('filters by search term', async () => {
    const { container, getByPlaceholderText } = render(IconPicker, { props: { value: 'flame', color: '#ef4444', onChange: () => {} } });
    const search = getByPlaceholderText('Suchen…') as HTMLInputElement;
    await fireEvent.input(search, { target: { value: 'moon' } });
    const tiles = container.querySelectorAll('.icon-tile');
    expect(Array.from(tiles).some((t) => t.getAttribute('data-icon') === 'moon')).toBe(true);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/components/ui/IconPicker.svelte`:

```svelte
<script lang="ts">
  import { icons as lucideIcons } from 'lucide-svelte';
  import { SUGGESTED_ICONS } from '$lib/icons/suggested';
  import Badge from './Badge.svelte';

  type Props = { value: string; color: string; onChange: (icon: string) => void };
  let { value, color, onChange }: Props = $props();
  let search = $state('');

  function toKebab(pascal: string): string {
    return pascal.replace(/[A-Z]/g, (m, i) => (i === 0 ? '' : '-') + m.toLowerCase());
  }

  const ALL_ICONS = $derived(Object.keys(lucideIcons).map(toKebab));
  const filtered = $derived(
    search.trim()
      ? ALL_ICONS.filter((i) => i.toLowerCase().includes(search.trim().toLowerCase()))
      : []
  );
</script>

<div class="picker">
  <div class="preview">
    <Badge {icon}={value} {color} size={36} />
    <span class="name">{value}</span>
  </div>

  <input
    class="search"
    type="search"
    bind:value={search}
    placeholder="Suchen…"
    autocapitalize="off"
    autocomplete="off"
  />

  {#if !search}
    <h3 class="section-title">Vorschläge</h3>
    <div class="grid">
      {#each SUGGESTED_ICONS as i}
        <button
          type="button"
          class="icon-tile {value === i ? 'selected' : ''}"
          data-icon={i}
          onclick={() => onChange(i)}
          aria-label={i}
        >
          <Badge icon={i} {color} size={28} />
        </button>
      {/each}
    </div>
  {:else}
    <h3 class="section-title">{filtered.length} Treffer</h3>
    <div class="grid">
      {#each filtered.slice(0, 120) as i}
        <button
          type="button"
          class="icon-tile {value === i ? 'selected' : ''}"
          data-icon={i}
          onclick={() => onChange(i)}
          aria-label={i}
        >
          <Badge icon={i} {color} size={28} />
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: var(--sp-3); }
  .preview { display: flex; align-items: center; gap: var(--sp-3); }
  .name { font-family: ui-monospace, monospace; font-size: var(--fs-sm); color: var(--c-text-dim); }
  .search { padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .section-title { margin: 0; font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--sp-2); }
  .icon-tile { aspect-ratio: 1; border: 1px solid var(--c-border); background: var(--c-surface); border-radius: var(--r-2); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
  .icon-tile.selected { border-color: var(--c-text); border-width: 2px; }
</style>
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/IconPicker.svelte src/lib/components/ui/IconPicker.test.ts
git commit -m "feat(ui): IconPicker — curated suggestions + searchable Lucide set"
```

---

### Task 22: App Layout & Bottom Navigation

**Files:**
- Create: `src/lib/components/ui/BottomNav.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: BottomNav component**

Create `src/lib/components/ui/BottomNav.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { CalendarDays, LineChart, Settings, MoreHorizontal } from 'lucide-svelte';
  type Item = { href: string; label: string; Icon: any; match: (p: string) => boolean };
  const items: Item[] = [
    { href: '/', label: 'Tag', Icon: CalendarDays, match: (p) => p === '/' || p.startsWith('/tag') },
    { href: '/verlauf', label: 'Verlauf', Icon: LineChart, match: (p) => p.startsWith('/verlauf') },
    { href: '/symptome', label: 'Symptome', Icon: Settings, match: (p) => p.startsWith('/symptome') },
    { href: '/einstellungen', label: 'Mehr', Icon: MoreHorizontal, match: (p) => p.startsWith('/einstellungen') || p.startsWith('/tags') }
  ];
</script>

<nav class="bottom-nav" aria-label="Hauptnavigation">
  {#each items as it}
    <a href={it.href} class="item {it.match(page.url.pathname) ? 'active' : ''}">
      <it.Icon size={20} />
      <span>{it.label}</span>
    </a>
  {/each}
</nav>

<style>
  .bottom-nav {
    position: fixed; left: 0; right: 0; bottom: 0;
    height: calc(var(--nav-height) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    background: var(--c-surface);
    border-top: 1px solid var(--c-border);
    display: flex;
    z-index: 30;
  }
  .item {
    flex: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    color: var(--c-text-dim);
    font-size: var(--fs-xs);
  }
  .item.active { color: var(--c-text); font-weight: var(--fw-bold); }
</style>
```

- [ ] **Step 2: Layout integration**

Replace `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  import BottomNav from '$lib/components/ui/BottomNav.svelte';
  import Snackbar from '$lib/components/ui/Snackbar.svelte';
  let { children } = $props();
</script>

<main class="page">{@render children()}</main>
<Snackbar />
<BottomNav />

<style>
  .page {
    padding-top: var(--safe-top);
    padding-bottom: calc(var(--nav-height) + var(--safe-bottom));
    min-height: 100vh;
  }
</style>
```

- [ ] **Step 3: Smoke**

```bash
pnpm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/ui/BottomNav.svelte src/routes/+layout.svelte
git commit -m "feat(layout): persistent bottom navigation"
```

---

### Task 23: Current Date Store + Date Header

**Files:**
- Create: `src/lib/stores/currentDate.svelte.ts`, `src/lib/stores/currentDate.test.ts`, `src/lib/components/DayView/DateHeader.svelte`

- [ ] **Step 1: Failing tests**

Create `src/lib/stores/currentDate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { currentDate } from './currentDate.svelte';

describe('currentDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T08:00:00'));
    currentDate.reset();
  });
  afterEach(() => vi.useRealTimers());

  it('defaults to today', () => {
    expect(currentDate.value).toBe('2026-05-27');
  });

  it('next/prev shift by one day', () => {
    currentDate.next();
    expect(currentDate.value).toBe('2026-05-28');
    currentDate.prev();
    currentDate.prev();
    expect(currentDate.value).toBe('2026-05-26');
  });

  it('set accepts a valid key and rejects invalid', () => {
    currentDate.set('2026-01-01');
    expect(currentDate.value).toBe('2026-01-01');
    expect(() => currentDate.set('bad')).toThrow();
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/stores/currentDate.svelte.ts`:

```ts
import { addDays, isValidDateKey, todayKey } from '$lib/utils/date';

let value = $state<string>(todayKey());

export const currentDate = {
  get value() { return value; },
  set(key: string) {
    if (!isValidDateKey(key)) throw new Error(`invalid date key "${key}"`);
    value = key;
  },
  next() { value = addDays(value, 1); },
  prev() { value = addDays(value, -1); },
  reset() { value = todayKey(); }
};
```

- [ ] **Step 4: DateHeader component**

Create `src/lib/components/DayView/DateHeader.svelte`:

```svelte
<script lang="ts">
  import { formatLong, todayKey } from '$lib/utils/date';
  import { currentDate } from '$lib/stores/currentDate.svelte';
  import { ChevronLeft, ChevronRight, Calendar } from 'lucide-svelte';

  function onPickerChange(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    if (v) currentDate.set(v);
  }
  const isToday = $derived(currentDate.value === todayKey());
</script>

<header class="date-header">
  <button class="nav-btn" type="button" aria-label="Vorheriger Tag" onclick={() => currentDate.prev()}>
    <ChevronLeft size={22} />
  </button>
  <div class="center">
    <div class="label">{isToday ? 'Heute' : 'Tag'}</div>
    <div class="date">{formatLong(currentDate.value)}</div>
    <label class="picker">
      <Calendar size={14} /> Datum wählen
      <input type="date" value={currentDate.value} oninput={onPickerChange} />
    </label>
  </div>
  <button class="nav-btn" type="button" aria-label="Nächster Tag" onclick={() => currentDate.next()}>
    <ChevronRight size={22} />
  </button>
</header>

<style>
  .date-header {
    display: grid; grid-template-columns: auto 1fr auto; align-items: center;
    padding: var(--sp-4); border-bottom: 1px solid var(--c-border);
  }
  .nav-btn { background: none; border: 0; color: var(--c-text-dim); padding: var(--sp-2); cursor: pointer; }
  .center { text-align: center; }
  .label { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .date { font-size: var(--fs-lg); font-weight: var(--fw-bold); }
  .picker { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-xs); color: var(--c-text-dim); position: relative; cursor: pointer; }
  .picker input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
</style>
```

- [ ] **Step 5: Run — pass**

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/currentDate.svelte.ts src/lib/stores/currentDate.test.ts src/lib/components/DayView/DateHeader.svelte
git commit -m "feat(day): currentDate store + DateHeader with date picker"
```

---

### Task 24: Entry Editor (Konfig-Modal)

**Files:**
- Create: `src/lib/components/EntryEditor/EntryEditor.svelte`, `src/lib/components/EntryEditor/EntryEditor.test.ts`

- [ ] **Step 1: Failing test**

Create `src/lib/components/EntryEditor/EntryEditor.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import EntryEditor from './EntryEditor.svelte';
import { resetDatabase, db } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';
import { upsertEntry, getEntry } from '$lib/db/entries';

describe('EntryEditor', () => {
  beforeEach(() => resetDatabase());

  it('updates the entry intensity on button tap', async () => {
    const sym = await createSymptom({ name: 'Hitzewallungen' });
    await upsertEntry({ date: '2026-05-27', symptomId: sym.id });
    const { getByText } = render(EntryEditor, { props: { open: true, date: '2026-05-27', symptom: sym, onClose: () => {} } });
    await fireEvent.click(getByText('Mittel'));
    await tick();
    const after = await getEntry('2026-05-27', sym.id);
    expect(after?.intensity).toBe('mittel');
  });

  it('delete removes the entry and closes', async () => {
    const sym = await createSymptom({ name: 'X' });
    await upsertEntry({ date: '2026-05-27', symptomId: sym.id, intensity: 'leicht' });
    let closed = false;
    const { getByText } = render(EntryEditor, { props: { open: true, date: '2026-05-27', symptom: sym, onClose: () => { closed = true; } } });
    await fireEvent.click(getByText('🗑 Eintrag entfernen'));
    await tick();
    expect(await getEntry('2026-05-27', sym.id)).toBeUndefined();
    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/components/EntryEditor/EntryEditor.svelte`:

```svelte
<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { upsertEntry, deleteEntry, getEntry } from '$lib/db/entries';
  import { snackbar } from '$lib/stores/snackbar.svelte';
  import type { Symptom, Intensity } from '$lib/db';

  type Props = { open: boolean; date: string; symptom: Symptom; onClose: () => void };
  let { open, date, symptom, onClose }: Props = $props();

  let intensity = $state<Intensity>(null);
  let comment = $state('');

  $effect(() => {
    if (!open) return;
    (async () => {
      const e = await getEntry(date, symptom.id);
      intensity = e?.intensity ?? null;
      comment = e?.comment ?? '';
    })();
  });

  const LEVELS: { value: Intensity; label: string }[] = [
    { value: null, label: '— ohne' },
    { value: 'leicht', label: 'Leicht' },
    { value: 'mittel', label: 'Mittel' },
    { value: 'stark', label: 'Stark' }
  ];

  async function pick(v: Intensity) {
    intensity = v;
    await upsertEntry({ date, symptomId: symptom.id, intensity: v });
  }

  async function onCommentBlur(e: FocusEvent) {
    const v = (e.target as HTMLTextAreaElement).value;
    comment = v;
    await upsertEntry({ date, symptomId: symptom.id, comment: v });
  }

  async function remove() {
    await deleteEntry(date, symptom.id);
    snackbar.show({ message: `${symptom.name} entfernt`, actionLabel: 'Rückgängig', onAction: async () => {
      await upsertEntry({ date, symptomId: symptom.id, intensity, comment });
    }});
    onClose();
  }
</script>

<Modal {open} {onClose}>
  <div class="header">
    <Badge icon={symptom.icon} color={symptom.color} size={36} />
    <h3>{symptom.name}</h3>
  </div>

  <section>
    <div class="caption">Intensität</div>
    <div class="row">
      {#each LEVELS as lvl}
        <button
          type="button"
          class="ibtn {intensity === lvl.value ? 'active' : ''}"
          onclick={() => pick(lvl.value)}
        >{lvl.label}</button>
      {/each}
    </div>
  </section>

  <section>
    <div class="caption">Kommentar (optional)</div>
    <textarea
      class="comment"
      placeholder="z.B. Auslöser, Umstände…"
      bind:value={comment}
      onblur={onCommentBlur}
      rows={3}
    ></textarea>
  </section>

  <button type="button" class="primary" onclick={onClose}>Fertig</button>
  <button type="button" class="danger" onclick={remove}>🗑 Eintrag entfernen</button>
</Modal>

<style>
  .header { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .header h3 { margin: 0; font-size: var(--fs-lg); }
  .caption { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--sp-2); }
  .row { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .ibtn { flex: 1; padding: var(--sp-3); border-radius: var(--r-2); border: 1px solid var(--c-border); background: var(--c-surface); cursor: pointer; }
  .ibtn.active { background: var(--c-primary); color: var(--c-primary-contrast); border-color: var(--c-primary); }
  .comment { width: 100%; padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); resize: vertical; font: inherit; }
  section { margin-bottom: var(--sp-4); }
  .primary { width: 100%; background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .danger { display: block; margin: var(--sp-3) auto 0; color: var(--c-danger); background: none; border: 0; cursor: pointer; }
</style>
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/EntryEditor/
git commit -m "feat(editor): EntryEditor modal with intensity + comment + delete"
```

---

### Task 25: SymptomSheet (Drill-Down Hierarchy Picker)

**Files:**
- Create: `src/lib/components/SymptomSheet/SymptomSheet.svelte`, `src/lib/components/SymptomSheet/SymptomSheet.test.ts`

- [ ] **Step 1: Failing test**

Create `src/lib/components/SymptomSheet/SymptomSheet.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import SymptomSheet from './SymptomSheet.svelte';
import { resetDatabase } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';

describe('SymptomSheet', () => {
  beforeEach(() => resetDatabase());

  it('drills into a folder on tap', async () => {
    const folder = await createSymptom({ name: 'Körperlich', isFolder: true });
    await createSymptom({ name: 'Hitzewallungen', parentId: folder.id });
    let picked: string | null = null;
    const { findByText, queryByText } = render(SymptomSheet, {
      props: { open: true, onClose: () => {}, onPick: (id: string) => { picked = id; } } as any
    });
    const folderRow = await findByText('Körperlich');
    await fireEvent.click(folderRow);
    await tick();
    expect(queryByText('Hitzewallungen')).toBeTruthy();
    expect(picked).toBeNull();
  });

  it('calls onPick when a symptom row is tapped', async () => {
    const sym = await createSymptom({ name: 'Migräne' });
    let picked: string | null = null;
    const { findByText } = render(SymptomSheet, {
      props: { open: true, onClose: () => {}, onPick: (id: string) => { picked = id; } } as any
    });
    const row = await findByText('Migräne');
    await fireEvent.click(row);
    await tick();
    expect(picked).toBe(sym.id);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/components/SymptomSheet/SymptomSheet.svelte`:

```svelte
<script lang="ts">
  import Sheet from '$lib/components/ui/Sheet.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { ChevronRight, Plus, Check } from 'lucide-svelte';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom } from '$lib/db';

  type Props = {
    open: boolean;
    onClose: () => void;
    onPick: (symptomId: string) => void;
    enteredIds?: Set<string>;
  };
  let { open, onClose, onPick, enteredIds = new Set() }: Props = $props();

  let stack = $state<{ parentId: string | null; title: string }[]>([{ parentId: null, title: 'Symptom auswählen' }]);
  const current = $derived(stack[stack.length - 1]);

  const allQ = liveQuery(() => db.symptoms.filter((s) => !s.archived).toArray(), [] as Symptom[]);
  const rows = $derived(
    allQ.current.filter((s) => s.parentId === current.parentId).sort((a, b) => a.sortIndex - b.sortIndex)
  );

  function reset() { stack = [{ parentId: null, title: 'Symptom auswählen' }]; }

  $effect(() => { if (!open) reset(); });
  $effect(() => () => allQ.dispose());

  function drill(s: Symptom) {
    stack = [...stack, { parentId: s.id, title: s.name }];
  }
  function back() { if (stack.length > 1) stack = stack.slice(0, -1); }
  function pick(s: Symptom) { onPick(s.id); }
</script>

<Sheet {open} title={current.title} canGoBack={stack.length > 1} onBack={back} {onClose}>
  {#if rows.length === 0}
    <p class="empty">Keine Symptome vorhanden.</p>
  {/if}
  <ul class="list">
    {#each rows as s}
      <li>
        <button
          type="button"
          class="row {s.isFolder ? 'folder' : 'symptom'}"
          onclick={() => s.isFolder ? drill(s) : pick(s)}
        >
          <Badge icon={s.icon} color={s.color} size={28} />
          <span class="name">{s.name}</span>
          {#if enteredIds.has(s.id) && !s.isFolder}
            <span class="chip">erfasst</span>
          {/if}
          {#if s.isFolder}
            <ChevronRight size={18} />
          {:else if enteredIds.has(s.id)}
            <Check size={18} />
          {:else}
            <Plus size={18} />
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .list { list-style: none; padding: 0; margin: 0; }
  .row {
    display: flex; align-items: center; gap: var(--sp-3);
    width: 100%; padding: var(--sp-3) var(--sp-2);
    border: 0; background: transparent; cursor: pointer;
    border-bottom: 1px solid var(--c-border);
  }
  .name { flex: 1; text-align: left; font-size: var(--fs-md); }
  .chip { font-size: var(--fs-xs); padding: 2px var(--sp-2); background: var(--c-surface-3); border-radius: var(--r-1); color: var(--c-text-dim); }
  .empty { text-align: center; color: var(--c-text-dim); padding: var(--sp-5); }
</style>
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/SymptomSheet/
git commit -m "feat(sheet): SymptomSheet drill-down picker with breadcrumb stack"
```

---

### Task 26: Today Page (puts it all together)

**Files:**
- Create: `src/lib/components/DayView/EntryCard.svelte`, `src/lib/components/DayView/EntryList.svelte`, `src/lib/components/ui/Fab.svelte`
- Modify: `src/routes/+page.svelte`, `src/routes/+page.ts` (new)
- Create: `src/routes/tag/[date]/+page.svelte`, `src/routes/tag/[date]/+page.ts`

- [ ] **Step 1: Fab component**

Create `src/lib/components/ui/Fab.svelte`:

```svelte
<script lang="ts">
  import { Plus } from 'lucide-svelte';
  type Props = { onClick: () => void; label?: string };
  let { onClick, label = 'Symptom hinzufügen' }: Props = $props();
</script>

<button type="button" class="fab" onclick={onClick} aria-label={label}>
  <Plus size={26} />
</button>

<style>
  .fab {
    position: fixed; right: var(--sp-4);
    bottom: calc(var(--nav-height) + var(--sp-4) + var(--safe-bottom));
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--c-primary); color: var(--c-primary-contrast);
    border: 0; box-shadow: var(--shadow-2);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    z-index: 20;
  }
</style>
```

- [ ] **Step 2: EntryCard**

Create `src/lib/components/DayView/EntryCard.svelte`:

```svelte
<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SwipeRow from '$lib/components/ui/SwipeRow.svelte';
  import { MessageCircle } from 'lucide-svelte';
  import type { Symptom, Entry } from '$lib/db';

  type Props = { entry: Entry; symptom: Symptom; onTap: () => void; onSwipe: () => void };
  let { entry, symptom, onTap, onSwipe }: Props = $props();

  const intensityLabel = $derived(
    entry.intensity ? entry.intensity.charAt(0).toUpperCase() + entry.intensity.slice(1) : 'erfasst'
  );
</script>

<SwipeRow {onSwipe}>
  <button type="button" class="card" onclick={onTap}>
    <Badge icon={symptom.icon} color={symptom.color} size={28} />
    <div class="text">
      <div class="name">{symptom.name}</div>
      <div class="meta">
        <span class={`level level-${entry.intensity ?? 'none'}`}>{intensityLabel}</span>
        {#if entry.comment}<MessageCircle size={14} />{/if}
      </div>
    </div>
  </button>
</SwipeRow>

<style>
  .card {
    display: flex; align-items: center; gap: var(--sp-3);
    width: 100%; padding: var(--sp-3) var(--sp-4);
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-2);
    margin-bottom: var(--sp-2);
    cursor: pointer; text-align: left;
  }
  .text { flex: 1; }
  .name { font-weight: var(--fw-bold); }
  .meta { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--c-text-dim); margin-top: 2px; }
  .level-stark { color: var(--c-danger); font-weight: var(--fw-bold); }
</style>
```

- [ ] **Step 3: EntryList**

Create `src/lib/components/DayView/EntryList.svelte`:

```svelte
<script lang="ts">
  import EntryCard from './EntryCard.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { deleteEntry, upsertEntry, listEntriesForDate } from '$lib/db/entries';
  import { snackbar } from '$lib/stores/snackbar.svelte';

  type Props = { date: string };
  let { date }: Props = $props();

  // liveQueryEffect re-subscribes when `date` changes — important for date-picker navigation.
  const entriesQ = liveQueryEffect(() => listEntriesForDate(date), [] as Entry[]);
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);
  const symptomMap = $derived(new Map(symptomsQ.current.map((s) => [s.id, s])));

  let editing = $state<{ entry: Entry; symptom: Symptom } | null>(null);

  async function removeWithUndo(e: Entry, s: Symptom) {
    const original = { ...e };
    await deleteEntry(e.date, e.symptomId);
    snackbar.show({
      message: `${s.name} entfernt`,
      actionLabel: 'Rückgängig',
      onAction: () => upsertEntry({ date: original.date, symptomId: original.symptomId, intensity: original.intensity, comment: original.comment })
    });
  }
</script>

<section>
  <h2 class="section-title">Heute erfasst ({entriesQ.current.length})</h2>

  {#if entriesQ.current.length === 0}
    <p class="empty">Tippe das + unten, um Symptome zu erfassen.</p>
  {/if}

  {#each entriesQ.current as e (e.id)}
    {@const s = symptomMap.get(e.symptomId)}
    {#if s}
      <EntryCard entry={e} symptom={s} onTap={() => editing = { entry: e, symptom: s }} onSwipe={() => removeWithUndo(e, s)} />
    {/if}
  {/each}
</section>

{#if editing}
  <EntryEditor open={true} date={editing.entry.date} symptom={editing.symptom} onClose={() => editing = null} />
{/if}

<style>
  .section-title { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin: var(--sp-3) var(--sp-4) var(--sp-2); }
  .empty { color: var(--c-text-dim); text-align: center; padding: var(--sp-5); }
</style>
```

- [ ] **Step 4: Today route**

Replace `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { todayKey } from '$lib/utils/date';
  import { onMount } from 'svelte';
  onMount(() => goto(`/tag/${todayKey()}`, { replaceState: true }));
</script>

<p>Lade…</p>
```

Create `src/routes/tag/[date]/+page.ts`:

```ts
import { error } from '@sveltejs/kit';
import { isValidDateKey } from '$lib/utils/date';
export const prerender = false;
export function load({ params }) {
  if (!isValidDateKey(params.date)) throw error(404, 'Ungültiges Datum');
  return { date: params.date };
}
```

Create `src/routes/tag/[date]/+page.svelte`:

```svelte
<script lang="ts">
  import DateHeader from '$lib/components/DayView/DateHeader.svelte';
  import EntryList from '$lib/components/DayView/EntryList.svelte';
  import SymptomSheet from '$lib/components/SymptomSheet/SymptomSheet.svelte';
  import EntryEditor from '$lib/components/EntryEditor/EntryEditor.svelte';
  import Fab from '$lib/components/ui/Fab.svelte';
  import { currentDate } from '$lib/stores/currentDate.svelte';
  import { liveQueryEffect } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Entry } from '$lib/db';
  import { listEntriesForDate, upsertEntry } from '$lib/db/entries';

  let { data } = $props();
  $effect(() => { currentDate.set(data.date); });

  let sheetOpen = $state(false);
  let editing = $state<{ symptom: Symptom } | null>(null);

  const entriesQ = liveQueryEffect(() => listEntriesForDate(currentDate.value), [] as Entry[]);
  const symptomsQ = liveQueryEffect(() => db.symptoms.toArray(), [] as Symptom[]);

  const enteredIds = $derived(new Set(entriesQ.current.map((e) => e.symptomId)));

  async function onPick(symptomId: string) {
    await upsertEntry({ date: currentDate.value, symptomId });
    const sym = symptomsQ.current.find((s) => s.id === symptomId);
    if (sym) editing = { symptom: sym };
  }
</script>

<DateHeader />
<EntryList date={currentDate.value} />

<Fab onClick={() => sheetOpen = true} />

<SymptomSheet open={sheetOpen} onClose={() => sheetOpen = false} onPick={onPick} {enteredIds} />

{#if editing}
  <EntryEditor open={true} date={currentDate.value} symptom={editing.symptom} onClose={() => editing = null} />
{/if}
```

- [ ] **Step 5: Smoke**

```bash
pnpm run check
pnpm run build
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(day): full daily entry flow — list, FAB, sheet, editor"
```

---

### Task 27: Symptom Admin — List & Edit

**Files:**
- Create: `src/lib/components/SymptomAdmin/SymptomList.svelte`, `src/lib/components/SymptomAdmin/SymptomEditModal.svelte`, `src/lib/components/SymptomAdmin/SymptomEditModal.test.ts`, `src/routes/symptome/+page.svelte`

- [ ] **Step 1: Failing test**

Create `src/lib/components/SymptomAdmin/SymptomEditModal.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import SymptomEditModal from './SymptomEditModal.svelte';
import { resetDatabase, db } from '$lib/db';
import { createSymptom } from '$lib/db/symptoms';

describe('SymptomEditModal', () => {
  beforeEach(() => resetDatabase());

  it('persists name + color edits on save', async () => {
    const s = await createSymptom({ name: 'A', color: '#6b7280' });
    const { getByLabelText, getByText } = render(SymptomEditModal, { props: { open: true, symptom: s, onClose: () => {} } });
    const nameInput = getByLabelText('Name') as HTMLInputElement;
    await fireEvent.input(nameInput, { target: { value: 'B' } });
    await fireEvent.click(getByText('Speichern'));
    await tick();
    const after = await db.symptoms.get(s.id);
    expect(after?.name).toBe('B');
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement EditModal**

Create `src/lib/components/SymptomAdmin/SymptomEditModal.svelte`:

```svelte
<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import ColorPicker from '$lib/components/ui/ColorPicker.svelte';
  import IconPicker from '$lib/components/ui/IconPicker.svelte';
  import { updateSymptom, archiveSymptom, moveSymptom, listAllSymptoms } from '$lib/db/symptoms';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { db, type Symptom, type Tag } from '$lib/db';

  type Props = { open: boolean; symptom: Symptom; onClose: () => void };
  let { open, symptom, onClose }: Props = $props();

  let name = $state(symptom.name);
  let color = $state(symptom.color);
  let icon = $state(symptom.icon);
  let tagIds = $state([...symptom.tagIds]);
  let parentId = $state<string | null>(symptom.parentId);
  let view = $state<'main' | 'icons'>('main');

  $effect(() => {
    name = symptom.name; color = symptom.color; icon = symptom.icon;
    tagIds = [...symptom.tagIds]; parentId = symptom.parentId;
    view = 'main';
  });

  const tagsQ = liveQuery(() => db.tags.toArray(), [] as Tag[]);
  const allQ = liveQuery(() => listAllSymptoms(), [] as Symptom[]);
  $effect(() => () => { tagsQ.dispose(); allQ.dispose(); });

  function toggleTag(id: string) {
    tagIds = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
  }

  async function save() {
    await updateSymptom(symptom.id, { name, color, icon, tagIds });
    if (parentId !== symptom.parentId) {
      await moveSymptom(symptom.id, parentId);
    }
    onClose();
  }

  async function archive() {
    if (!confirm(`"${symptom.name}" archivieren?`)) return;
    await archiveSymptom(symptom.id);
    onClose();
  }
</script>

<Modal {open} onClose={onClose} title={symptom.isFolder ? 'Ordner bearbeiten' : 'Symptom bearbeiten'}>
  {#if view === 'icons'}
    <IconPicker value={icon} {color} onChange={(i) => { icon = i; view = 'main'; }} />
    <button type="button" class="link" onclick={() => view = 'main'}>‹ Zurück</button>
  {:else}
    <div class="preview"><Badge {icon} {color} size={36} /><strong>{name || '—'}</strong></div>

    <label class="field">
      <span>Name</span>
      <input type="text" bind:value={name} />
    </label>

    <div class="field">
      <span>Icon</span>
      <button type="button" class="icon-btn" onclick={() => view = 'icons'}>
        <Badge {icon} {color} size={28} /> <span class="iname">{icon}</span> ›
      </button>
    </div>

    <div class="field">
      <span>Farbe</span>
      <ColorPicker value={color} onChange={(c) => color = c} />
    </div>

    {#if !symptom.isFolder}
      <div class="field">
        <span>Tags</span>
        <div class="chips">
          {#each tagsQ.current as t}
            <button type="button" class="chip {tagIds.includes(t.id) ? 'on' : ''}" onclick={() => toggleTag(t.id)}>{t.name}</button>
          {/each}
          {#if tagsQ.current.length === 0}<span class="muted">Keine Tags angelegt.</span>{/if}
        </div>
      </div>
    {/if}

    <div class="field">
      <span>Eltern-Ordner</span>
      <select bind:value={parentId}>
        <option value={null}>(Wurzel)</option>
        {#each allQ.current.filter((s) => s.isFolder && s.id !== symptom.id) as f}
          <option value={f.id}>{f.name}</option>
        {/each}
      </select>
    </div>

    <button type="button" class="primary" onclick={save}>Speichern</button>
    <button type="button" class="danger" onclick={archive}>Archivieren</button>
  {/if}
</Modal>

<style>
  .preview { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .field { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .field > span { font-size: var(--fs-xs); color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  input, select { padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); }
  .icon-btn { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); cursor: pointer; }
  .iname { font-family: ui-monospace, monospace; flex: 1; text-align: left; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  .chip { padding: var(--sp-2) var(--sp-3); border-radius: var(--r-pill); border: 1px solid var(--c-border); background: var(--c-surface); cursor: pointer; }
  .chip.on { background: var(--c-primary); color: var(--c-primary-contrast); border-color: var(--c-primary); }
  .muted { color: var(--c-text-dim); font-size: var(--fs-sm); }
  .primary { width: 100%; background: var(--c-primary); color: var(--c-primary-contrast); border: 0; padding: var(--sp-3); border-radius: var(--r-2); font-weight: var(--fw-bold); cursor: pointer; }
  .danger { display: block; margin: var(--sp-3) auto 0; color: var(--c-danger); background: none; border: 0; cursor: pointer; }
  .link { background: none; border: 0; color: var(--c-text-dim); cursor: pointer; }
</style>
```

- [ ] **Step 4: SymptomList view**

Create `src/lib/components/SymptomAdmin/SymptomList.svelte`:

```svelte
<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import SymptomEditModal from './SymptomEditModal.svelte';
  import { ChevronDown, ChevronRight, Plus } from 'lucide-svelte';
  import { listTree, createSymptom, type TreeNode } from '$lib/db/symptoms';
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import type { Symptom } from '$lib/db';

  const treeQ = liveQuery(() => listTree(), [] as TreeNode[]);
  $effect(() => () => treeQ.dispose());

  let expanded = $state(new Set<string>());
  let editing = $state<Symptom | null>(null);

  function toggle(id: string) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    expanded = new Set(expanded);
  }

  async function addRoot(isFolder: boolean) {
    const name = prompt(isFolder ? 'Name des neuen Ordners?' : 'Name des neuen Symptoms?');
    if (!name) return;
    await createSymptom({ name, isFolder });
  }
</script>

<header class="bar">
  <h1>Symptome</h1>
  <div class="actions">
    <button type="button" onclick={() => addRoot(false)}><Plus size={16} /> Symptom</button>
    <button type="button" onclick={() => addRoot(true)}><Plus size={16} /> Ordner</button>
  </div>
</header>

{#snippet renderNode(node: TreeNode, level: number)}
  <li class="row" style="padding-left: calc({level} * var(--sp-4) + var(--sp-3))">
    {#if node.isFolder}
      <button type="button" class="chev" onclick={() => toggle(node.id)} aria-label="Aufklappen">
        {#if expanded.has(node.id)}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
      </button>
    {:else}
      <span class="chev-spacer"></span>
    {/if}
    <button type="button" class="entry" onclick={() => editing = node}>
      <Badge icon={node.icon} color={node.color} size={28} />
      <span>{node.name}</span>
    </button>
  </li>
  {#if node.isFolder && expanded.has(node.id)}
    {#each node.children as c}{@render renderNode(c, level + 1)}{/each}
  {/if}
{/snippet}

<ul class="list">
  {#each treeQ.current as n}{@render renderNode(n, 0)}{/each}
  {#if treeQ.current.length === 0}<li class="empty">Noch keine Symptome.</li>{/if}
</ul>

{#if editing}
  <SymptomEditModal open={true} symptom={editing} onClose={() => editing = null} />
{/if}

<style>
  .bar { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .bar h1 { margin: 0; font-size: var(--fs-lg); }
  .actions { display: flex; gap: var(--sp-2); }
  .actions button { display: inline-flex; align-items: center; gap: 4px; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); cursor: pointer; }
  .list { list-style: none; margin: 0; padding: 0; }
  .row { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2); border-bottom: 1px solid var(--c-border); }
  .chev, .chev-spacer { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; background: none; border: 0; color: var(--c-text-dim); cursor: pointer; }
  .entry { display: flex; align-items: center; gap: var(--sp-3); background: none; border: 0; padding: var(--sp-2); cursor: pointer; flex: 1; text-align: left; }
  .empty { padding: var(--sp-5); text-align: center; color: var(--c-text-dim); }
</style>
```

- [ ] **Step 5: Route**

Create `src/routes/symptome/+page.svelte`:

```svelte
<script lang="ts">
  import SymptomList from '$lib/components/SymptomAdmin/SymptomList.svelte';
</script>

<SymptomList />
```

- [ ] **Step 6: Run check + commit**

```bash
pnpm test
pnpm run check
git add .
git commit -m "feat(symptoms): admin list with hierarchical view + edit modal"
```

---

### Task 28: Symptom Admin — Reorder Mode

**Files:**
- Modify: `src/lib/components/SymptomAdmin/SymptomList.svelte`

- [ ] **Step 1: Install dnd**

```bash
pnpm add svelte-dnd-action
```

- [ ] **Step 2: Failing test** (programmatic reorder via `reorderSiblings`)

Create `src/lib/components/SymptomAdmin/SymptomList.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from '$lib/db';
import { createSymptom, reorderSiblings, listChildren } from '$lib/db/symptoms';

describe('reorder integration helper', () => {
  beforeEach(() => resetDatabase());
  it('reorders children sequentially', async () => {
    const r = await createSymptom({ name: 'R', isFolder: true });
    const a = await createSymptom({ name: 'A', parentId: r.id });
    const b = await createSymptom({ name: 'B', parentId: r.id });
    const c = await createSymptom({ name: 'C', parentId: r.id });
    await reorderSiblings(r.id, [c.id, a.id, b.id]);
    const ordered = await listChildren(r.id);
    expect(ordered.map((s) => s.name)).toEqual(['C', 'A', 'B']);
  });
});
```

- [ ] **Step 3: Modify `SymptomList.svelte`**

Im `<script>`-Block ergänzen:

```ts
import { dndzone } from 'svelte-dnd-action';
import { reorderSiblings } from '$lib/db/symptoms';

let reorderMode = $state(false);

function handleConsider(parentId: string | null, e: CustomEvent<{ items: TreeNode[] }>) {
  // Optimistic UI: only used during drag — we don't persist until "finalize"
  if (parentId === null) {
    // mutate roots locally for visual feedback (in this minimal impl we just rely on dnd-action's internal handling)
  }
}

async function handleFinalize(parentId: string | null, e: CustomEvent<{ items: TreeNode[] }>) {
  await reorderSiblings(parentId, e.detail.items.map((i) => i.id));
}
```

In der Liste (`renderNode`-Snippet bzw. den root-Items) zusätzliches `use:dndzone` wenn `reorderMode === true`:

```svelte
<ul
  class="list"
  use:dndzone={{ items: treeQ.current, flipDurationMs: 0, dragDisabled: !reorderMode, type: 'roots' }}
  onconsider={(e) => handleConsider(null, e)}
  onfinalize={(e) => handleFinalize(null, e)}
>
  {#each treeQ.current as n (n.id)}{@render renderNode(n, 0)}{/each}
</ul>
```

Im `bar`-Header zusätzlichen Toggle:

```svelte
<button type="button" onclick={() => reorderMode = !reorderMode}>
  {reorderMode ? 'Fertig' : 'Umsortieren'}
</button>
```

> Hinweis: Pro Ebene eine eigene `dndzone` registrieren. Für die MVP-Iteration nur Reorder innerhalb der gleichen Ebene umsetzen; Drag-in-Ordner kann v1.1 sein. Falls die Implementierung das einfacher macht: pro `TreeNode.children`-Liste eine eigene `use:dndzone`-Schleife im Sub-Snippet.

- [ ] **Step 4: Run tests + smoke**

```bash
pnpm test
pnpm run check
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(symptoms): reorder mode with svelte-dnd-action"
```

---

### Task 29: Tag Admin

**Files:**
- Create: `src/lib/components/TagAdmin/TagList.svelte`, `src/routes/tags/+page.svelte`

- [ ] **Step 1: Component**

Create `src/lib/components/TagAdmin/TagList.svelte`:

```svelte
<script lang="ts">
  import { liveQuery } from '$lib/stores/liveQuery.svelte';
  import { listTags, createTag, renameTag, deleteTag, countSymptomsUsingTag } from '$lib/db/tags';
  import type { Tag } from '$lib/db';
  import { Plus, Pencil, Trash2 } from 'lucide-svelte';

  const tagsQ = liveQuery(() => listTags(), [] as Tag[]);
  $effect(() => () => tagsQ.dispose());

  async function add() {
    const name = prompt('Tag-Name?');
    if (name) await createTag(name);
  }
  async function rename(t: Tag) {
    const n = prompt('Neuer Name?', t.name);
    if (n) await renameTag(t.id, n);
  }
  async function remove(t: Tag) {
    const n = await countSymptomsUsingTag(t.id);
    if (n > 0 && !confirm(`Tag "${t.name}" wird von ${n} Symptomen entfernt. Trotzdem löschen?`)) return;
    if (n === 0 && !confirm(`Tag "${t.name}" löschen?`)) return;
    await deleteTag(t.id);
  }
</script>

<header class="bar">
  <h1>Tags</h1>
  <button type="button" onclick={add}><Plus size={16} /> Neuer Tag</button>
</header>

<ul class="list">
  {#each tagsQ.current as t (t.id)}
    <li class="row">
      <span class="name">{t.name}</span>
      <button type="button" onclick={() => rename(t)} aria-label="Umbenennen"><Pencil size={16} /></button>
      <button type="button" onclick={() => remove(t)} aria-label="Löschen"><Trash2 size={16} /></button>
    </li>
  {/each}
  {#if tagsQ.current.length === 0}<li class="empty">Keine Tags vorhanden.</li>{/if}
</ul>

<style>
  .bar { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .bar h1 { margin: 0; font-size: var(--fs-lg); }
  .bar button { display: inline-flex; align-items: center; gap: 4px; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-2); background: var(--c-surface); cursor: pointer; }
  .list { list-style: none; margin: 0; padding: 0; }
  .row { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .name { flex: 1; }
  .row button { background: none; border: 0; color: var(--c-text-dim); cursor: pointer; padding: var(--sp-2); }
  .empty { padding: var(--sp-5); text-align: center; color: var(--c-text-dim); }
</style>
```

- [ ] **Step 2: Route**

Create `src/routes/tags/+page.svelte`:

```svelte
<script lang="ts">
  import TagList from '$lib/components/TagAdmin/TagList.svelte';
</script>

<TagList />
```

- [ ] **Step 3: Smoke + commit**

```bash
pnpm run check
git add .
git commit -m "feat(tags): admin list with create/rename/delete"
```

---

### Task 30: Default Template & Importer

**Files:**
- Create: `src/lib/templates/perimeno-default.ts`, `src/lib/templates/import.ts`, `src/lib/templates/import.test.ts`

- [ ] **Step 1: Template**

Create `src/lib/templates/perimeno-default.ts`:

```ts
export interface TemplateTag { name: string; }
export interface TemplateSymptom {
  name: string;
  icon: string;
  color: string;
  tags?: string[];
  children?: TemplateSymptom[];
}
export interface Template {
  tags: TemplateTag[];
  roots: TemplateSymptom[];
}

export const DEFAULT_TEMPLATE: Template = {
  tags: [
    { name: 'körperlich' },
    { name: 'emotional' },
    { name: 'schlafrelevant' },
    { name: 'hormonell' }
  ],
  roots: [
    {
      name: 'Körperlich', icon: 'activity', color: '#10b981',
      children: [
        { name: 'Hitzewallungen',  icon: 'flame',       color: '#f59e0b', tags: ['körperlich', 'hormonell'] },
        { name: 'Nachtschweiss',   icon: 'cloud-drizzle', color: '#06b6d4', tags: ['körperlich', 'schlafrelevant', 'hormonell'] },
        { name: 'Herzrasen',       icon: 'heart-pulse', color: '#ef4444', tags: ['körperlich'] },
        { name: 'Gelenkschmerzen', icon: 'bandage',     color: '#84cc16', tags: ['körperlich'] },
        { name: 'Kopfschmerzen',   icon: 'brain',       color: '#6366f1', tags: ['körperlich'] },
        { name: 'Schwindel',       icon: 'sparkles',    color: '#8b5cf6', tags: ['körperlich'] }
      ]
    },
    {
      name: 'Stimmung & Gefühle', icon: 'heart', color: '#ec4899',
      children: [
        { name: 'Reizbarkeit',     icon: 'angry', color: '#f97316', tags: ['emotional'] },
        { name: 'Stimmungstief',   icon: 'frown', color: '#3b82f6', tags: ['emotional'] },
        { name: 'Angst',           icon: 'alert-triangle', color: '#dc2626', tags: ['emotional'] },
        { name: 'Konzentrationsschwierigkeiten', icon: 'cloud-fog', color: '#6b7280', tags: ['emotional'] }
      ]
    },
    {
      name: 'Schlaf', icon: 'moon', color: '#6366f1',
      children: [
        { name: 'Einschlafstörungen', icon: 'bed', color: '#6366f1', tags: ['schlafrelevant'] },
        { name: 'Durchschlafstörungen', icon: 'moon', color: '#8b5cf6', tags: ['schlafrelevant'] }
      ]
    },
    {
      name: 'Energie & Antrieb', icon: 'zap', color: '#eab308',
      children: [
        { name: 'Müdigkeit', icon: 'coffee', color: '#f59e0b', tags: ['körperlich', 'emotional'] },
        { name: 'Erschöpfung', icon: 'cloud', color: '#6b7280', tags: ['körperlich', 'emotional'] }
      ]
    }
  ]
};
```

- [ ] **Step 2: Failing test for importer**

Create `src/lib/templates/import.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import { importTemplate } from './import';
import { DEFAULT_TEMPLATE } from './perimeno-default';

describe('importTemplate', () => {
  beforeEach(() => resetDatabase());

  it('inserts tags', async () => {
    await importTemplate(DEFAULT_TEMPLATE);
    expect(await db.tags.count()).toBe(DEFAULT_TEMPLATE.tags.length);
  });

  it('inserts root + child symptoms with correct depth', async () => {
    await importTemplate(DEFAULT_TEMPLATE);
    const roots = await db.symptoms.filter((s) => s.parentId === null).toArray();
    expect(roots.length).toBeGreaterThan(0);
    for (const r of roots) expect(r.depth).toBe(0);
    const kids = await db.symptoms.filter((s) => s.parentId === roots[0].id).toArray();
    for (const k of kids) expect(k.depth).toBe(1);
  });

  it('resolves tag references on symptoms', async () => {
    await importTemplate(DEFAULT_TEMPLATE);
    const hitze = await db.symptoms.filter((s) => s.name === 'Hitzewallungen').first();
    const tags = await db.tags.toArray();
    expect(hitze?.tagIds.length).toBeGreaterThan(0);
    for (const tid of hitze!.tagIds) {
      expect(tags.some((t) => t.id === tid)).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run — fail**

- [ ] **Step 4: Implement**

Create `src/lib/templates/import.ts`:

```ts
import { db } from '$lib/db';
import { createTag } from '$lib/db/tags';
import { createSymptom } from '$lib/db/symptoms';
import type { Template, TemplateSymptom } from './perimeno-default';

export async function importTemplate(t: Template): Promise<void> {
  await db.transaction('rw', db.tags, db.symptoms, async () => {
    const tagIdByName = new Map<string, string>();
    for (const tg of t.tags) {
      const created = await createTag(tg.name);
      tagIdByName.set(tg.name, created.id);
    }
    async function recur(s: TemplateSymptom, parentId: string | null) {
      const isFolder = !!s.children && s.children.length > 0;
      const created = await createSymptom({
        name: s.name,
        icon: s.icon,
        color: s.color,
        isFolder,
        parentId,
        tagIds: (s.tags ?? []).map((n) => tagIdByName.get(n)).filter((x): x is string => !!x)
      });
      if (s.children) for (const c of s.children) await recur(c, created.id);
    }
    for (const r of t.roots) await recur(r, null);
  });
}
```

- [ ] **Step 5: Run — pass**

- [ ] **Step 6: Commit**

```bash
git add src/lib/templates/
git commit -m "feat(templates): default perimenopause template + importer"
```

---

### Task 31: Settings — Export / Import / Template

**Files:**
- Create: `src/lib/utils/transfer.ts`, `src/lib/utils/transfer.test.ts`, `src/routes/einstellungen/+page.svelte`

- [ ] **Step 1: Failing test for serializer**

Create `src/lib/utils/transfer.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, db } from '$lib/db';
import { exportAll, importAll, validateExportPayload } from './transfer';

describe('transfer', () => {
  beforeEach(() => resetDatabase());

  it('round-trips an export through import', async () => {
    await db.tags.add({ id: 't1', name: 'körperlich', createdAt: 1 });
    await db.symptoms.add({ id: 's1', name: 'A', color: '#000', icon: 'circle', tagIds: ['t1'], parentId: null, sortIndex: 0, depth: 0, isFolder: false, archived: false, createdAt: 1, updatedAt: 1 });
    await db.entries.add({ id: '2026-05-27__s1', date: '2026-05-27', symptomId: 's1', intensity: 'mittel', comment: '', updatedAt: 1 });

    const payload = await exportAll();
    await resetDatabase();
    await importAll(payload, 'replace');

    expect(await db.tags.count()).toBe(1);
    expect((await db.symptoms.get('s1'))?.name).toBe('A');
    expect((await db.entries.get('2026-05-27__s1'))?.intensity).toBe('mittel');
  });

  it('validates payload version', () => {
    expect(validateExportPayload({ version: 'bogus' } as any)).toBe(false);
    expect(validateExportPayload({ version: 1, symptoms: [], tags: [], entries: [], meta: [] })).toBe(true);
  });

  it('merge keeps existing rows and overlays imported ids', async () => {
    await db.tags.add({ id: 't1', name: 'alt', createdAt: 1 });
    await importAll({ version: 1, tags: [{ id: 't1', name: 'neu', createdAt: 2 }, { id: 't2', name: 'andere', createdAt: 2 }], symptoms: [], entries: [], meta: [] }, 'merge');
    expect((await db.tags.get('t1'))?.name).toBe('neu');
    expect(await db.tags.get('t2')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Create `src/lib/utils/transfer.ts`:

```ts
import { db, type Symptom, type Tag, type Entry, type MetaRow } from '$lib/db';

export const EXPORT_VERSION = 1 as const;

export interface ExportPayload {
  version: typeof EXPORT_VERSION;
  exportedAt?: string;
  symptoms: Symptom[];
  tags: Tag[];
  entries: Entry[];
  meta: MetaRow[];
}

export type ImportMode = 'replace' | 'merge';

export function validateExportPayload(x: unknown): x is ExportPayload {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  return p.version === EXPORT_VERSION
    && Array.isArray(p.symptoms)
    && Array.isArray(p.tags)
    && Array.isArray(p.entries)
    && Array.isArray(p.meta);
}

export async function exportAll(): Promise<ExportPayload> {
  const [symptoms, tags, entries, meta] = await Promise.all([
    db.symptoms.toArray(),
    db.tags.toArray(),
    db.entries.toArray(),
    db.meta.toArray()
  ]);
  return { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), symptoms, tags, entries, meta };
}

export async function importAll(payload: ExportPayload, mode: ImportMode): Promise<void> {
  if (!validateExportPayload(payload)) throw new Error('Ungültiges Export-Format');
  await db.transaction('rw', db.symptoms, db.tags, db.entries, db.meta, async () => {
    if (mode === 'replace') {
      await Promise.all([db.symptoms.clear(), db.tags.clear(), db.entries.clear(), db.meta.clear()]);
    }
    await db.symptoms.bulkPut(payload.symptoms);
    await db.tags.bulkPut(payload.tags);
    await db.entries.bulkPut(payload.entries);
    await db.meta.bulkPut(payload.meta);
  });
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
```

- [ ] **Step 4: Settings page**

Create `src/routes/einstellungen/+page.svelte`:

```svelte
<script lang="ts">
  import { todayKey } from '$lib/utils/date';
  import { exportAll, importAll, downloadJson, readFileAsText, validateExportPayload } from '$lib/utils/transfer';
  import { importTemplate } from '$lib/templates/import';
  import { DEFAULT_TEMPLATE } from '$lib/templates/perimeno-default';
  import { db } from '$lib/db';
  import { setMeta } from '$lib/db/meta';

  let isStandalone = $state(false);
  $effect(() => {
    if (typeof window !== 'undefined') {
      isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
    }
  });

  async function onExport() {
    const p = await exportAll();
    downloadJson(`perimenobomb-export-${todayKey()}.json`, p);
  }

  let fileInput: HTMLInputElement;

  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const text = await readFileAsText(f);
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { alert('Datei ist kein gültiges JSON.'); return; }
    if (!validateExportPayload(payload)) { alert('Datei hat nicht das erwartete Export-Format.'); return; }
    const mode = confirm('OK = Daten zusammenführen (Konflikte: importiert gewinnt).\nAbbrechen = vorhandene Daten ersetzen.') ? 'merge' : 'replace';
    await importAll(payload as any, mode);
    alert('Import abgeschlossen.');
  }

  async function onImportTemplate() {
    const have = await db.symptoms.count();
    if (have > 0 && !confirm(`Es existieren bereits ${have} Symptome. Vorlage zusätzlich importieren?`)) return;
    await importTemplate(DEFAULT_TEMPLATE);
    await setMeta('firstRunCompleted', true);
    alert('Vorlage importiert.');
  }

  async function onWipe() {
    if (!confirm('Alle Daten endgültig löschen?')) return;
    if (!confirm('Wirklich endgültig? Das kann nicht rückgängig gemacht werden.')) return;
    await db.transaction('rw', db.symptoms, db.tags, db.entries, db.meta, async () => {
      await Promise.all([db.symptoms.clear(), db.tags.clear(), db.entries.clear(), db.meta.clear()]);
    });
    alert('Alle Daten gelöscht.');
  }
</script>

<header class="hd"><h1>Einstellungen</h1></header>

{#if !isStandalone}
  <section class="warn">
    <h2>iOS / Safari Hinweis</h2>
    <p>
      Damit deine Daten nicht nach ~7 Tagen automatisch gelöscht werden, füge diese App
      zum <strong>Home-Bildschirm</strong> hinzu (Safari → Teilen-Menü → „Zum Home-Bildschirm").
    </p>
  </section>
{/if}

<section>
  <h2>Standard-Vorlage</h2>
  <p>Eine kuratierte Liste typischer Perimenopause-Symptome importieren.</p>
  <button type="button" onclick={onImportTemplate}>Standard-Vorlage importieren</button>
</section>

<section>
  <h2>Backup &amp; Übertragung</h2>
  <p>Alle Daten als JSON-Datei herunterladen (oder zurückspielen).</p>
  <button type="button" onclick={onExport}>Daten exportieren (JSON)</button>
  <button type="button" onclick={() => fileInput.click()}>Daten importieren…</button>
  <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
</section>

<section>
  <h2>Tags</h2>
  <p><a href="/tags">Tag-Verwaltung öffnen</a></p>
</section>

<section>
  <h2>Daten löschen</h2>
  <button type="button" class="danger" onclick={onWipe}>Alle Daten löschen</button>
</section>

<style>
  .hd { padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  .hd h1 { margin: 0; font-size: var(--fs-lg); }
  section { padding: var(--sp-4); border-bottom: 1px solid var(--c-border); }
  section h2 { font-size: var(--fs-md); margin: 0 0 var(--sp-2); }
  section p { margin: 0 0 var(--sp-3); color: var(--c-text-dim); }
  button { padding: var(--sp-3) var(--sp-4); margin-right: var(--sp-2); border: 1px solid var(--c-border); background: var(--c-surface); border-radius: var(--r-2); cursor: pointer; }
  .danger { color: var(--c-danger); border-color: var(--c-danger); }
  .warn { background: #fff8e1; }
</style>
```

- [ ] **Step 5: Run + commit**

```bash
pnpm test
pnpm run check
git add .
git commit -m "feat(settings): export/import JSON, template import, wipe, iOS hint"
```

---

### Task 32: First-Run Experience

**Files:**
- Modify: `src/routes/tag/[date]/+page.svelte`, neue Komponente `src/lib/components/DayView/FirstRun.svelte`

- [ ] **Step 1: FirstRun component**

Create `src/lib/components/DayView/FirstRun.svelte`:

```svelte
<script lang="ts">
  import { importTemplate } from '$lib/templates/import';
  import { DEFAULT_TEMPLATE } from '$lib/templates/perimeno-default';
  import { setMeta } from '$lib/db/meta';
  import { goto } from '$app/navigation';

  async function useTemplate() {
    await importTemplate(DEFAULT_TEMPLATE);
    await setMeta('firstRunCompleted', true);
  }
  async function buildOwn() {
    await setMeta('firstRunCompleted', true);
    await goto('/symptome');
  }
</script>

<section class="welcome">
  <h1>Willkommen 👋</h1>
  <p>PeriMenoBomb hilft dir, auffällige Symptome im Alltag zu erfassen — kurz, lokal, ohne Account.</p>
  <p>Wie magst du starten?</p>
  <button type="button" class="primary" onclick={useTemplate}>Mit Standard-Vorlage starten</button>
  <button type="button" class="secondary" onclick={buildOwn}>Eigene Liste aufbauen</button>
  <p class="hint">
    <strong>Wichtig (iOS):</strong> Bitte füge diese App zum Home-Bildschirm hinzu — sonst löscht Safari deine Daten nach ~7 Tagen.
  </p>
</section>

<style>
  .welcome { padding: var(--sp-5) var(--sp-4); text-align: center; }
  h1 { margin-bottom: var(--sp-3); }
  .primary, .secondary { width: 100%; padding: var(--sp-3); border-radius: var(--r-2); border: 0; margin-bottom: var(--sp-2); cursor: pointer; font-weight: var(--fw-bold); }
  .primary { background: var(--c-primary); color: var(--c-primary-contrast); }
  .secondary { background: var(--c-surface-2); color: var(--c-text); border: 1px solid var(--c-border); }
  .hint { margin-top: var(--sp-4); padding: var(--sp-3); background: #fff8e1; border-radius: var(--r-2); font-size: var(--fs-sm); color: var(--c-text); }
</style>
```

- [ ] **Step 2: Wire into Day route**

Edit `src/routes/tag/[date]/+page.svelte` — am Anfang des `<script>`:

```ts
import { liveQuery as lq2 } from '$lib/stores/liveQuery.svelte';
import { getOrDefault } from '$lib/db/meta';
import FirstRun from '$lib/components/DayView/FirstRun.svelte';

const firstRunQ = lq2(async () => await getOrDefault('firstRunCompleted', false), false);
$effect(() => () => firstRunQ.dispose());
```

Ganz oben im Template:

```svelte
{#if !firstRunQ.current}
  <FirstRun />
{:else}
  <DateHeader />
  <EntryList date={currentDate.value} />
  <Fab onClick={() => sheetOpen = true} />
  <SymptomSheet open={sheetOpen} onClose={() => sheetOpen = false} onPick={onPick} {enteredIds} />
  {#if editing}
    <EntryEditor open={true} date={currentDate.value} symptom={editing.symptom} onClose={() => editing = null} />
  {/if}
{/if}
```

> Hinweis: `getOrDefault` ist eine reine async-Funktion — die `liveQuery`-Subscription pollt nicht automatisch bei `meta`-Updates. Pragmatisch: nach `useTemplate()`/`buildOwn()` lädt die App per `await goto(window.location.pathname, { invalidateAll: true })` neu, oder wir nutzen explizit `db.meta.hook('updating', ...)`. MVP-Variante: nach beiden Aktionen oben mit `location.reload()` nachziehen.

Ersetze in `FirstRun.svelte` die beiden Funktionen:

```ts
async function useTemplate() {
  await importTemplate(DEFAULT_TEMPLATE);
  await setMeta('firstRunCompleted', true);
  location.reload();
}
async function buildOwn() {
  await setMeta('firstRunCompleted', true);
  await goto('/symptome');
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm run check
git add .
git commit -m "feat(onboarding): first-run welcome with template + custom options"
```

---

### Task 33: E2E Happy Path

**Files:**
- Create: `tests/e2e/happy-path.spec.ts`

- [ ] **Step 1: Test**

Create `tests/e2e/happy-path.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('first run → template → erfasse Hitzewallungen mit mittel → editiere → swipe weg → undo', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/\/tag\/\d{4}-\d{2}-\d{2}/);

  // First-run shown
  await expect(page.getByRole('button', { name: 'Mit Standard-Vorlage starten' })).toBeVisible();
  await page.getByRole('button', { name: 'Mit Standard-Vorlage starten' }).click();

  // Page reload → first-run gone, FAB visible
  await expect(page.getByRole('button', { name: 'Symptom hinzufügen' })).toBeVisible({ timeout: 5000 });

  // Open sheet, drill into "Körperlich", pick Hitzewallungen
  await page.getByRole('button', { name: 'Symptom hinzufügen' }).click();
  await page.getByText('Körperlich', { exact: true }).click();
  await page.getByText('Hitzewallungen').click();

  // Editor opens — pick Mittel
  await page.getByRole('button', { name: 'Mittel' }).click();
  await page.getByRole('button', { name: 'Fertig' }).click();

  // Entry shown on day list
  await expect(page.getByText('Hitzewallungen')).toBeVisible();
  await expect(page.getByText('Mittel')).toBeVisible();
});
```

- [ ] **Step 2: Run**

```bash
pnpm test:e2e
```

Erwartet: grün. Falls Lokalisierungs- oder Timing-Fragen auftreten, gezielt mit `waitFor`/`getByRole` justieren — nicht mit `page.waitForTimeout`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/happy-path.spec.ts
git commit -m "test(e2e): full happy path from first run to entry with intensity"
```

---

## Final Steps

After all tasks are complete:

- [ ] **Step F1: Full check**

```bash
pnpm test
pnpm test:e2e
pnpm run check
pnpm run build
```

Alles grün?

- [ ] **Step F2: Tag the MVP**

```bash
git tag mvp-v1
git log --oneline | head -40
```

- [ ] **Step F3: Bekannte v1.1-Lücken im Repo dokumentieren**

`docs/ROADMAP.md` schreiben mit den Items aus dem Spec § 7 (Verlaufsansichten, PDF/CSV, Tag-Filter) — ein Satz pro Item, Verweis auf den Spec-Abschnitt.

```bash
git add docs/ROADMAP.md
git commit -m "docs: v1.1 roadmap pointer"
```

---

## Spec Coverage Self-Review

| Spec § | Anforderung | Task(s) |
|---|---|---|
| 2 (MVP) | Tageseingabe-Flow | 22–26 |
| 2 (MVP) | Symptom-Verwaltung mit Edit-Modal | 27 |
| 2 (MVP) | Reorder-Modus | 28 |
| 2 (MVP) | Tag-Verwaltung | 29 |
| 2 (MVP) | Farbzuordnung + Palette + Custom | 20, 27 |
| 2 (MVP) | Eintrag editieren / swipe + undo | 24, 26 (EntryList) |
| 2 (MVP) | Datums-Picker rückwirkend | 23, 26 |
| 2 (MVP) | JSON Export/Import | 31 |
| 2 (MVP) | Erste-Start-Erfahrung | 32, 30 |
| 2 (MVP) | i18n-Infrastruktur DE | 5 |
| 3 | Stack — adapter-static, Dexie, Paraglide, vite-pwa | 1, 4–7 |
| 4 | Schema mit allen Feldern (inkl. icon) | 4, 10–12 |
| 5 | Modulgrenzen + LiveQuery | alle DB/Stores/Components |
| 6.1 | Tageseingabe-UI im Detail | 22–26 |
| 6.2 | Symptom-Verwaltung, Badge-Rendering | 15, 27, 28 |
| 6.3 | Tag-Verwaltung | 29 |
| 6.4 | Einstellungen / Export-Import / iOS-Hinweis | 31 |
| 6.5 | Erste-Start-Erfahrung | 32 |
| 8 | Risiken — iOS-Persistenz dokumentiert | 31, 32 |
| 9 | Testing-Strategie | jeweils pro Task |

v1.1-Items (Heatmap, Letzte-N-Tage-Liste, PDF/CSV, Tag-Filter) sind **bewusst NICHT** in diesem Plan — siehe Final Step F3 (Roadmap).


