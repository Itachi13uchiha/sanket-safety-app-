import { useState } from 'react';
import type { Screen } from '../types';
import StatusBadge from '../components/StatusBadge';
import { citizen } from '../api';
import { useAsync } from '../hooks/useAsync';
import { langStore, locationStore, patternStore } from '../state/app';
import { timeAgo } from '../lib/format';
import { Empty, ErrorBox, Loading } from '../components/ui/StateViews';

const tabs = ['Nearby Patterns', 'Notifications', 'System'];

export default function Alerts({ navigate }: { navigate: (s: Screen) => void }) {
  const [tab, setTab] = useState('Nearby Patterns');
  const loc = locationStore.use();
  const lang = langStore.use();
  const q = useAsync(() => citizen.alerts({ lat: loc.lat, lng: loc.lng, radiusKm: 10 }), [loc.lat, loc.lng, lang]);
  const d = q.data;

  return (
    <div className="w-full min-h-full bg-[#F5F7FF] flex flex-col">
      {/* Header */}
      <div className="bg-white px-5 pt-4 pb-0 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-bold text-slate-900 text-xl">Alerts</h1>
          {d && d.nearbyPatterns.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{d.nearbyPatterns.length}</span>
          )}
        </div>
        <div className="flex border-b border-slate-100">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${tab === t ? 'text-[#2D3BE8] border-b-2 border-[#2D3BE8]' : 'text-slate-400'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-3">
        {q.loading && !d && <Loading rows={3} />}
        {q.error && <ErrorBox error={q.error} onRetry={q.reload} />}

        {d && tab === 'Nearby Patterns' && (
          d.nearbyPatterns.length === 0
            ? <Empty icon="🌿" title="No emerging patterns nearby" sub="You'll see an alert here when repeated, independent reports form a pattern close to you." />
            : d.nearbyPatterns.map((a) => (
              <div key={a.id} role="button" tabIndex={0}
                onClick={() => { patternStore.set(a.id); navigate('pattern-details'); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { patternStore.set(a.id); navigate('pattern-details'); } }}
                className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-900">{a.term.label}</span>
                  <StatusBadge level={a.level} label={a.status.label} />
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">{a.summary}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Tag icon="📍" label={`${a.distanceKm ?? '—'} km`} />
                  <Tag icon="🕐" label={timeAgo(a.lastSignalAt)} />
                  <Tag icon="📋" label={a.category.label} />
                </div>
                <button onClick={e => { e.stopPropagation(); navigate('nearby-map'); }}
                  className="mt-3 text-xs font-semibold text-[#2D3BE8] flex items-center gap-1">
                  View on Map →
                </button>
              </div>
            ))
        )}

        {d && tab === 'Notifications' && (
          d.notifications.length === 0
            ? <Empty icon="🔔" title="No notifications yet" sub="Area notifications appear here when a pattern is detected near you." />
            : <div className="space-y-3">
              {d.notifications.map((n) => (
                <div key={n.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-3">
                  <div className="text-2xl">{n.type === 'monitoring_active' ? '🛡️' : '🔔'}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800">{n.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{n.body}</div>
                    <div className="text-[10px] text-slate-300 mt-1">{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
        )}

        {d && tab === 'System' && (
          d.system.length === 0
            ? <Empty icon="ℹ️" title="No system updates" />
            : <div className="space-y-3">
              {d.system.map((n) => (
                <div key={n.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-3">
                  <div className="text-2xl">🔄</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="text-sm font-semibold text-slate-800">{n.title}</div>
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">System</span>
                    </div>
                    <div className="text-xs text-slate-400">{n.body}</div>
                    <div className="text-[10px] text-slate-300 mt-1">{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>
    </div>
  );
}

function Tag({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1 bg-slate-50 rounded-full px-2 py-0.5">
      <span className="text-[10px]">{icon}</span>
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
    </div>
  );
}
