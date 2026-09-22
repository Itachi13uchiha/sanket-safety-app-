import { useEffect, useState } from 'react';
import { authority } from '../api';
import { useAsync } from '../hooks/useAsync';
import { timeAgo } from '../lib/format';

/** Authority notification bell: unread badge, dropdown list, mark-all-read. Polls once a minute. */
export default function NotificationBell() {
  const q = useAsync(() => authority.notifications({ pageSize: 8 }), []);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(q.reload, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = q.data?.unreadCount ?? 0;
  const markAll = async () => {
    await authority.readAllNotifications().catch(() => undefined);
    q.reload();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Notifications" className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">Notifications</span>
            <button onClick={markAll} disabled={unread === 0} className="text-xs text-[#2D3BE8] font-semibold disabled:opacity-40">Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {q.data?.notifications.length === 0 && <p className="p-6 text-center text-xs text-slate-400">You're all caught up.</p>}
            {q.data?.notifications.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-slate-50 last:border-0 ${n.read ? '' : 'bg-blue-50/50'}`}>
                <div className="text-xs font-semibold text-slate-800">{n.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{n.body}</div>
                <div className="text-[10px] text-slate-300 mt-1">{timeAgo(n.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
