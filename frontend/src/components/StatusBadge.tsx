export type BadgeLevel =
  | 'high' | 'medium' | 'low'
  | 'monitoring' | 'emerging' | 'escalated' | 'resolved'
  | 'open' | 'closed' | 'in_progress' | 'on_hold'
  | 'new' | 'linked' | 'confirmed' | 'dismissed' | 'acknowledged';

const configs: Record<BadgeLevel, { label: string; bg: string; text: string; dot: string }> = {
  high:         { label: 'High',        bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  medium:       { label: 'Medium',      bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  low:          { label: 'Low',         bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  monitoring:   { label: 'Monitoring',  bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  emerging:     { label: 'Emerging',    bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  escalated:    { label: 'Escalated',   bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  resolved:     { label: 'Resolved',    bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  open:         { label: 'Open',        bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  closed:       { label: 'Closed',      bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400' },
  in_progress:  { label: 'In Progress', bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  on_hold:      { label: 'On Hold',     bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  new:          { label: 'New',         bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  linked:       { label: 'Linked',      bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  confirmed:    { label: 'Confirmed',   bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  dismissed:    { label: 'Dismissed',   bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400' },
  acknowledged: { label: 'Acknowledged',bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
};

export default function StatusBadge({ level, size = 'sm', label }: { level: BadgeLevel; size?: 'xs' | 'sm'; label?: string }) {
  const c = configs[level] ?? configs.monitoring;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${c.bg} ${c.text} ${size === 'xs' ? 'text-xs' : 'text-xs'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label ?? c.label}
    </span>
  );
}
