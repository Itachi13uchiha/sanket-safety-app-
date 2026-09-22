import { useState, useCallback, useEffect } from 'react';
import type { Screen } from './types';

import Splash from './screens/Splash';
import Onboarding from './screens/Onboarding';
import LocationPermission from './screens/LocationPermission';
import Home from './screens/Home';
import QuickReport from './screens/QuickReport';
import ReportSuccess from './screens/ReportSuccess';
import NearbyMap from './screens/NearbyMap';
import PatternDetails from './screens/PatternDetails';
import Alerts from './screens/Alerts';
import Profile from './screens/Profile';
import Privacy from './screens/Privacy';
import MyReports from './screens/MyReports';
import Notifications from './screens/Notifications';

import AuthLogin from './screens/authority/AuthLogin';
import Dashboard from './screens/authority/Dashboard';
import LiveMap from './screens/authority/LiveMap';
import ReportManagement from './screens/authority/ReportManagement';
import Analytics from './screens/authority/Analytics';
import AlertManagement from './screens/authority/AlertManagement';
import CaseManagement from './screens/authority/CaseManagement';
import AuditLogs from './screens/authority/AuditLogs';
import AccessControl from './screens/authority/AccessControl';

import BottomNav from './components/BottomNav';
import { staffStore } from './state/app';
import { installTranslator } from './lib/translator';

const AUTHORITY_SCREENS: Screen[] = [
  'auth-login', 'auth-dashboard', 'auth-live-map',
  'auth-reports', 'auth-analytics', 'auth-alerts',
  'auth-cases', 'auth-audit', 'auth-access',
];

const MOBILE_SCREENS_WITH_NAV: Screen[] = [
  'home', 'nearby-map', 'alerts', 'alert-detail', 'profile',
  'pattern-details', 'privacy', 'my-reports', 'notifications',
];

