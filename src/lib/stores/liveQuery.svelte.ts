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
