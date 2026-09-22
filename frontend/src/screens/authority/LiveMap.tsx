import { useState } from 'react';
import type { Screen } from '../../types';
import Sidebar from './Sidebar';
import MapView, { fitView, type MapPoint } from '../../components/MapView';
import StatusBadge from '../../components/StatusBadge';
import { authority, friendly, toApiError, type Range } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useStaff } from '../../hooks/useStaff';
import { DEFAULT_LOCATION } from '../../state/app';
import { fmtDate, levelOfConfidence } from '../../lib/format';
import { Empty, ErrorBox, Loading } from '../../components/ui/StateViews';

const RANGES: { label: string; value: Range }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
];
const barColor = (c: number) => (c >= 70 ? '#EF4444' : c >= 45 ? '#F59E0B' : '#10B981');

export default function LiveMap({ navigate }: { navigate: (s: Screen) => void }) {
  const { can } = useStaff();
  const [range, setRange] = useState<Range>('month');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const map = useAsync(() => authority.map({ range }), [range]);
  const patterns = map.data?.patterns ?? [];
  const selId = selected ?? patterns[0]?.id ?? null;
  const detail = useAsync(() => (selId ? authority.pattern(selId) : Promise.resolve(null)), [selId]);

  const points: MapPoint[] = patterns.map((p) => ({
    id: p.id, lat: p.location.lat, lng: p.location.lng, level: levelOfConfidence(p.confidence), label: p.area, count: p.distinctReporters,
    sub: `${p.status.label} · ${p.confidence}% confidence`,
  }));
  const view = fitView(points, DEFAULT_LOCATION);
  const d = detail.data;
  const p = d?.pattern;

  const act = async (status: 'monitoring' | 'escalated' | 'resolved') => {
    if (!p) return;
    setBusy(true);
    setActionError(null);
    try {
      await authority.setPatternStatus(p.id, status);
      detail.reload();
      map.reload();
    } catch (e) {
      setActionError(friendly(toApiError(e)));
    } finally {
      setBusy(false);
    }
  };
  const allowed = (a: string) => can('alerts:escalate') && !!d?.allowedActions.includes(a);

  return (
    <div className="flex min-h-screen bg-[#F5F7FF]">
      <Sidebar active="auth-live-map" navigate={navigate} />

      <main className="flex-1 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Live Safety Map</h1>
            <p className="text-xs text-slate-400">Geographic pattern clusters · number = distinct reporters</p>
          </div>
          <div className="flex gap-2">
            {RANGES.map(f => (
              <button key={f.value} onClick={() => { setRange(f.value); setSelected(null); }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold ${f.value === range ? 'bg-[#2D3BE8] text-white' : 'bg-slate-100 text-slate-500'}`}>{f.label}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 gap-0">
          {/* Map */}
          <div className="flex-1 p-4">
            <div className="h-full min-h-[500px] rounded-2xl overflow-hidden shadow-md">
              {map.error
                ? <div className="p-6"><ErrorBox error={map.error} onRetry={map.reload} /></div>
                : <MapView points={points} center={view.center} radiusKm={view.radiusKm} showCenter={false} selectedId={selId ?? undefined} onPointClick={(pt) => setSelected(pt.id)} />}
            </div>
          </div>

          {/* Pattern Details Panel */}
          <div className="w-72 bg-white border-l border-slate-200 p-5 overflow-y-auto">
            <h3 className="font-semibold text-slate-800 mb-4">Pattern Details</h3>

            {(map.loading && !map.data) || (detail.loading && !d) ? <Loading rows={3} /> : null}
            {detail.error && <ErrorBox error={detail.error} onRetry={detail.reload} compact />}

            {p && d ? (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <StatusBadge level={p.status.code} />
                  <div className="font-bold text-slate-900 text-base mt-2">{p.area}</div>
                  <div className="text-xs text-slate-400 font-mono">{p.id}</div>
                </div>

                <div className="space-y-2.5">
                  <InfoRow label="Incident Type" value={p.category.label} />
                  <InfoRow label="Distinct Reporters" value={String(p.distinctReporters)} />
                  <InfoRow label="Time Periods" value={String(p.distinctPeriods)} />
                  <InfoRow label="First Seen" value={fmtDate(p.firstSeenAt)} />
                  <InfoRow label="Confidence" value={`${p.confidence}%`} />
                  <InfoRow label="Pattern Status" value={p.status.label} />
                  <InfoRow label="Peak Time" value={p.peakWindow?.label ?? 'Varies'} />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Confidence Indicator</span>
                    <span className="font-semibold text-blue-600">{p.confidence}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${p.confidence}%`, background: barColor(p.confidence) }} />
                  </div>
                </div>

                {d.signals.components && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Signal breakdown</div>
                    {([['Reporters', d.signals.components.reporters], ['Time diversity', d.signals.components.temporal], ['Clustering', d.signals.components.spatial], ['Integrity', d.signals.components.integrity]] as [string, number][]).map(([l, v]) => (
                      <div key={l} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-20">{l}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#2D3BE8] rounded-full" style={{ width: `${Math.round(v * 100)}%` }} /></div>
                        <span className="text-[10px] font-semibold text-slate-600 w-8 text-right">{Math.round(v * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {actionError && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2">{actionError}</p>}
                <div className="space-y-2 pt-2">
                  <button disabled={busy || !allowed('monitoring')} onClick={() => act('monitoring')} className="w-full py-2.5 bg-[#1A237E] text-white text-sm font-semibold rounded-xl disabled:opacity-40">Start Monitoring</button>
                  <button disabled={busy || !allowed('escalated')} onClick={() => act('escalated')} className="w-full py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40">Escalate</button>
                  <button disabled={busy || !allowed('resolved')} onClick={() => act('resolved')} className="w-full py-2.5 border-2 border-slate-200 text-slate-600 text-sm font-semibold rounded-xl disabled:opacity-40">Mark Resolved</button>
                </div>
              </div>
            ) : (
              !map.loading && !detail.loading && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🗺️</div>
                  <p className="text-sm text-slate-400">{patterns.length ? 'Click on a cluster to view pattern details' : 'No patterns in this time range'}</p>
                </div>
              )
            )}

            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">All Patterns</div>
              {map.data && patterns.length === 0 && <Empty icon="🌿" title="Nothing here" sub="No active patterns for this range." />}
              <div className="space-y-2">
                {patterns.map(c => (
                  <button key={c.id} onClick={() => setSelected(c.id)}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-left transition-colors ${selId === c.id ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.confidence >= 70 ? 'bg-red-500' : c.confidence >= 45 ? 'bg-amber-500' : 'bg-green-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-700 truncate">{c.area}</div>
                      <div className="text-[10px] text-slate-400">{c.category.label} · {c.distinctReporters} reporters</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-semibold text-slate-700 text-right">{value}</span>
    </div>
  );
}
