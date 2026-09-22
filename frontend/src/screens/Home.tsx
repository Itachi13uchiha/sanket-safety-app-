import type { Screen } from '../types';
import MapView, { type MapPoint } from '../components/MapView';
import StatusBadge from '../components/StatusBadge';
import { citizen } from '../api';
import { useAsync } from '../hooks/useAsync';
import { locationStore } from '../state/app';
import { timeAgo } from '../lib/format';
import { ErrorBox, Loading } from '../components/ui/StateViews';

const AREA_STYLE = {
  calm:     { badge: 'low' as const,    box: 'bg-green-50', icon: 'text-green-500' },
  moderate: { badge: 'medium' as const, box: 'bg-amber-50', icon: 'text-amber-500' },
  elevated: { badge: 'high' as const,   box: 'bg-red-50',   icon: 'text-red-500' },
};

export default function Home({ navigate }: { navigate: (s: Screen) => void }) {
  const loc = locationStore.use();
  const home = useAsync(() => citizen.home({ lat: loc.lat, lng: loc.lng, radiusKm: 5 }), [loc.lat, loc.lng]);
  const mine = useAsync(() => citizen.myReports({ pageSize: 1 }).catch(() => null), []);

  const h = home.data;
  const style = AREA_STYLE[h?.status.level ?? 'calm'];
  const patternCount = h?.nearbyPatterns.length ?? 0;
  const points: MapPoint[] = h
    ? [
        ...h.nearbyPatterns.map((p) => ({
          id: p.id, lat: p.location.lat, lng: p.location.lng, level: p.level, label: p.area, count: p.distinctReports,
          sub: `${p.term.label} · ${p.category.label}`,
        })),
        ...h.recentSignals.map((s, i) => ({
          id: `sig-${i}`, lat: s.location.lat, lng: s.location.lng, level: s.level, label: s.category.label,
          count: s.distinctReports, sub: s.term.label,
        })),
      ]
    : [];

  return (
    <div className="w-full bg-[#F5F7FF] overflow-y-auto pb-4">
      {/* Header */}
      <div className="bg-white px-5 pt-3 pb-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#2D3BE8] flex items-center justify-center shadow-md shadow-blue-400/30">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
            </div>
            <div>
              <span className="font-bold text-[#1A237E] text-base tracking-tight">Sanket</span>
              <div className="flex items-center gap-1 mt-0.5">
                <svg className="w-3 h-3 text-[#2D3BE8]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                </svg>
                <span className="text-[10px] font-medium text-slate-500">{h?.area ? `${h.area.name}, ${h.area.city}` : loc.label}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('notifications')} className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-slate-600" viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}>
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
              </svg>
              {patternCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{patternCount}</span>
              )}
            </button>
            <button onClick={() => navigate('profile')} className="w-9 h-9 rounded-full bg-[#2D3BE8] flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-400/30">
              U
            </button>
          </div>
        </div>

        {/* Greeting */}
        <div className="mt-3">
          <p className="text-base font-bold text-slate-900">Hello, User 👋</p>
          <p className="text-xs text-slate-400 mt-0.5">Together for safer public spaces.</p>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {/* Area Safety Status */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${style.box} flex items-center justify-center flex-shrink-0`}>
            <svg className={`w-5 h-5 ${style.icon}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Your Area Status</span>
              {h ? <StatusBadge level={style.badge} label={h.status.label} /> : <span className="text-[10px] text-slate-300">Checking…</span>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {!h ? 'Checking your area…'
                : h.status.nearbyPatterns > 0 ? `${h.status.nearbyPatterns} emerging pattern${h.status.nearbyPatterns === 1 ? '' : 's'} nearby · ${h.nearbyPatterns[0]?.area ?? ''}`
                : h.status.nearbySignals > 0 ? `${h.status.nearbySignals} community signal${h.status.nearbySignals === 1 ? '' : 's'} nearby`
                : 'No unusual activity detected nearby'}
            </p>
          </div>
        </div>

        {/* Primary Report Button */}
        <button
          onClick={() => navigate('quick-report')}
          className="w-full py-4 rounded-2xl font-bold text-white text-base shadow-xl shadow-red-400/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
          style={{ background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Report a Safety Concern
        </button>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          <QuickCard
            label="Nearby Alerts"
            sub={h ? `${patternCount} active pattern${patternCount === 1 ? '' : 's'}` : 'Checking…'}
            icon={<AlertIcon />}
            color="bg-blue-50"
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            onClick={() => navigate('alerts')}
            badge={patternCount > 0 ? String(patternCount) : undefined}
          />
          <QuickCard
            label="Safety Map"
            sub="View hotspot areas"
            icon={<MapIcon />}
            color="bg-green-50"
            iconBg="bg-green-100"
            iconColor="text-green-600"
            onClick={() => navigate('nearby-map')}
          />
          <QuickCard
            label="Quick SOS"
            sub="Call 112 (emergency)"
            icon={<SOSIcon />}
            color="bg-red-50"
            iconBg="bg-red-100"
            iconColor="text-red-600"
            onClick={() => { window.location.href = 'tel:112'; }}
          />
          <QuickCard
            label="My Reports"
            sub={mine.data ? `${mine.data.counts.all} submitted` : 'Track your reports'}
            icon={<ReportsIcon />}
            color="bg-purple-50"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            onClick={() => navigate('my-reports')}
          />
        </div>

        {/* Map Preview */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-slate-800">Nearby Safety Map</span>
            <button onClick={() => navigate('nearby-map')} className="text-xs text-[#2D3BE8] font-semibold">View Full →</button>
          </div>
          <div className="h-36 rounded-xl overflow-hidden">
            <MapView compact center={loc} radiusKm={5} points={points} onPointClick={() => navigate('nearby-map')} />
          </div>
        </div>

        {/* Recent Community Signals */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-slate-800">Recent Signals</span>
            <button onClick={() => navigate('alerts')} className="text-xs text-[#2D3BE8] font-semibold">See All</button>
          </div>
          {home.loading && !h && <Loading rows={2} />}
          {home.error && <ErrorBox error={home.error} onRetry={home.reload} compact />}
          {h && h.recentSignals.length === 0 && (
            <p className="text-xs text-slate-400 py-3 text-center">No community signals nearby right now. Signals appear once several independent reports are received.</p>
          )}
          <div className="space-y-2">
            {h?.recentSignals.map((s, i) => (
              <button key={i} onClick={() => navigate('alerts')}
                className="w-full flex items-center gap-3 py-2 border-b border-slate-50 last:border-0 text-left">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${s.level === 'high' ? 'bg-red-100' : s.level === 'medium' ? 'bg-amber-100' : 'bg-green-100'}`}>
                  <svg className={`w-4 h-4 ${s.level === 'high' ? 'text-red-500' : s.level === 'medium' ? 'text-amber-500' : 'text-green-500'}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">{s.category.label}</span>
                    <StatusBadge level={s.level} label={s.term.label} size="xs" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{s.distanceKm} km away · {timeAgo(s.lastSignalAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Safety Tip */}
        <div className="bg-[#1A237E] rounded-2xl p-4 text-white">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-blue-300 mb-1 uppercase tracking-wide">Safety Tip</p>
              <p className="text-xs text-blue-100 leading-relaxed">{h?.tip ?? 'Stay in well-lit, populated areas when walking alone. Your reports help authorities detect problems early.'}</p>
            </div>
          </div>
        </div>

        {/* Authority portal CTA */}
        <button onClick={() => navigate('auth-login')}
          className="w-full py-3 border-2 border-slate-200 rounded-2xl text-xs text-slate-500 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          Authority Portal →
        </button>
      </div>
    </div>
  );
}

function QuickCard({ label, sub, icon, color, iconBg, iconColor, onClick, badge }: {
  label: string; sub: string; icon: React.ReactNode; color: string; iconBg: string; iconColor: string; onClick: () => void; badge?: string;
}) {
  return (
    <button onClick={onClick} className={`${color} rounded-2xl p-3.5 flex flex-col gap-2 text-left active:scale-[0.97] transition-transform border border-white/60`}>
      <div className={`relative w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center ${iconColor}`}>
        {icon}
        {badge && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{badge}</span>
        )}
      </div>
      <div>
        <div className="text-xs font-bold text-slate-800">{label}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
      </div>
    </button>
  );
}

function AlertIcon() { return <svg className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>; }
function MapIcon() { return <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>; }
function SOSIcon() { return <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>; }
function ReportsIcon() { return <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>; }
