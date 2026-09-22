import type { Screen } from '../types';

const items: { id: Screen; label: string; icon: (p: { active: boolean }) => React.ReactNode; primary?: boolean }[] = [
  { id: 'home',        label: 'Home',    icon: HomeIcon },
  { id: 'nearby-map',  label: 'Nearby',  icon: MapIcon },
  { id: 'quick-report',label: 'Report',  icon: ReportIcon, primary: true },
  { id: 'alerts',      label: 'Alerts',  icon: BellIcon },
  { id: 'profile',     label: 'Profile', icon: UserIcon },
];

export default function BottomNav({ active, navigate }: { active: Screen; navigate: (s: Screen) => void }) {
  return (
    <div className="w-full bg-white border-t border-slate-100">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(({ id, label, icon: Icon, primary }) => {
          const isActive = active === id;
          return primary ? (
            <button key={id} onClick={() => navigate(id)}
              className="flex flex-col items-center -mt-5">
              <div className="w-14 h-14 rounded-full bg-[#2D3BE8] shadow-lg shadow-blue-400/40 flex items-center justify-center">
                <Icon active={true} />
              </div>
              <span className="text-[10px] font-semibold text-[#2D3BE8] mt-1">{label}</span>
            </button>
          ) : (
            <button key={id} onClick={() => navigate(id)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[48px]">
              <Icon active={isActive} />
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-[#2D3BE8]' : 'text-slate-400'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 transition-colors ${active ? 'text-[#2D3BE8]' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  );
}
function MapIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 transition-colors ${active ? 'text-[#2D3BE8]' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  );
}
function ReportIcon({ active: _ }: { active: boolean }) {
  return (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
  );
}
function BellIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 transition-colors ${active ? 'text-[#2D3BE8]' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
    </svg>
  );
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 transition-colors ${active ? 'text-[#2D3BE8]' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  );
}
