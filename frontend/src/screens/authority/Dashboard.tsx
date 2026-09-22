import type { Screen } from '../../types';
import Sidebar from './Sidebar';
import StatusBadge from '../../components/StatusBadge';
import MapView, { fitView, type MapPoint } from '../../components/MapView';
import NotificationBell from '../../components/NotificationBell';
import { authority } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { DEFAULT_LOCATION } from '../../state/app';
import { fmtTime, levelOfConfidence, weekday } from '../../lib/format';
import { ErrorBox, Loading } from '../../components/ui/StateViews';

const delta = (v: number, prev: number, unit: string) => {
  const d = v - prev;
  return `${d >= 0 ? '+' : ''}${d} ${unit}`;
};

export default function Dashboard({ navigate }: { navigate: (s: Screen) => void }) {
  const q = useAsync(() => authority.dashboard(), []);
  const d = q.data;

  const metrics = d ? [
    { label: 'Active Patterns',  value: String(d.metrics.activeEmergingPatterns.value), delta: delta(d.metrics.activeEmergingPatterns.value, d.metrics.activeEmergingPatterns.previous, 'vs yesterday'), color: 'text-red-600',    bg: 'bg-red-50',    icon: '🔴' },
    { label: 'Reports Today',    value: String(d.metrics.reportsToday.value),           delta: delta(d.metrics.reportsToday.value, d.metrics.reportsToday.previous, 'vs yesterday'),                     color: 'text-blue-600',   bg: 'bg-blue-50',   icon: '📋' },
    { label: 'Areas Monitored',  value: String(d.metrics.areasMonitored.value),         delta: 'Active zones',                                                                                          color: 'text-purple-600', bg: 'bg-purple-50', icon: '📍' },
    { label: 'Alerts Generated', value: String(d.metrics.alertsGenerated.value),        delta: `${d.metrics.alertsGenerated.open} open`,                                                                 color: 'text-amber-600',  bg: 'bg-amber-50',  icon: '🔔' },
  ] : [];

  const points: MapPoint[] = (d?.liveMap ?? []).map((m) => ({
    id: m.id, lat: m.lat, lng: m.lng, level: levelOfConfidence(m.confidence), label: m.area, count: m.confidence, sub: `${m.status} · ${m.confidence}% confidence`,
  }));
  const view = fitView(points, DEFAULT_LOCATION);
  const trend = d?.trend ?? [];
  const trendMax = Math.max(1, ...trend.map((t) => t.reports));

  return (
    <div className="flex min-h-screen bg-[#F5F7FF]">
      <Sidebar active="auth-dashboard" navigate={navigate} />

      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Authority Dashboard</h1>
            <p className="text-xs text-slate-400">Live · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-green-700">Live Monitoring</span>
            </div>
            <NotificationBell />
          </div>
        </div>

        <div className="p-8 space-y-6">
          {q.loading && !d && <Loading rows={4} />}
          {q.error && <ErrorBox error={q.error} onRetry={q.reload} />}
          {d && (<>
          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-4">
            {metrics.map((m, i) => (
              <div key={i} className={`${m.bg} rounded-2xl p-5 border border-white`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{m.icon}</span>
                  <span className="text-xs font-medium text-slate-500 bg-white/70 px-2 py-0.5 rounded-full">{m.delta}</span>
                </div>
                <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
                <div className="text-xs font-medium text-slate-600 mt-1">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Map + Patterns */}
          <div className="grid grid-cols-5 gap-4">
            {/* Map */}
            <div className="col-span-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">Live Safety Map</h3>
                  <p className="text-xs text-slate-400">Active pattern clusters · number = confidence %</p>
                </div>
                <button onClick={() => navigate('auth-live-map')} className="text-xs text-[#2D3BE8] font-semibold">Full Map →</button>
              </div>
              <div className="h-64">
                <MapView points={points} center={view.center} radiusKm={view.radiusKm} showCenter={false} onPointClick={() => navigate('auth-live-map')} />
              </div>
            </div>

            {/* Patterns */}
            <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Emerging Patterns</h3>
                <button onClick={() => navigate('auth-live-map')} className="text-xs text-[#2D3BE8] font-semibold">View All</button>
              </div>
              <div className="space-y-3">
                {d.emergingPatterns.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No emerging patterns right now.</p>}
                {d.emergingPatterns.map((p) => (
                  <button key={p.id} onClick={() => navigate('auth-live-map')}
                    className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-left hover:bg-slate-100 transition-colors">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{p.area}</div>
                      <div className="text-xs text-slate-400">{p.category.label}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <StatusBadge level={p.status.code} size="xs" />
                        <span className="text-[10px] text-slate-400">{p.distinctReporters} reporters</span>
                        <span className="text-[10px] font-semibold text-blue-600">{p.confidence}% conf.</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reports + Trend */}
          <div className="grid grid-cols-5 gap-4">
            {/* Recent Reports */}
            {d.recentReports ? (
            <div className="col-span-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Recent Reports</h3>
                <button onClick={() => navigate('auth-reports')} className="text-xs text-[#2D3BE8] font-semibold">View All →</button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left pb-2">ID</th>
                    <th className="text-left pb-2">Type</th>
                    <th className="text-left pb-2">Location</th>
                    <th className="text-left pb-2">Time</th>
                    <th className="text-left pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentReports.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-xs text-slate-400">No reports yet.</td></tr>}
                  {d.recentReports.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => navigate('auth-reports')}>
                      <td className="py-2.5 font-mono text-xs text-slate-400">#{r.id}</td>
                      <td className="py-2.5 text-sm font-medium text-slate-700">{r.category.label}</td>
                      <td className="py-2.5 text-xs text-slate-500">{r.location.label}</td>
                      <td className="py-2.5 text-xs text-slate-400">{fmtTime(r.submittedAt)}</td>
                      <td className="py-2.5"><StatusBadge level={r.status} size="xs" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="col-span-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-xs text-slate-400 flex items-center justify-center">Recent reports are not available for your role.</div>
            )}

            {/* Trend chart */}
            <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="mb-3">
                <h3 className="font-semibold text-slate-800">Pattern Trend</h3>
                <p className="text-xs text-slate-400">Reports in the last 7 days</p>
              </div>
              <div className="flex items-end gap-2 h-36">
                {trend.map((t, i) => (
                  <div key={t.date} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="text-[9px] text-slate-500 font-semibold">{t.reports}</div>
                    <div className="w-full rounded-t-lg"
                      style={{
                        height: `${(t.reports / trendMax) * 100}px`,
                        background: i === trend.length - 1
                          ? 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)'
                          : 'linear-gradient(180deg, #93C5FD 0%, #3B82F6 100%)',
                        minHeight: '4px',
                      }}
                    />
                    <span className="text-[9px] text-slate-400">{weekday(t.date)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">Peak: <span className="font-semibold text-slate-800">{Math.max(0, ...trend.map((t) => t.reports))} reports</span></div>
                <button onClick={() => navigate('auth-analytics')} className="text-xs text-[#2D3BE8] font-semibold">Full Analytics →</button>
              </div>
            </div>
          </div>

          {/* Priority Alerts */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">Priority Alerts</h3>
              <button onClick={() => navigate('auth-alerts')} className="text-xs text-[#2D3BE8] font-semibold">Manage All →</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {d.priorityAlerts.length === 0 && <p className="col-span-3 text-xs text-slate-400 py-4 text-center">No open alerts. Nothing needs attention right now.</p>}
              {d.priorityAlerts.map((a) => (
                <button key={a.id} onClick={() => navigate('auth-alerts')}
                  className="p-4 border-2 border-slate-100 rounded-2xl text-left hover:border-[#2D3BE8] transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <StatusBadge level={a.status === 'escalated' ? 'escalated' : a.level} />
                    <span className="text-xs font-bold text-blue-600">{a.confidence}%</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-800 group-hover:text-[#2D3BE8] transition-colors">{a.area}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{a.category} · {a.status}</div>
                </button>
              ))}
            </div>
          </div>
          </>)}
        </div>
      </main>
    </div>
  );
}