function renderScreen(screen: Screen, navigate: (s: Screen) => void) {
  const props = { navigate };
  switch (screen) {
    case 'splash':              return <Splash {...props} />;
    case 'onboarding':          return <Onboarding {...props} />;
    case 'location-permission': return <LocationPermission {...props} />;
    case 'home':                return <Home {...props} />;
    case 'quick-report':        return <QuickReport {...props} />;
    case 'report-success':      return <ReportSuccess {...props} />;
    case 'nearby-map':          return <NearbyMap {...props} />;
    case 'pattern-details':     return <PatternDetails {...props} />;
    case 'alerts':
    case 'alert-detail':        return <Alerts {...props} />;
    case 'profile':             return <Profile {...props} />;
    case 'privacy':             return <Privacy {...props} />;
    case 'my-reports':          return <MyReports {...props} />;
    case 'notifications':       return <Notifications {...props} />;
    default:                    return null;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [prevScreen, setPrevScreen] = useState<Screen | null>(null);
  const [animKey, setAnimKey] = useState(0);

  const navigate = useCallback((s: Screen) => {
    setPrevScreen(screen);
    setScreen(s);
    setAnimKey(k => k + 1);
  }, [screen]);

  // Translate all static + dynamic UI text whenever the selected language changes.
  useEffect(() => installTranslator(), []);

  // Scroll to top on authority screens
  useEffect(() => {
    if (AUTHORITY_SCREENS.includes(screen)) {
      window.scrollTo(0, 0);
    }
  }, [screen]);

  const isAuthority = AUTHORITY_SCREENS.includes(screen);
  const showBottomNav = MOBILE_SCREENS_WITH_NAV.includes(screen);

  // Authority portal is guarded: no session → login; already signed in → dashboard instead of the login form.
  const staff = staffStore.use();
  const authScreen: Screen = !staff ? 'auth-login' : screen === 'auth-login' ? 'auth-dashboard' : screen;
  useEffect(() => {
    if (isAuthority && authScreen !== screen) setScreen(authScreen);
  }, [isAuthority, authScreen, screen]);

  // Authority portal - full width, no phone frame
  if (isAuthority) {
    const props = { navigate };
    return (
      <div className="min-h-screen bg-[#F5F7FF]">
        {authScreen === 'auth-login'     && <AuthLogin {...props} />}
        {authScreen === 'auth-dashboard' && <Dashboard {...props} />}
        {authScreen === 'auth-live-map'  && <LiveMap {...props} />}
        {authScreen === 'auth-reports'   && <ReportManagement {...props} />}
        {authScreen === 'auth-analytics' && <Analytics {...props} />}
        {authScreen === 'auth-alerts'    && <AlertManagement {...props} />}
        {authScreen === 'auth-cases'     && <CaseManagement {...props} />}
        {authScreen === 'auth-audit'     && <AuditLogs {...props} />}
        {authScreen === 'auth-access'    && <AccessControl {...props} />}
      </div>
    );
  }

  // Citizen mobile flow
  return (
    <div className="sanket-app-root">
      {/* Desktop context bar */}
      <div className="sanket-context-bar">
        <div className="sanket-context-inner">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#2D3BE8] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
            </div>
            <span className="font-bold text-slate-800 text-sm">Sanket</span>
            <span className="text-slate-300 mx-1">·</span>
            <span className="text-xs text-slate-500">Citizen App Preview</span>
          </div>
          <button onClick={() => navigate('auth-login')}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1A237E] text-white text-xs font-semibold rounded-full hover:bg-[#2D3BE8] transition-colors">
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
            Authority Portal
          </button>
        </div>
      </div>

      {/* Phone shell */}
      <div className="sanket-phone-outer">
        <div className="sanket-phone-shell">
          {/* Notch / status bar */}
          <div className="sanket-status-bar">
            <span className="text-xs font-semibold text-slate-800">9:41</span>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1.5 6.5C3.5 4.5 6.5 3 12 3s8.5 1.5 10.5 3.5"/><path d="M5 10c1.5-1.5 3.8-2.5 7-2.5s5.5 1 7 2.5"/><path d="M9 14c.9-.9 2.1-1.5 3-1.5s2.1.6 3 1.5"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/></svg>
              <div className="flex items-end gap-px h-3">
                {[40, 60, 80, 100].map((h, i) => (
                  <div key={i} className="w-1 bg-slate-700 rounded-sm" style={{ height: `${h * 0.03}rem` }} />
                ))}
              </div>
              <div className="flex items-center gap-0.5">
                <div className="w-5 h-2.5 rounded-sm border border-slate-700 flex items-center px-px">
                  <div className="flex-1 h-full bg-green-500 rounded-sm" />
                </div>
                <div className="w-0.5 h-1.5 bg-slate-400 rounded-r-sm" />
              </div>
            </div>
          </div>

          {/* Screen area */}
          <div className="sanket-screen-area">
            <div key={animKey} className="sanket-screen-slide">
              {renderScreen(screen, navigate)}
            </div>
          </div>

          {/* Bottom nav */}
          {showBottomNav && (
            <div className="sanket-bottom-nav-wrapper">
              <BottomNav active={screen} navigate={navigate} />
            </div>
          )}

          {/* Home indicator */}
          <div className="sanket-home-indicator">
            <div className="w-28 h-1 bg-slate-300 rounded-full" />
          </div>
        </div>
      </div>

      <style>{`
        .sanket-app-root {
          min-height: 100dvh;
          background: linear-gradient(135deg, #E8EAFF 0%, #F0F4FF 50%, #EEF2FF 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .sanket-context-bar {
          width: 100%;
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          padding: 0.75rem 1.5rem;
        }

        .sanket-context-inner {
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sanket-phone-outer {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 0;
          width: 100%;
        }

        .sanket-phone-shell {
          width: 390px;
          background: white;
          border-radius: 48px;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.08),
            0 0 0 8px rgba(0,0,0,0.04),
            0 32px 80px rgba(0,0,0,0.25),
            0 8px 24px rgba(0,0,0,0.12);
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          min-height: 780px;
          max-height: min(844px, 90dvh);
        }

        .sanket-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.5rem 0.5rem;
          background: white;
          flex-shrink: 0;
          position: relative;
          z-index: 20;
        }

        .sanket-screen-area {
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        .sanket-screen-slide {
          position: absolute;
          inset: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          animation: screenSlideIn 0.22s cubic-bezier(0.4,0,0.2,1) both;
        }

        @keyframes screenSlideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .sanket-bottom-nav-wrapper {
          flex-shrink: 0;
          position: relative;
          z-index: 50;
        }

        .sanket-home-indicator {
          display: flex;
          justify-content: center;
          padding: 0.5rem 0 0.75rem;
          background: white;
          flex-shrink: 0;
        }

        /* On very small screens, show full-screen instead of phone frame */
        @media (max-width: 480px) {
          .sanket-context-bar { display: none; }
          .sanket-phone-outer { padding: 0; }
          .sanket-phone-shell {
            width: 100%;
            border-radius: 0;
            box-shadow: none;
            min-height: 100dvh;
            max-height: none;
          }
          .sanket-status-bar { padding-top: env(safe-area-inset-top, 1rem); }
          .sanket-home-indicator { padding-bottom: env(safe-area-inset-bottom, 0.75rem); }
        }
      `}</style>
    </div>
  );
}
