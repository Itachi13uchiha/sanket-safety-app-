import { useState } from 'react';
import type { Screen } from '../../types';
import Sidebar from './Sidebar';
import StatusBadge from '../../components/StatusBadge';
import { authority, friendly, toApiError } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useStaff } from '../../hooks/useStaff';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { Empty, ErrorBox, Loading, Pager } from '../../components/ui/StateViews';

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'closed', label: 'Closed' },
];
const FILTERS = [{ label: 'All', value: undefined }, ...STATUSES.map((s) => ({ label: s.label, value: s.value as string | undefined }))];

export default function CaseManagement({ navigate }: { navigate: (s: Screen) => void }) {
  const { can } = useStaff();
  const manage = can('cases:manage');
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const list = useAsync(() => authority.cases({ status: filter, page, pageSize: 15 }), [filter, page]);
  const detail = useAsync(() => (selected ? authority.caseDetail(selected) : Promise.resolve(null)), [selected]);
  const assignees = useAsync(() => (manage ? authority.assignees() : Promise.resolve(null)), [manage]);
  const d = detail.data;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      detail.reload();
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: friendly(toApiError(e)) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F7FF]">
      <Sidebar active="auth-cases" navigate={navigate} />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-slate-200 px-8 py-4">
          <h1 className="text-xl font-bold text-slate-900">Case Management</h1>
          <p className="text-xs text-slate-400">{manage ? 'Track and manage active safety cases' : 'Cases assigned to you'}</p>
        </div>

        <div className="flex flex-1">
          <div className="flex-1 p-6 min-w-0">
            <div className="flex gap-1.5 mb-4">
              {FILTERS.map((f) => (
                <button key={f.label} onClick={() => { setFilter(f.value); setPage(1); }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${filter === f.value ? 'bg-[#2D3BE8] text-white' : 'bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{f.label}</button>
              ))}
            </div>

            {list.loading && !list.data && <Loading rows={4} />}
            {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
            {list.data && list.data.cases.length === 0 && (
              <Empty icon="📁" title="No cases yet"
                sub={manage ? 'Open a case from an alert to start tracking the response.' : 'Cases assigned to you will appear here.'}
                action={manage ? <button onClick={() => navigate('auth-alerts')} className="px-4 py-2 bg-[#2D3BE8] text-white text-xs font-semibold rounded-xl">Go to alerts</button> : undefined} />
            )}
            {list.data && list.data.cases.length > 0 && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Case ID', 'Related Pattern', 'Location', 'Status', 'Assigned Officer', 'Created', 'Action'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.data.cases.map((c) => (
                        <tr key={c.id} onClick={() => { setSelected(c.id); setMsg(null); }}
                          className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${selected === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 font-mono text-sm font-bold text-[#2D3BE8]">{c.id}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.patternId ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{c.location.label}</td>
                          <td className="px-4 py-3"><StatusBadge level={c.status} size="xs" /></td>
                          <td className="px-4 py-3 text-sm text-slate-600">{c.assignedOfficer?.name ?? <span className="text-slate-300">Unassigned</span>}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(c.createdAt)}</td>
                          <td className="px-4 py-3"><span className="text-xs text-[#2D3BE8] font-semibold px-2 py-1 bg-blue-50 rounded-lg">View</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={list.data.pagination.page} totalPages={list.data.pagination.totalPages} total={list.data.pagination.total} onPage={setPage} />
              </>
            )}
          </div>

          {selected && (
            <div className="w-96 bg-white border-l border-slate-200 p-5 overflow-y-auto animate-fade-in flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono font-bold text-[#2D3BE8]">{selected}</span>
                <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 text-xs flex items-center justify-center" aria-label="Close">✕</button>
              </div>
              {detail.loading && !d && <Loading rows={3} />}
              {detail.error && <ErrorBox error={detail.error} onRetry={detail.reload} compact />}

              {d && (<>
                <StatusBadge level={d.case.status} />
                <div className="text-sm font-semibold text-slate-800 mt-2">{d.case.title}</div>
                <div className="mt-3 space-y-3">
                  {[
                    { label: 'Area', value: d.case.location.label },
                    { label: 'Pattern', value: d.case.patternId ?? '—' },
                    { label: 'Priority', value: d.case.priority },
                    { label: 'Officer', value: d.case.assignedOfficer?.name ?? 'Unassigned' },
                    { label: 'Created', value: fmtDate(d.case.createdAt) },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between py-2 border-b border-slate-50">
                      <span className="text-xs text-slate-400">{r.label}</span>
                      <span className="text-xs font-semibold text-slate-700 capitalize">{r.value}</span>
                    </div>
                  ))}
                </div>

                {manage && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase">Status
                      <select value={d.case.status} disabled={busy} onChange={(e) => run(() => authority.updateCase(d.case.id, { status: e.target.value }), 'Status updated.')}
                        className="mt-1 w-full px-2 py-2 border-2 border-slate-200 rounded-xl text-xs text-slate-700 normal-case font-medium">
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </label>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase">Assigned to
                      <select value={d.case.assignedOfficer?.id ?? ''} disabled={busy} onChange={(e) => run(() => authority.updateCase(d.case.id, { assignedOfficerId: e.target.value || null }), 'Assignment updated.')}
                        className="mt-1 w-full px-2 py-2 border-2 border-slate-200 rounded-xl text-xs text-slate-700 normal-case font-medium">
                        <option value="">Unassigned</option>
                        {assignees.data?.assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>
                  </div>
                )}

                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Related Reports ({d.reports.length})</div>
                  {d.reports.slice(0, 8).map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-50">
                      <span className="font-mono text-xs text-slate-500">#{r.id}</span>
                      <StatusBadge level={r.status} size="xs" />
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Officer Notes</div>
                  <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                    {d.notes.length === 0 && <p className="text-xs text-slate-300">No notes yet.</p>}
                    {d.notes.map(n => (
                      <div key={n.id} className="bg-slate-50 rounded-xl p-2.5">
                        <div className="text-xs text-slate-700">{n.body}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{n.author} · {fmtDateTime(n.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
                    className="w-full h-20 text-xs p-3 rounded-xl border-2 border-slate-200 resize-none focus:outline-none focus:border-[#2D3BE8]" placeholder="Add investigation notes..." />
                </div>

                {msg && <p role="status" className={`mt-2 text-xs rounded-xl p-2.5 border ${msg.ok ? 'text-green-700 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg.text}</p>}
                <div className="mt-3 space-y-2">
                  <button disabled={busy || !note.trim()} onClick={() => run(async () => { await authority.addCaseNote(d.case.id, note.trim()); setNote(''); }, 'Note added.')}
                    className="w-full py-2.5 bg-[#1A237E] text-white text-xs font-semibold rounded-xl disabled:opacity-40">Add Note</button>
                  {manage && d.case.status !== 'closed' && (
                    <button disabled={busy} onClick={() => run(() => authority.updateCase(d.case.id, { status: 'closed' }), 'Case closed.')}
                      className="w-full py-2.5 bg-green-500 text-white text-xs font-semibold rounded-xl disabled:opacity-40">Close Case</button>
                  )}
                </div>

                <div className="mt-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Timeline</div>
                  {d.timeline.map((t, i) => (
                    <div key={i} className="text-[11px] text-slate-500 py-1 border-b border-slate-50 last:border-0">
                      {fmtDateTime(t.at)} · <span className="font-medium">{t.type.replace('_', ' ')}</span>{t.to ? ` → ${t.to}` : ''} · {t.actor}
                    </div>
                  ))}
                </div>
              </>)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
