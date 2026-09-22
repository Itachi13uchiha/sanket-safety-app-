import type { ReactNode } from 'react';
import { friendly, type ApiError } from '../../api/http';

export function Loading({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16 rounded-2xl" />
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry, compact }: { error: ApiError; onRetry?: () => void; compact?: boolean }) {
  const offline = error.code === 'NETWORK_ERROR';
  return (
    <div className={`bg-white border border-red-100 rounded-2xl text-center ${compact ? 'p-4' : 'p-8'}`} role="alert">
      <div className="text-3xl mb-2">{offline ? '📡' : error.status === 403 ? '🔒' : '⚠️'}</div>
      <p className="text-sm font-semibold text-slate-800">{offline ? "You're offline or the server is unreachable" : 'Something went wrong'}</p>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{friendly(error)}</p>
      {error.requestId && <p className="text-[10px] text-slate-300 mt-2 font-mono">Ref: {error.requestId.slice(0, 8)}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-4 px-4 py-2 bg-[#2D3BE8] text-white text-xs font-semibold rounded-xl">
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ icon = '📭', title, sub, action }: { icon?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AccessDenied({ what }: { what: string }) {
  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-8 text-center max-w-md">
      <div className="text-3xl mb-2">🔒</div>
      <p className="text-sm font-semibold text-slate-800">Access restricted</p>
      <p className="text-xs text-slate-500 mt-1">Your role does not include permission to {what}. Ask an administrator if you need access.</p>
    </div>
  );
}

export function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return <div className="text-[11px] text-slate-400 px-1 pt-3">{total} result{total === 1 ? '' : 's'}</div>;
  return (
    <div className="flex items-center justify-between px-1 pt-3">
      <span className="text-[11px] text-slate-400">{total} results · page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40">← Prev</button>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40">Next →</button>
      </div>
    </div>
  );
}
