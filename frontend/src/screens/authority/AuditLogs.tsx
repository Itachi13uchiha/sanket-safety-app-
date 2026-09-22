import { useState } from 'react';
import type { Screen } from '../../types';
import Sidebar from './Sidebar';
import { authority, friendly, toApiError } from '../../api';
import { useAsync, useDebounced } from '../../hooks/useAsync';
import { useStaff } from '../../hooks/useStaff';
import { fmtDateTime } from '../../lib/format';
import { AccessDenied, Empty, ErrorBox, Loading, Pager } from '../../components/ui/StateViews';

const RESULT_STYLE = { success: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700', denied: 'bg-amber-100 text-amber-700' };

export default function AuditLogs({ navigate }: { navigate: (s: Screen) => void }) {
  const { can } = useStaff();
  const allowed = can('audit:view');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [action, setAction] = useState('');
  const [result, setResult] = useState('');
  const [page, setPage] = useState(1);
  const [verify, setVerify] = useState<{ ok: boolean; text: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const list = useAsync(
    () => (allowed ? authority.auditLogs({ q: q || undefined, action: action || undefined, result: result || undefined, page, pageSize: 20 }) : Promise.resolve(null)),
    [q, action, result, page, allowed],
  );

  const runVerify = async () => {
    setVerifying(true);
    try {
      const r = await authority.verifyAudit();
      setVerify(r.valid
        ? { ok: true, text: `Integrity verified · ${r.checked} entries form an unbroken hash chain.` }
        : { ok: false, text: `Tampering detected: the chain breaks at entry #${r.brokenAtSeq}.` });
    } catch (e) {
      setVerify({ ok: false, text: friendly(toApiError(e)) });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F7FF]">
      <Sidebar active="auth-audit" navigate={navigate} />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Audit Logs</h1>
            <p className="text-xs text-slate-400">Append-only, hash-chained log · every access and action is recorded</p>
          </div>
          {allowed && <button onClick={runVerify} disabled={verifying} className="px-4 py-2 bg-[#1A237E] text-white text-xs font-semibold rounded-xl disabled:opacity-50">{verifying ? 'Verifying…' : 'Verify Integrity'}</button>}
        </div>

        <div className="p-8">
          {!allowed ? <AccessDenied what="view audit logs" /> : (<>
          {verify ? (
            <div role="status" className={`rounded-2xl p-4 mb-4 flex items-center gap-3 border ${verify.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <span className="text-xl">{verify.ok ? '✅' : '🚨'}</span><p className="text-sm">{verify.text}</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
              <span className="text-xl">🔐</span>
              <p className="text-sm text-amber-800">Each entry is cryptographically chained to the previous one, so edits or deletions are detectable. Use “Verify Integrity” to check the whole log.</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
              <div className="flex-1 relative">
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search logs..." className="w-full pl-10 pr-4 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2D3BE8]" />
              </div>
              <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="px-3 py-2 border-2 border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none">
                <option value="">All Actions</option>
                {list.data?.actions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }} className="px-3 py-2 border-2 border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none">
                <option value="">Any result</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="denied">Denied</option>
              </select>
            </div>

            {list.loading && !list.data && <div className="p-4"><Loading rows={4} /></div>}
            {list.error && <div className="p-4"><ErrorBox error={list.error} onRetry={list.reload} compact /></div>}
            {list.data && list.data.logs.length === 0 && <div className="p-6"><Empty icon="🔍" title="No log entries match" /></div>}

            {list.data && list.data.logs.length > 0 && (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Timestamp', 'User / Officer', 'Action', 'Resource', 'IP Address', 'Result'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.data.logs.map((l) => (
                    <tr key={l.id} className={`border-b border-slate-50 last:border-0 ${l.result === 'failed' ? 'bg-red-50' : l.result === 'denied' ? 'bg-amber-50' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(l.timestamp)}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 font-medium">{l.actor.label}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{l.action}</td>
                      <td className="px-4 py-3 text-xs font-mono text-blue-600">{l.resource ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{l.ip ?? '—'}</td>
                      <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RESULT_STYLE[l.result]}`}>{l.result}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {list.data && <Pager page={list.data.pagination.page} totalPages={list.data.pagination.totalPages} total={list.data.pagination.total} onPage={setPage} />}
          </>)}
        </div>
      </main>
    </div>
  );
}
