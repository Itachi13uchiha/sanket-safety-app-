import { useState } from 'react';
import type { Screen } from '../../types';
import Sidebar from './Sidebar';
import { authority } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { shortDate, weekday } from '../../lib/format';
import { ErrorBox, Loading } from '../../components/ui/StateViews';

const COLORS = ['#EF4444', '#F59E0B', '#8B5CF6', '#3B82F6', '#10B981', '#EC4899', '#14B8A6', '#6B7280'];
const RANGES = [{ label: '7 days', value: '7d' as const }, { label: '30 days', value: '30d' as const }, { label: '90 days', value: '90d' as const }];

export default function Analytics({ navigate }: { navigate: (s: Screen) => void }) {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');
  const q = useAsync(() => authority.analytics(range), [range]);
  const d = q.data;

  const over = d?.reportsOverTime ?? [];
  const wMax = Math.max(1, ...over.map((x) => x.reports));
  const label = (date: string, i: number) => (range === '7d' ? weekday(date) : i % (range === '30d' ? 5 : 15) === 0 ? shortDate(date) : '');
  const cats = d?.categories ?? [];
  const catMax = Math.max(1, ...cats.map((c) => c.count));
  const blocks = d?.peakTimes.byTimeBlock ?? [];
  const bMax = Math.max(1, ...blocks.map((b) => b.count));
  const growth = d?.patternGrowth ?? [];
  const gMax = Math.max(1, ...growth.map((g) => g.emerged));
  const days = { '7d': 'this week', '30d': 'last 30 days', '90d': 'last 90 days' }[range];

  return (
    <div className="flex min-h-screen bg-[#F5F7FF]">
      <Sidebar active="auth-analytics" navigate={navigate} />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pattern Analytics</h1>
            <p className="text-xs text-slate-400">{d?.methodology.summary ?? 'Pattern detection uses multiple independent signals rather than raw report volume.'}</p>
          </div>
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button key={r.value} onClick={() => setRange(r.value)} className={`px-4 py-1.5 rounded-full text-xs font-semibold ${range === r.value ? 'bg-[#2D3BE8] text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{r.label}</button>
            ))}
          </div>
        </div>

        {q.loading && !d && <Loading rows={4} />}
        {q.error && <ErrorBox error={q.error} onRetry={q.reload} />}

        {d && (<>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Reports over time */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-1">Reports Over Time</h3>
            <p className="text-xs text-slate-400 mb-4">Daily count · {days}</p>
            <div className="flex items-end gap-1 h-36">
              {over.map((x, i) => (
                <div key={x.date} className="flex-1 flex flex-col items-center gap-1.5 min-w-0" title={`${x.date}: ${x.reports} reports from ${x.distinctReporters} reporters`}>
                  {range === '7d' && <div className="text-[9px] text-slate-500 font-semibold">{x.reports}</div>}
                  <div className="w-full rounded-t-lg" style={{ height: `${(x.reports / wMax) * 100}px`, background: 'linear-gradient(180deg, #93C5FD 0%, #3B82F6 100%)', minHeight: '3px' }} />
                  <span className="text-[9px] text-slate-400 h-3 whitespace-nowrap">{label(x.date, i)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-1">Incident Categories</h3>
            <p className="text-xs text-slate-400 mb-4">By report type · {days}</p>
            {cats.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">No reports in this period.</p>}
            <div className="space-y-3">
              {cats.map((c, i) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{c.label}</span>
                    <span className="font-bold text-slate-800">{c.count} <span className="font-normal text-slate-400">({Math.round(c.share * 100)}%)</span></span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(c.count / catMax) * 100}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Peak reporting times */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-1">Peak Reporting Times</h3>
            <p className="text-xs text-slate-400 mb-4">When incidents happened (3-hour blocks)</p>
            <div className="flex items-end gap-2 h-28">
              {blocks.map((b) => (
                <div key={b.block} className="flex-1 flex flex-col items-center gap-1" title={`${b.block}: ${b.count}`}>
                  <div className="w-full rounded-sm" style={{ height: `${(b.count / bMax) * 100}px`, background: b.count / bMax >= 0.8 ? '#EF4444' : b.count / bMax >= 0.5 ? '#F59E0B' : '#93C5FD', minHeight: '2px' }} />
                  <span className="text-[8px] text-slate-400 text-center leading-tight">{b.block.split(' – ')[0]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-3 text-[10px]">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/><span className="text-slate-500">High</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"/><span className="text-slate-500">Medium</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-300"/><span className="text-slate-500">Low</span></div>
            </div>
          </div>

          {/* Pattern growth */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-1">Pattern Growth</h3>
            <p className="text-xs text-slate-400 mb-4">Patterns that reached “emerging” per day</p>
            <div className="flex items-end gap-1 h-28">
              {growth.map((g, i) => (
                <div key={g.date} className="flex-1 flex flex-col items-center gap-1.5 min-w-0" title={`${g.date}: ${g.emerged} emerged, ${g.detected} first detected`}>
                  {range === '7d' && <div className="text-[9px] text-slate-500 font-semibold">{g.emerged}</div>}
                  <div className="w-full rounded-t-lg" style={{ height: `${(g.emerged / gMax) * 80}px`, background: 'linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%)', minHeight: '3px' }} />
                  <span className="text-[9px] text-slate-400 h-3 whitespace-nowrap">{label(g.date, i)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-[10px] text-blue-700 leading-relaxed">
                <strong>Pattern detection</strong> uses multiple independent signals rather than raw report volume — {d.methodology.signals.join('; ').toLowerCase()}.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-50 rounded-xl p-2"><div className="text-lg font-bold text-slate-800">{d.integrity.dismissedOrSpam}</div><div className="text-[10px] text-slate-400">Dismissed / spam</div></div>
              <div className="bg-slate-50 rounded-xl p-2"><div className="text-lg font-bold text-slate-800">{d.integrity.flaggedImplausibleTravel}</div><div className="text-[10px] text-slate-400">Flagged (travel)</div></div>
            </div>
          </div>
        </div>

        {d.patternsByArea.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mt-4">
            <h3 className="font-semibold text-slate-800 mb-3">Patterns by Location</h3>
            <table className="w-full">
              <thead><tr className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="text-left pb-2">Area</th><th className="text-left pb-2">Patterns</th><th className="text-left pb-2">Emerging/Escalated</th><th className="text-left pb-2">Reports</th>
              </tr></thead>
              <tbody>
                {d.patternsByArea.map((a) => (
                  <tr key={a.area} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 text-sm font-medium text-slate-700">{a.area}</td>
                    <td className="py-2.5 text-sm text-slate-500">{a.patterns}</td>
                    <td className="py-2.5 text-sm text-slate-500">{a.emerging ?? 0}</td>
                    <td className="py-2.5 text-sm text-slate-500">{a.reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>)}
      </main>
    </div>
  );
}
