import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
  /** React hook: re-renders the component whenever the value changes. */
  use(): T;
}

/** Tiny external store (no provider needed). Optionally persisted to local/session storage. */
export function createStore<T>(initial: T, opts: { key?: string; storage?: 'local' | 'session' } = {}): Store<T> {
  const area = (): Storage | null => {
    try {
      return opts.storage === 'session' ? window.sessionStorage : window.localStorage;
    } catch {
      return null;
    }
  };
  let value = initial;
  if (opts.key) {
    try {
      const raw = area()?.getItem(opts.key);
      if (raw != null) value = JSON.parse(raw) as T;
    } catch {
      /* corrupted or unavailable storage: fall back to the initial value */
    }
  }
  const listeners = new Set<() => void>();
  const get = () => value;
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const set = (next: T | ((prev: T) => T)) => {
    value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
    if (opts.key) {
      try {
        if (value == null) area()?.removeItem(opts.key);
        else area()?.setItem(opts.key, JSON.stringify(value));
      } catch {
        /* storage full / blocked: keep working in memory */
      }
    }
    listeners.forEach((l) => l());
  };
  return { get, set, subscribe, use: () => useSyncExternalStore(subscribe, get) };
}
