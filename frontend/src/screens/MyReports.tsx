import { useState } from 'react';
import type { Screen } from '../types';
import StatusBadge from '../components/StatusBadge';
import { citizen } from '../api';
import { useAsync } from '../hooks/useAsync';
import { langStore } from '../state/app';
import { fmtDateTime } from '../lib/format';
import { Empty, ErrorBox, Loading } from '../components/ui/StateViews';

const TABS = [
  { label: 'All', value: 'all' as const },
  { label: 'Open', value: 'open' as const },
  { label: 'Resolved', value: 'resolved' as const },
];

export default function MyReports({ navigate }: { navigate: (s: Screen) => void }) {
  const [tab, setTab] = useState<'all' | 'open' | 'resolved'>('all');
  const lang = langStore.use();
  const q = useAsync(() => citizen.myReports({ status: tab, pageSize: 50 }), [tab, lang]);
  const d = q.data;

  return (
    <div className="w-full min-h-full bg-[#F5F7FF] overflow-y-auto pb-8">
      <div className="bg-white px-5 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('profile')} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <h1 className="font-bold text-slate-900 text-xl">My Reports</h1>
        </div>
        <div className="flex gap-2 mt-4">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold ${t.value === tab ? 'bg-[#2D3BE8] text-white' : 'bg-slate-100 text-slate-500'}`}>
              {t.label}{d ? ` (${d.counts[t.value]})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
            <p className="text-xs text-blue-700">All reports are anonymous. They are linked only to this device, never to you.</p>
          </div>
        </div>

        {q.loading && !d && <Loading rows={3} />}
        {q.error && <ErrorBox error={q.error} onRetry={q.reload} />}
        {d && d.reports.length === 0 && (
          <Empty icon="📋" title={tab === 'all' ? "You haven't reported anything yet" : `No ${tab} reports`}
            sub="When you report a safety concern it will show up here."
            action={tab === 'all' ? <button onClick={() => navigate('quick-report')} className="px-4 py-2 bg-[#2D3BE8] text-white text-xs font-semibold rounded-xl">Report a concern</button> : undefined} />
        )}

        {d?.reports.map(r => (
          <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">{r.category.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{r.location.label}</div>
              </div>
              <StatusBadge level={r.status} />
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-slate-400">{fmtDateTime(r.submittedAt)}</div>
              <span className="text-xs font-mono text-slate-300">#{r.id}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
