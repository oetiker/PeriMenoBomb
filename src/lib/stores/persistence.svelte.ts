import { isPersistenceSupported, requestPersistentStorage } from '$lib/db/persist';

// Observable storage-persistence state. Without this the persist() result was
// discarded, so when Chrome left an origin evictable (the cause of users losing
// weeks of data) nothing surfaced it. `unprotected` means the browser COULD
// persist but hasn't granted it — the state worth warning about.
export type PersistenceStatus =
  | 'unknown' // not yet checked
  | 'persisted' // granted — protected from eviction
  | 'unsupported' // API absent (e.g. iOS Safari — covered by its own hint)
  | 'unprotected'; // supported but not granted — data may be evicted

let _status = $state<PersistenceStatus>('unknown');

export const persistence = {
  get status(): PersistenceStatus {
    return _status;
  },
  // True only when the browser can persist but hasn't — the actionable warning.
  get atRisk(): boolean {
    return _status === 'unprotected';
  }
};

// Request persistence and record the outcome. Fire-and-forget from app startup;
// best-effort, never throws (requestPersistentStorage swallows errors).
export async function initPersistence(): Promise<void> {
  if (!isPersistenceSupported()) {
    _status = 'unsupported';
    return;
  }
  _status = (await requestPersistentStorage()) ? 'persisted' : 'unprotected';
}
