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

// Bind a Dexie liveQuery to a Svelte $effect lifetime.
// `deps` is an optional thunk that reads the reactive values the query depends
// on (e.g., a `date` prop). Svelte tracks reads inside the effect body, so the
// thunk must touch every reactive value that, when changed, should re-subscribe
// the query. If the query closes over only constant values, omit `deps`.
// MUST be called inside a component or `$effect.root`.
export function liveQueryEffect<T>(
  query: () => Promise<T> | T,
  initial: T,
  deps?: () => unknown
): { readonly current: T } {
  let value = $state<T>(initial);
  $effect(() => {
    if (deps) deps(); // register reactive reads so $effect re-runs
    const sub = dexieLive(query).subscribe({
      next: (v) => { value = v as T; },
      error: (err) => { console.error('liveQuery error', err); }
    });
    return () => sub.unsubscribe();
  });
  return { get current() { return value; } };
}
