import { langStore, staffStore } from '../state/app';

export const BASE = `${import.meta.env.VITE_API_URL ?? ''}/v1`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const toApiError = (e: unknown): ApiError =>
  e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', e instanceof Error ? e.message : 'Something went wrong');

/* ───────────── anonymous identity ─────────────
   The device generates a random key once. The API stores only a keyed hash of it, so a report can
   never be tied to a person – only to "the same device as before" (needed for My Reports). */
const DEVICE_KEY = 'sanket.deviceKey';
const ANON_TOKEN = 'sanket.anonToken';

function deviceKey(): string {
  let k = localStorage.getItem(DEVICE_KEY);
  if (!k) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    k = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_KEY, k);
  }
  return k;
}

let inflight: Promise<string> | null = null;

export async function anonToken(force = false): Promise<string> {
  if (!force) {
    try {
      const t = JSON.parse(localStorage.getItem(ANON_TOKEN) ?? 'null') as { token: string; exp: number } | null;
      if (t && t.exp > Date.now() + 60_000) return t.token;
    } catch {
      /* ignore */
    }
  }
  inflight ??= (async () => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/anon/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceKey: deviceKey() }),
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', networkMessage);
    }
    if (!res.ok) throw await toError(res, 'none');
    const j = (await res.json()) as { token: string; expiresInSeconds: number };
    localStorage.setItem(ANON_TOKEN, JSON.stringify({ token: j.token, exp: Date.now() + j.expiresInSeconds * 1000 }));
    return j.token;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Forget this device's anonymous identity (a fresh one is created on the next request). */
export function resetAnonIdentity() {
  localStorage.removeItem(DEVICE_KEY);
  localStorage.removeItem(ANON_TOKEN);
}

/* ───────────── request helper ───────────── */
const networkMessage = "Can't reach the Sanket server. Check your connection and that the API is running.";

async function toError(res: Response, auth: Auth): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: unknown; requestId?: string } } | null = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error (e.g. proxy failure) */
  }
  const e = body?.error;
  if (res.status === 401 && auth === 'staff') staffStore.set(null); // session ended → App shows the login screen
  const fallback = res.status === 502 || res.status === 504 ? networkMessage : `Request failed (${res.status})`;
  return new ApiError(res.status, e?.code ?? (res.status >= 500 ? 'SERVER_ERROR' : 'ERROR'), e?.message ?? fallback, e?.details, e?.requestId);
}

type Auth = 'none' | 'anon' | 'staff';
type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  auth?: Auth;
  headers?: Record<string, string>;
  blob?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ''}`;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth ?? 'none';
  const send = async (forceAnon: boolean): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': langStore.get(), ...opts.headers };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth === 'anon') headers.Authorization = `Bearer ${await anonToken(forceAnon)}`;
    if (auth === 'staff') {
      const s = staffStore.get();
      if (!s) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue.');
      headers.Authorization = `Bearer ${s.token}`;
    }
    try {
      return await fetch(buildUrl(path, opts.query), {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', networkMessage);
    }
  };

  let res = await send(false);
  if (res.status === 401 && auth === 'anon') {
    // Expired token or a server that lost this identity (e.g. after "delete my data"): start a fresh session once.
    const code = (await res.clone().json().catch(() => null))?.error?.code as string | undefined;
    if (code && ['TOKEN_EXPIRED', 'INVALID_TOKEN', 'SESSION_NOT_FOUND'].includes(code)) res = await send(true);
  }
  if (!res.ok) throw await toError(res, auth);
  if (res.status === 204) return undefined as T;
  return (opts.blob ? await res.blob() : await res.json()) as T;
}

/** Human-friendly message for an error (used by every screen). */
export function friendly(e: ApiError): string {
  switch (e.code) {
    case 'NETWORK_ERROR': return networkMessage;
    case 'RATE_LIMITED': return 'You are doing that too often. Please wait a little and try again.';
    case 'PERMISSION_DENIED':
    case 'FORBIDDEN': return 'You do not have permission to view or do this.';
    case 'TOKEN_EXPIRED':
    case 'SESSION_REVOKED':
    case 'UNAUTHORIZED': return 'Your session has ended. Please sign in again.';
    case 'SERVER_ERROR':
    case 'INTERNAL_ERROR': return 'Something went wrong on our side. Please try again in a moment.';
    default: return e.message;
  }
}
