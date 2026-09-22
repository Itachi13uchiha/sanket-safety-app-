import { useState } from 'react';
import type { Screen } from '../../types';
import Sidebar from './Sidebar';
import StatusBadge from '../../components/StatusBadge';
import { authority, friendly, toApiError } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useStaff } from '../../hooks/useStaff';
import { fmtDateTime } from '../../lib/format';
import { Empty, ErrorBox, Loading } from '../../components/ui/StateViews';

const STATUS_FILTERS = [
  { label: 'Active', value: undefined },
  { label: 'Resolved', value: 'resolved' },
];

const eventText = (type: string, d: Record<string, unknown> | null) => {
  switch (type) {
    case 'detected': return 'Pattern first detected';
    case 'emerged': return 'Emerging pattern flagged — alert raised';
    case 'status': return `Status changed: ${String(d?.from)} → ${String(d?.to)}${d?.note ? ` (“${String(d.note)}”)` : ''}`;
    case 'merged_in': return 'Nearby pattern merged into this one';
    case 'auto_resolved': return 'Closed automatically after a quiet period';
    case 'evidence_withdrawn': return 'Closed — supporting reports were withdrawn';
    default: return type.replace(/_/g, ' ');
  }
};

export default function AlertManagement({ navigate }: { navigate: (s: Screen) => void }) {
  const { can } = useStaff();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const list = useAsync(() => authority.alerts({ status: filter, pageSize: 50 }), [filter]);
  const alerts = (list.data?.alerts ?? []).filter((a) => filter || a.status !== 'resolved');
  const selId = selectedId ?? alerts[0]?.id ?? null;
  const detail = useAsync(() => (selId ? authority.alert(selId) : Promise.resolve(null)), [selId]);
  const d = detail.data;

  const act = async (action: 'start_monitoring' | 'escalate' | 'resolve') => {
    if (!selId) return;
    setBusy(true);
    setMsg(null);
    try {
      await authority.alertAction(selId, action, note);
      setNote('');
      setMsg({ ok: true, text: 'Done. The action was recorded in the audit log.' });
      detail.reload();
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: friendly(toApiError(e)) });
    } finally {
      setBusy(false);
    }
  };

  const createCase = async () => {
    if (!d) return;
    setBusy(true);
    setMsg(null);
    try {
      await authority.createCase({ patternId: d.pattern.id });
      navigate('auth-cases');
    } catch (e) {
      setMsg({ ok: false, text: friendly(toApiError(e)) });
    } finally {
      setBusy(false);
    }
  };

  const allowed = (a: string) => can('alerts:escalate') && !!d?.allowedActions.includes(a);
  const comps = d?.signals.components;

  return (
    <div className="flex min-h-screen bg-[#F5F7FF]">
      <Sidebar active="auth-alerts" navigate={navigate} />

      <main className="flex-1 flex">
        {/* Alert list */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          <div className="px-5 py-5 border-b border-slate-100">
            <h1 className="text-lg font-bold text-slate-900">Alert Management</h1>
            <p className="text-xs text-slate-400">Emerging patterns requiring attention</p>
            <div className="flex gap-2 mt-3">
              {STATUS_FILTERS.map((f) => (
                <button key={f.label} onClick={() => { setFilter(f.value); setSelectedId(null); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === f.value ? 'bg-[#2D3BE8] text-white' : 'bg-slate-100 text-slate-500'}`}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {list.loading && !list.data && <Loading rows={3} />}
            {list.error && <ErrorBox error={list.error} onRetry={list.reload} compact />}
            {list.data && alerts.length === 0 && <Empty icon="✅" title="No alerts" sub="Alerts are raised automatically when a pattern becomes emerging." />}
            {alerts.map(a => (
              <button key={a.id} onClick={() => { setSelectedId(a.id); setMsg(null); }}
                className={`w-full p-4 rounded-2xl text-left transition-all border-2 ${selId === a.id ? 'border-[#2D3BE8] bg-blue-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <StatusBadge level={a.patternStatus === 'emerging' || a.patternStatus === 'escalated' || a.patternStatus === 'monitoring' || a.patternStatus === 'resolved' ? a.patternStatus : 'monitoring'} />
                  <span className="text-[10px] font-bold text-blue-600">{a.confidence}%</span>
                </div>
                <div className="text-sm font-semibold text-slate-800">{a.area}</div>
                <div className="text-xs text-slate-400 mt-0.5">{a.category}</div>
                <div className="flex gap-3 mt-2">
                  <span className="text-[10px] text-slate-400">{a.distinctReporters} reporters</span>
                  <span className="text-[10px] text-slate-400">{a.distinctPeriods} periods</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl">
            {detail.loading && !d && <Loading rows={3} />}
            {detail.error && <ErrorBox error={detail.error} onRetry={detail.reload} />}
            {!selId && !list.loading && !detail.loading && <Empty icon="🔔" title="Select an alert" sub="Choose an alert on the left to see the evidence and take action." />}

            {d && d.alert && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs text-slate-400 font-mono mb-1">{d.alert.id} · {d.pattern.id}</div>
                    <h2 className="text-xl font-bold text-slate-900">{d.pattern.area}</h2>
                    <p className="text-sm text-slate-500">{d.pattern.category.label}</p>
                  </div>
                  <StatusBadge level={d.pattern.status.code} />
                </div>

                <div className="grid grid-cols-3 gap-4 mb-5">
                  <Stat label="Distinct Reporters" value={String(d.pattern.distinctReporters)} color="text-red-600" />
                  <Stat label="Reporting Periods" value={String(d.pattern.distinctPeriods)} color="text-amber-600" />
                  <Stat label="Confidence" value={`${d.pattern.confidence}%`} color="text-blue-600" />
                </div>

                {comps && (
                  <div className="mb-5">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Why this is a pattern (not just volume)</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {([['Independent reporters', comps.reporters], ['Time diversity', comps.temporal], ['Geographic clustering', comps.spatial], ['Integrity checks', comps.integrity]] as [string, number][]).map(([l, v]) => (
                        <div key={l}>
                          <div className="flex justify-between text-[11px] text-slate-500 mb-0.5"><span>{l}</span><span className="font-semibold">{Math.round(v * 100)}%</span></div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#2D3BE8] rounded-full" style={{ width: `${Math.round(v * 100)}%` }} /></div>
                        </div>
                      ))}
                    </div>
                    {(d.signals.burstRatio ?? 0) > 0.6 && <p className="mt-2 text-[11px] text-amber-700">⚠ Many reports arrived within a short window ({Math.round((d.signals.burstRatio ?? 0) * 100)}%).</p>}
                    {(d.signals.duplicateRatio ?? 0) > 0 && <p className="mt-1 text-[11px] text-amber-700">⚠ Some notes are near-identical across reporters.</p>}
                  </div>
                )}

                {/* Timeline */}
                <div className="mb-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pattern Timeline</div>
                  <div className="space-y-2.5">
                    {d.history.map((h, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full mt-0.5 ${i === d.history.length - 1 ? 'bg-red-500' : 'bg-blue-300'}`} />
                          {i < d.history.length - 1 && <div className="w-0.5 h-4 bg-slate-200 mt-1" />}
                        </div>
                        <span className="text-sm text-slate-600">{fmtDateTime(h.at)} · {eventText(h.type, h.detail)}{h.actor ? ` · ${h.actor}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended action */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
                  <div className="text-xs font-semibold text-amber-700 mb-1">Recommended Monitoring Action</div>
                  <p className="text-sm text-amber-800">{d.alert.recommendedAction}</p>
                </div>

                {msg && <p role="status" className={`mb-3 text-xs rounded-xl p-3 border ${msg.ok ? 'text-green-700 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg.text}</p>}
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Optional note for the audit trail…"
                  className="w-full mb-3 px-4 py-2.5 text-sm rounded-xl border-2 border-slate-200 focus:outline-none focus:border-[#2D3BE8]" />

                {/* Actions */}
                <div className="flex gap-3">
                  <button disabled={busy || !allowed('monitoring')} onClick={() => act('start_monitoring')} className="flex-1 py-3 bg-[#1A237E] text-white font-semibold rounded-xl text-sm disabled:opacity-40">Start Monitoring</button>
                  <button disabled={busy || !allowed('escalated')} onClick={() => act('escalate')} className="flex-1 py-3 bg-amber-500 text-white font-semibold rounded-xl text-sm disabled:opacity-40">Escalate</button>
                  <button disabled={busy || !allowed('resolved')} onClick={() => act('resolve')} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl text-sm disabled:opacity-40">Mark Resolved</button>
                </div>
                {can('cases:manage') && d.pattern.status.code !== 'resolved' && (
                  d.cases.length === 0
                    ? <button disabled={busy} onClick={createCase} className="w-full mt-3 py-2.5 border-2 border-[#2D3BE8] text-[#2D3BE8] font-semibold rounded-xl text-sm disabled:opacity-40">+ Open a case for this pattern</button>
                    : <p className="mt-3 text-xs text-slate-400 text-center">Case {d.cases[0]!.id} is already open for this pattern.</p>
                )}
                {!can('alerts:escalate') && <p className="mt-3 text-xs text-slate-400 text-center">Your role can view alerts but not act on them.</p>}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
