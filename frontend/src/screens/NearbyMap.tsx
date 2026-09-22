import { useState } from 'react';
import type { Screen } from '../types';
import MapView, { type MapPoint } from '../components/MapView';
import StatusBadge from '../components/StatusBadge';
import { citizen, type PublicPattern, type PublicSignal, type Range } from '../api';
import { useAsync } from '../hooks/useAsync';
import { langStore, locationStore, patternStore } from '../state/app';
import { timeAgo } from '../lib/format';
import { Empty, ErrorBox, Loading } from '../components/ui/StateViews';

const filters = ['All Areas', 'Hotspots', 'Recent'] as const;
const timeFilters: { label: string; range: Range }[] = [
  { label: 'Today', range: 'today' },
  { label: 'This Week', range: 'week' },
  { label: 'This Month', range: 'month' },
];

interface Item {
  id: string;
  kind: 'pattern' | 'signal';
  point: MapPoint;
  pattern?: PublicPattern;
  signal?: PublicSignal;
  recent: boolean;
}

export default function NearbyMap({ navigate }: { navigate: (s: Screen) => void }) {
  const loc = locationStore.use();
  const lang = langStore.use();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>('All Areas');
  const [activeRange, setActiveRange] = useState<Range>('week');
  const [activeType, setActiveType] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const meta = useAsync(() => citizen.meta(), [lang]);
  const map = useAsync(
    () => citizen.map({ lat: loc.lat, lng: loc.lng, radiusKm: 5, range: activeRange, category: activeType === 'all' ? undefined : activeType }),
    [loc.lat, loc.lng, activeRange, activeType, lang],
  );

  const items: Item[] = [
    ...(map.data?.patterns ?? []).map((p): Item => ({
      id: p.id, kind: 'pattern', pattern: p,
      recent: !!p.lastSignalAt && Date.now() - Date.parse(p.lastSignalAt) < 24 * 3600_000,
      point: { id: p.id, lat: p.location.lat, lng: p.location.lng, level: p.level, label: p.area, count: p.distinctReports, sub: `${p.term.label} · ${p.category.label}` },
    })),
    ...(map.data?.signals ?? []).map((s, i): Item => ({
      id: `sig-${i}`, kind: 'signal', signal: s, recent: s.recency !== 'earlier',
      point: { id: `sig-${i}`, lat: s.location.lat, lng: s.location.lng, level: s.level, label: s.category.label, count: s.distinctReports, sub: `${s.term.label} · ${s.distanceKm} km away` },
    })),
  ].filter((it) => (activeFilter === 'Hotspots' ? it.kind === 'pattern' : activeFilter === 'Recent' ? it.recent : true));

  const sel = items.find((i) => i.id === selected);

  return (
    <div className="w-full min-h-full bg-[#F5F7FF] flex flex-col">
      {/* Header */}
      <div className="bg-white px-5 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('home')} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <h1 className="font-bold text-slate-900 text-lg">Safety Map</h1>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filters.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${activeFilter === f ? 'bg-[#2D3BE8] text-white' : 'bg-slate-100 text-slate-600'}`}>
              {f}
            </button>
          ))}
          <div className="w-px bg-slate-200 mx-1" />
          {timeFilters.map(f => (
            <button key={f.range} onClick={() => setActiveRange(f.range)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${activeRange === f.range ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative mx-4 mt-4 rounded-2xl overflow-hidden shadow-md min-h-[260px]">
        <div className="absolute inset-0">
          <MapView center={loc} radiusKm={5} points={items.map((i) => i.point)} selectedId={selected ?? undefined} onPointClick={(p) => setSelected(p.id)} />
        </div>

        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-xl p-2 shadow-sm max-h-44 overflow-y-auto">
          <div className="text-[9px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Incident Type</div>
          {[{ id: 'all', label: 'All Types' }, ...(meta.data?.categories ?? [])].map(c => (
            <button key={c.id} onClick={() => { setActiveType(c.id); setSelected(null); }}
              className={`block w-full text-left text-[10px] font-medium px-2 py-1 rounded-lg mb-0.5 transition-colors ${activeType === c.id ? 'bg-[#2D3BE8] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: selected cluster or list */}
      <div className="bg-white rounded-t-3xl shadow-lg mt-2 px-5 pt-4 pb-24 max-h-64 overflow-y-auto">
        {map.loading && !map.data && <Loading rows={2} />}
        {map.error && <ErrorBox error={map.error} onRetry={map.reload} compact />}

        {sel?.pattern && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-slate-400 font-medium">{sel.pattern.term.label}</div>
                <div className="font-bold text-slate-900">{sel.pattern.area}</div>
              </div>
              <StatusBadge level={sel.pattern.level} label={sel.pattern.status.label} />
            </div>
            <p className="text-sm text-slate-600 mb-4">{sel.pattern.summary}</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Reports" value={String(sel.pattern.distinctReports)} />
              <Stat label="Time Periods" value={String(sel.pattern.distinctPeriods)} />
              <Stat label="Days Active" value={String(sel.pattern.daysObserved)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { patternStore.set(sel.pattern!.id); navigate('pattern-details'); }}
                className="flex-1 py-3 bg-[#2D3BE8] text-white text-sm font-semibold rounded-xl">View Pattern</button>
              <button onClick={() => navigate('quick-report')}
                className="flex-1 py-3 border-2 border-slate-200 text-slate-700 text-sm font-semibold rounded-xl">Report Similar</button>
            </div>
            <button onClick={() => setSelected(null)} className="w-full mt-3 text-xs text-slate-400">← Back to list</button>
          </div>
        )}

        {sel?.signal && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-slate-400 font-medium">{sel.signal.term.label}</div>
                <div className="font-bold text-slate-900">{sel.signal.category.label}</div>
              </div>
              <StatusBadge level={sel.signal.level} />
            </div>
            <p className="text-sm text-slate-600 mb-4">
              A few independent reports were received about {sel.signal.distanceKm} km from you. This is an early signal, not a confirmed pattern.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Stat label="Reports" value={String(sel.signal.distinctReports)} />
              <Stat label="Last Signal" value={timeAgo(sel.signal.lastSignalAt)} small />
            </div>
            <button onClick={() => navigate('quick-report')} className="w-full py-3 border-2 border-slate-200 text-slate-700 text-sm font-semibold rounded-xl">Report Similar</button>
            <button onClick={() => setSelected(null)} className="w-full mt-3 text-xs text-slate-400">← Back to list</button>
          </div>
        )}

        {!sel && map.data && (
          <>
            <div className="text-sm font-semibold text-slate-700 mb-3">Nearby Clusters</div>
            {items.length === 0 ? (
              <Empty icon="🌿" title="Nothing to show here" sub="No patterns or repeated signals were found for these filters. Try a longer time range." />
            ) : (
              <div className="space-y-2">
                {items.map(it => (
                  <button key={it.id} onClick={() => setSelected(it.id)}
                    className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-left hover:bg-slate-100 transition-colors">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${it.point.level === 'high' ? 'bg-red-500' : it.point.level === 'medium' ? 'bg-amber-500' : 'bg-green-500'}`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">{it.point.label}</div>
                      <div className="text-xs text-slate-400">{it.point.count} independent report{it.point.count === 1 ? '' : 's'}</div>
                    </div>
                    <StatusBadge level={it.point.level} size="xs" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <div className={`${small ? 'text-sm pt-1' : 'text-xl'} font-bold text-[#2D3BE8]`}>{value}</div>
      <div className="text-[10px] text-slate-400 font-medium">{label}</div>
    </div>
  );
}
