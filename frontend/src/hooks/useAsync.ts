import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { toApiError, type ApiError } from '../api/http';

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (d: T | null) => void;
}

/** Runs `fn` on mount and whenever `deps` change; ignores results from superseded runs. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (id === run.current) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (id === run.current) {
          setError(toApiError(e));
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
