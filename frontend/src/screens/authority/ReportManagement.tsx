import { useState } from 'react';
import type { Screen } from '../../types';
import Sidebar from './Sidebar';
import StatusBadge from '../../components/StatusBadge';
import { authority, friendly, toApiError } from '../../api';
import { useAsync, useDebounced } from '../../hooks/useAsync';
import { useStaff } from '../../hooks/useStaff';
import { fmtDateTime } from '../../lib/format';
import { AccessDenied, Empty, ErrorBox, Loading, Pager } from '../../components/ui/StateViews';

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'New', value: 'new' },
  { label: 'Linked', value: 'linked' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Dismissed', value: 'dismissed' },
];
const TRUST: Record<string, string> = { new: 'New device (lower weight)', established: 'Established device', reduced: 'Reduced (past dismissals)' };

export default function ReportManagement({ navigate }: { navigate: (s: Screen) => void }) {
  const { can } = useStaff();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const allowed = can('reports:view');
  const list = useAsync(() => (allowed ? authority.reports({ q: q || undefined, status, page, pageSize: 15 }) : Promise.resolve(null)), [q, status, page, allowed]);
  const detail = useAsync(() => (selected ? authority.report(selected) : Promise.resolve(null)), [selected]);
  const r = detail.data;

  const review = async (decision: 'confirm' | 'dismiss' | 'spam') => {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    try {
      await authority.reviewReport(selected, decision);
      setMsg({ ok: true, text: decision === 'confirm' ? 'Report confirmed.' : decision === 'dismiss' ? 'Report dismissed; the pattern was re-scored.' : 'Marked as spam; the reporter\'s weight was reduced.' });
      detail.reload();
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: friendly(toApiError(e)) });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await authority.exportReportsCsv({ q: q || undefined, status });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sanket-reports.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg({ ok: false, text: friendly(toApiError(e)) });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F7FF]">
      <Sidebar active="auth-reports" navigate={navigate} />

      <main className="flex-1 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Report Management</h1>
            <p className="text-xs text-slate-400">View and manage incoming safety reports</p>
          </div>
          {can('data:export') && <button onClick={exportCsv} className="px-4 py-2 bg-[#1A237E] text-white text-xs font-semibold rounded-xl">Export CSV</button>}
        </div>

        {!allowed ? <div className="p-8"><AccessDenied what="view individual reports" /></div> : (
        <div className="flex flex-1 gap-0">
          {/* Table */}
          <div className="flex-1 p-6 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 relative">
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by type, location, or ID..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2D3BE8] transition-colors" />
              </div>
              <div className="flex gap-1.5">
                {FILTERS.map(f => (
                  <button key={f.label} onClick={() => { setStatus(f.value); setPage(1); }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${status === f.value ? 'bg-[#2D3BE8] text-white' : 'bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
            {list.loading && !list.data && <Loading rows={5} />}
            {list.data && list.data.reports.length === 0 && <Empty icon="📋" title="No reports match" sub="Try a different search or status filter." />}

            {list.data && list.data.reports.length > 0 && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Report ID', 'Incident Type', 'Location', 'Time', 'Status', 'Pattern', 'Action'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.data.reports.map((row) => (
                        <tr key={row.id} onClick={() => { setSelected(row.id); setMsg(null); }}
                          className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${selected === row.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">#{row.id}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.category.label}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{row.location.label}</td>
                          <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDateTime(row.submittedAt)}</td>
                          <td className="px-4 py-3"><StatusBadge level={row.status} size="xs" /></td>
                          <td className="px-4 py-3 text-xs font-mono text-blue-500">{row.patternId ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-[#2D3BE8] font-semibold px-2 py-1 bg-blue-50 rounded-lg">View</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={list.data.pagination.page} totalPages={list.data.pagination.totalPages} total={list.data.pagination.total} onPage={setPage} />
              </>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-80 bg-white border-l border-slate-200 p-5 overflow-y-auto animate-fade-in flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Report Details</h3>
                <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs" aria-label="Close">✕</button>
              </div>
              {detail.loading && !r && <Loading rows={3} />}
              {detail.error && <ErrorBox error={detail.error} onRetry={detail.reload} compact />}
              {r && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-[#2D3BE8]">#{r.id}</span>
                    <StatusBadge level={r.status} />
                  </div>
                  {[
                    { label: 'Incident Type', value: r.category.label },
                    { label: 'Location', value: r.location.label },
                    { label: 'Reported', value: fmtDateTime(r.submittedAt) },
                    { label: 'Happened', value: r.time.label },
                    { label: 'Pattern', value: r.patternId ?? '—' },
                    { label: 'Reporter weight', value: TRUST[r.integrity.reporterTrust] ?? r.integrity.reporterTrust },
                    { label: 'Anonymous', value: 'Yes · Identity Protected' },
                  ].map(row => (
                    <div key={row.label} className="flex items-start justify-between gap-3 py-2 border-b border-slate-50">
                      <span className="text-xs text-slate-400 flex-shrink-0">{row.label}</span>
                      <span className="text-xs font-semibold text-slate-700 text-right">{row.value}</span>
                    </div>
                  ))}
                  {r.integrity.flaggedImplausibleTravel && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">⚠ Flagged: implausible travel between this device's reports. Excluded from patterns.</p>}
                  {r.note && <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3"><div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Note</div>{r.note}</div>}
                  {r.review && <div className="text-[11px] text-slate-500">Reviewed by {r.review.by} on {fmtDateTime(r.review.at)}</div>}

                  {msg && <p role="status" className={`text-xs rounded-xl p-2.5 border ${msg.ok ? 'text-green-700 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg.text}</p>}
                  {(r.status === 'new' || r.status === 'linked') && (
                    <div className="pt-2 space-y-2">
                      <button disabled={busy} onClick={() => review('confirm')} className="w-full py-2.5 bg-green-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50">Confirm Report</button>
                      <button disabled={busy} onClick={() => review('dismiss')} className="w-full py-2.5 border-2 border-slate-200 text-slate-600 text-xs font-semibold rounded-xl disabled:opacity-50">Dismiss</button>
                      <button disabled={busy} onClick={() => review('spam')} className="w-full py-2.5 border-2 border-red-200 text-red-500 text-xs font-semibold rounded-xl disabled:opacity-50">Mark as Spam</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </main>
    </div>
  );
}
