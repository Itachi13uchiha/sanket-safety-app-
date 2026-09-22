import type { Screen } from '../../types';
import type { Permission } from '../../api';
import { authority } from '../../api';
import { useStaff } from '../../hooks/useStaff';
import { initials } from '../../lib/format';

const navItems: { id: Screen; label: string; icon: string; needs?: Permission }[] = [
  { id: 'auth-dashboard', label: 'Dashboard',      icon: '⊞' },
  { id: 'auth-live-map',  label: 'Live Patterns',  icon: '🗺️' },
  { id: 'auth-reports',   label: 'Reports',        icon: '📋', needs: 'reports:view' },
  { id: 'auth-alerts',    label: 'Alerts',         icon: '🔔' },
  { id: 'auth-analytics', label: 'Analytics',      icon: '📊' },
  { id: 'auth-cases',     label: 'Cases',          icon: '📁' },
  { id: 'auth-access',    label: 'Users & Access', icon: '👥', needs: 'users:manage' },
  { id: 'auth-audit',     label: 'Audit Logs',     icon: '🔍', needs: 'audit:view' },
];

export default function Sidebar({ active, navigate }: { active: Screen; navigate: (s: Screen) => void }) {
  const { user, can } = useStaff();
  const signOut = async () => {
    await authority.logout();
    navigate('auth-login');
  };

  return (
    <aside className="w-56 min-h-screen bg-[#0D1B6B] flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-sm">Sanket</div>
            <div className="text-[10px] text-blue-300">Authority Portal</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.filter((i) => !i.needs || can(i.needs)).map((item) => {
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => navigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm font-medium ${isActive ? 'bg-white/20 text-white' : 'text-blue-300 hover:bg-white/10 hover:text-white'}`}>
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">{initials(user?.name ?? 'U')}</div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
            <div className="text-[10px] text-blue-400">{user?.roleLabel}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => navigate('home')} className="text-[10px] text-blue-400 hover:text-white transition-colors">← Citizen App</button>
          <button onClick={signOut} className="text-[10px] text-blue-300 hover:text-white transition-colors font-semibold">Sign out</button>
        </div>
      </div>
    </aside>
  );
}
