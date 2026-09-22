const rtf = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return rtf(m, 'min');
  const h = Math.round(m / 60);
  if (h < 24) return rtf(h, 'hr');
  const d = Math.round(h / 24);
  return d < 30 ? rtf(d, 'day') : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—';

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? `${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${fmtTime(iso)}` : '—';

/** 'YYYY-MM-DD' → 'Mon' */
export const weekday = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });

/** 'YYYY-MM-DD' → '14 Sep' */
export const shortDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const levelOfConfidence = (c: number): 'high' | 'medium' | 'low' => (c >= 70 ? 'high' : c >= 45 ? 'medium' : 'low');

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || 'U';
