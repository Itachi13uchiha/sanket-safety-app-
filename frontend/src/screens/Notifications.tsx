import type { Screen } from '../types';
import { citizen } from '../api';
import { useAsync } from '../hooks/useAsync';
import { langStore, locationStore, readNotifStore } from '../state/app';
import { timeAgo } from '../lib/format';
import { Empty, ErrorBox, Loading } from '../components/ui/StateViews';

export default function Notifications({ navigate }: { navigate: (s: Screen) => void }) {
  const loc = locationStore.use();
  const lang = langStore.use();
  const read = readNotifStore.use();
  const q = useAsync(() => citizen.alerts({ lat: loc.lat, lng: loc.lng, radiusKm: 10 }), [loc.lat, loc.lng, lang]);

  const list = q.data
    ? [
        ...q.data.notifications.map((n) => ({ ...n, icon: n.type === 'monitoring_active' ? '🛡️' : '🔴' })),
        ...q.data.system.map((n) => ({ ...n, level: null, patternId: null, icon: 'ℹ️' })),
      ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    : [];
  const unread = list.filter((n) => !read.includes(n.id)).length;

  return (
    <div className="w-full min-h-full bg-[#F5F7FF] overflow-y-auto pb-8">
      <div className="bg-white px-5 pt-4 pb-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('home')} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <h1 className="font-bold text-slate-900 text-xl">Notifications</h1>
          </div>
          <button disabled={unread === 0} onClick={() => readNotifStore.set(list.map((n) => n.id))}
            className="text-xs text-[#2D3BE8] font-semibold disabled:opacity-40">Mark all read</button>
        </div>
      </div>
      <div className="px-4 pt-4 space-y-2">
        {q.loading && !q.data && <Loading rows={3} />}
        {q.error && <ErrorBox error={q.error} onRetry={q.reload} />}
        {q.data && list.length === 0 && <Empty icon="🔔" title="You're all caught up" sub="New alerts for your area will appear here." />}
        {list.map((n) => {
          const unreadItem = !read.includes(n.id);
          return (
            <button key={n.id} onClick={() => readNotifStore.set((r) => (r.includes(n.id) ? r : [...r, n.id]))}
              className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border flex gap-3 ${unreadItem ? 'border-blue-100' : 'border-slate-100'}`}>
              <span className="text-2xl">{n.icon}</span>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className={`text-sm font-semibold ${unreadItem ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</div>
                  {unreadItem && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{n.body}</div>
                <div className="text-[10px] text-slate-300 mt-1">{timeAgo(n.createdAt)}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
