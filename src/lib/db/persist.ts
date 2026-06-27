// Ask the browser to mark this origin's storage as persistent so the user's
// IndexedDB data is not silently evicted under storage pressure.
//
// Without this, Chrome (notably on Android) stores PWA data as "best-effort"
// and may wipe the whole origin to reclaim quota — which surfaced as a user
// losing weeks of data and being dropped back to the welcome screen.
//
// Best-effort and side-effect-free on failure: the Storage API may be absent,
// and in a non-secure context (e.g. LAN testing on iOS Safari) the call can
// throw. We feature-detect and swallow errors, returning whether persistence
// is in effect.
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
