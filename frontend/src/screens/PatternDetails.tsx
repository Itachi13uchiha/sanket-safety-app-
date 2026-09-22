import { useEffect } from 'react';
import type { Screen } from '../types';
import StatusBadge from '../components/StatusBadge';
import { citizen } from '../api';
import { useAsync } from '../hooks/useAsync';
import { langStore, patternStore } from '../state/app';
import { fmtDate, shortDate, weekday } from '../lib/format';
import { ErrorBox, Loading } from '../components/ui/StateViews';

export default function PatternDetails({ navigate }: { navigate: (s: Screen) => void }) {
  const id = patternStore.use();
  const lang = langStore.use();
  const q = useAsync(() => (id ? citizen.pattern(id) : Promise.resolve(null)), [id, lang]);
  useEffect(() => {
    if (!id) navigate('nearby-map');
  }, [id, navigate]);

  const p = q.data;
  const chartData = p?.trend.map((t) => t.reports) ?? [];
  const days = p?.trend.map((t) => weekday(t.date)) ?? [];
  const max = Math.max(1, ...chartData);
  const activeDays = p ? p.trend.filter((t) => t.reports > 0) : [];

  if (!p) {
    return (
      <div className="w-full min-h-full bg-[#F5F7FF] p-5">
        <button onClick={() => navigate('nearby-map')} className="w-9 h-9 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
          <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        {q.loading && <Loading rows={4} />}
        {q.error && (
          <ErrorBox error={q.error} onRetry={q.reload} />
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-[#F5F7FF] overflow-y-auto pb-8">
      {/* Header */}
      <div className="bg-white px-5 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('nearby-map')} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <div>
            <div className="text-xs text-slate-400 font-medium">{p.term.label}</div>
            <h1 className="font-bold text-slate-900">{p.area}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge level={p.level} label={p.status.label} />
          <span className="text-xs text-slate-400">Seen over {p.daysObserved} day{p.daysObserved === 1 ? '' : 's'}{p.peakWindow ? ` · ${p.peakWindow.label}` : ''}</span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Distinct Reports" value={String(p.distinctReports)} color="text-red-600" />
          <StatCard label="Time Periods" value={String(p.distinctPeriods)} color="text-amber-600" />
          <StatCard label="Days Active" value={String(p.daysObserved)} color="text-blue-600" />
        </div>

        {/* Description */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <p className="text-sm text-amber-800 leading-relaxed">
              {p.summary} Reports come from distinct, independent reporters.
            </p>
          </div>
        </div>

        {/* Pattern details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          <div className="text-sm font-semibold text-slate-800 mb-3">Pattern Information</div>
          <InfoRow label="Area" value={p.area} />
          <InfoRow label="Incident Category" value={p.category.label} />
          <InfoRow label="Pattern Detected" value={`${fmtDate(p.firstDetectedAt)} – Present`} />
          <InfoRow label="Peak Time" value={p.peakWindow?.label ?? 'Varies'} />
          <InfoRow label="Authority Status" value={p.status.label} highlight />
        </div>

        {/* Trend chart */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="text-sm font-semibold text-slate-800 mb-1">Report Trend (This Week)</div>
          <div className="text-xs text-slate-400 mb-4">Independent reporters per day</div>

          <div className="flex items-end gap-2 h-28">
            {chartData.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-lg transition-all" title={`${v} reporter${v === 1 ? '' : 's'}`}
                  style={{
                    height: `${(v / max) * 100}px`,
                    background: i === chartData.length - 1
                      ? 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)'
                      : 'linear-gradient(180deg, #93C5FD 0%, #3B82F6 100%)',
                    minHeight: '4px',
                  }}
                />
                <span className="text-[9px] text-slate-400 font-medium">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Anti-gaming note */}
        <div className="bg-[#1A237E] rounded-2xl p-4 text-white">
          <div className="flex items-start gap-3">
            <div className="text-xl">🛡️</div>
            <div>
              <p className="text-xs font-semibold text-blue-200 mb-1 uppercase tracking-wide">Anti-Abuse Verification</p>
              <p className="text-xs text-blue-100 leading-relaxed">
                {p.note} It is checked for distinct reporters, geographic clustering and time-period diversity.
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="text-sm font-semibold text-slate-800 mb-4">Reporting Timeline</div>
          {activeDays.length === 0 && <p className="text-xs text-slate-400">No signals in the last 7 days.</p>}
          <div className="space-y-3">
            {activeDays.slice().reverse().map((d) => ({ time: shortDate(d.date), event: `${d.reports} independent reporter${d.reports === 1 ? '' : 's'}` })).map((e, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full mt-0.5 ${i === 0 ? 'bg-red-500' : 'bg-blue-300'}`} />
                  {i < activeDays.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 my-1" />}
                </div>
                <div className="pb-2">
                  <div className="text-xs font-semibold text-slate-700">{e.time}</div>
                  <div className="text-xs text-slate-400">{e.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button onClick={() => navigate('quick-report')}
          className="w-full py-4 bg-[#2D3BE8] text-white font-semibold rounded-2xl shadow-lg shadow-blue-400/30">
          Report a Similar Incident
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400 font-medium mt-0.5">{label}</div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-blue-600' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}
