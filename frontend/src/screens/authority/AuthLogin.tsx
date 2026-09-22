import { useEffect, useRef, useState } from 'react';
import type { Screen } from '../../types';
import { authority, friendly, toApiError, type ApiError, type LoginChallenge } from '../../api';

type Step = 'login' | 'otp' | 'forgot' | 'reset';

const message = (e: ApiError) => {
  if (e.code === 'ACCOUNT_LOCKED') {
    const s = (e.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds ?? 900;
    return `Too many failed attempts. Try again in about ${Math.ceil(s / 60)} minute(s).`;
  }
  if (e.code === 'VALIDATION_ERROR') {
    const d = e.details as { message: string }[] | undefined;
    return d?.[0]?.message ?? e.message;
  }
  return friendly(e);
};

export default function AuthLogin({ navigate }: { navigate: (s: Screen) => void }) {
  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(message(toApiError(e)));
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = () =>
    run(async () => {
      const c = await authority.login(email.trim(), pwd);
      setChallenge(c);
      setCooldown(c.resendAfterSeconds);
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setTimeout(() => boxes.current[0]?.focus(), 50);
    });

  const submitOtp = (code = otp.join('')) =>
    run(async () => {
      if (!challenge) return;
      if (!/^\d{6}$/.test(code)) throw Object.assign(new Error('Enter all 6 digits'), {});
      await authority.verifyOtp(challenge.challengeId, code);
      navigate('auth-dashboard');
    });

  const resend = () =>
    run(async () => {
      if (!challenge) return;
      const r = await authority.resendOtp(challenge.challengeId);
      setCooldown(r.resendAfterSeconds);
      setChallenge({ ...challenge, devOtp: r.devOtp });
      setInfo('A new code has been sent.');
    });

  const setDigit = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length > 1) {
      // paste of the whole code
      const next = digits.slice(0, 6).split('');
      setOtp(Array.from({ length: 6 }, (_, k) => next[k] ?? ''));
      boxes.current[Math.min(5, next.length)]?.focus();
      return;
    }
    setOtp((o) => { const n = [...o]; n[i] = digits; return n; });
    if (digits && i < 5) boxes.current[i + 1]?.focus();
  };

  const mmss = `00:${String(cooldown).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#F5F7FF] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1A237E] mb-4 shadow-xl">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1A237E]">Sanket</h1>
          <p className="text-sm text-slate-500 mt-1">Authority Portal</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          {error && <p role="alert" className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}
          {info && <p role="status" className="mb-4 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl p-3">{info}</p>}

          {step === 'login' && (
            <form onSubmit={(e) => { e.preventDefault(); void submitLogin(); }}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Sign in to continue</h2>
                <p className="text-sm text-slate-400 mt-1">Authorized officials only</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Official ID / Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required
                    placeholder="officer@police.gov.in"
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#2D3BE8] placeholder:text-slate-300 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="current-password" required
                      placeholder="Your password"
                      className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#2D3BE8] placeholder:text-slate-300 transition-colors pr-12" />
                    <button type="button" onClick={() => setShowPwd(v => !v)} aria-label="Show or hide password"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPwd ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end text-xs">
                  <button type="button" onClick={() => { setStep('forgot'); setError(null); }} className="text-[#2D3BE8] font-semibold">Forgot password?</button>
                </div>

                <button type="submit" disabled={busy || !email || !pwd}
                  className="w-full py-4 bg-[#1A237E] text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 hover:bg-[#2D3BE8] transition-colors disabled:opacity-50">
                  {busy ? 'Checking…' : 'Login'}
                </button>
              </div>

              <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <span className="text-base">🔐</span>
                <p className="text-xs text-amber-700">This portal is restricted to authorized officials only. Every sign-in and action is logged.</p>
              </div>
            </form>
          )}

          {step === 'otp' && challenge && (
            <>
              <div className="mb-6">
                <button onClick={() => { setStep('login'); setError(null); }} className="flex items-center gap-1 text-sm text-[#2D3BE8] font-medium mb-4">← Back</button>
                <h2 className="text-xl font-bold text-slate-900">Verify OTP</h2>
                <p className="text-sm text-slate-400 mt-1">Enter the 6-digit code sent to {challenge.destination}</p>
              </div>

              {challenge.devOtp && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-800">Development mode · your code is <span className="font-mono font-bold">{challenge.devOtp}</span></p>
                  <button onClick={() => { setOtp(challenge.devOtp!.split('')); void submitOtp(challenge.devOtp); }} className="text-xs font-bold text-[#2D3BE8]">Autofill</button>
                </div>
              )}

              <div className="flex gap-2 justify-between mb-6">
                {otp.map((d, i) => (
                  <input key={i} ref={(el) => { boxes.current[i] = el; }} value={d} inputMode="numeric" autoComplete="one-time-code"
                    onChange={e => setDigit(i, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Backspace' && !otp[i] && i > 0) boxes.current[i - 1]?.focus(); if (e.key === 'Enter') void submitOtp(); }}
                    aria-label={`Digit ${i + 1}`}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#2D3BE8] text-slate-800 transition-colors" />
                ))}
              </div>

              {cooldown > 0
                ? <p className="text-xs text-slate-400 mb-6">Resend OTP in {mmss}</p>
                : <button onClick={resend} disabled={busy} className="text-xs text-[#2D3BE8] font-semibold mb-6">Resend OTP</button>}

              <button onClick={() => void submitOtp()} disabled={busy || otp.some((d) => !d)}
                className="w-full py-4 bg-[#1A237E] text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 disabled:opacity-50">
                {busy ? 'Verifying…' : 'Verify & Login'}
              </button>
            </>
          )}

          {step === 'forgot' && (
            <form onSubmit={(e) => { e.preventDefault(); void run(async () => { await authority.forgotPassword(email.trim()); setInfo('If that account exists, reset instructions have been sent.'); setStep('reset'); }); }}>
              <button type="button" onClick={() => setStep('login')} className="flex items-center gap-1 text-sm text-[#2D3BE8] font-medium mb-4">← Back</button>
              <h2 className="text-xl font-bold text-slate-900">Reset your password</h2>
              <p className="text-sm text-slate-400 mt-1 mb-5">Enter your official ID or e-mail. We'll send a one-time reset token.</p>
              <input value={email} onChange={e => setEmail(e.target.value)} required placeholder="Official ID / Email"
                className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-[#2D3BE8] mb-4" />
              <button type="submit" disabled={busy || !email} className="w-full py-4 bg-[#1A237E] text-white font-bold rounded-xl disabled:opacity-50">{busy ? 'Sending…' : 'Send reset token'}</button>
              <button type="button" onClick={() => setStep('reset')} className="w-full mt-3 text-xs text-slate-400">I already have a token</button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={(e) => { e.preventDefault(); void run(async () => { await authority.resetPassword(resetToken.trim(), newPwd); setPwd(''); setStep('login'); setInfo('Password updated. Please sign in with your new password.'); }); }}>
              <button type="button" onClick={() => setStep('login')} className="flex items-center gap-1 text-sm text-[#2D3BE8] font-medium mb-4">← Back</button>
              <h2 className="text-xl font-bold text-slate-900">Choose a new password</h2>
              <p className="text-sm text-slate-400 mt-1 mb-5">Paste the reset token and pick a password with at least 10 characters, including a letter and a number.</p>
              <input value={resetToken} onChange={e => setResetToken(e.target.value)} required placeholder="Reset token"
                className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 text-sm font-mono focus:outline-none focus:border-[#2D3BE8] mb-3" />
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required placeholder="New password" autoComplete="new-password"
                className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-[#2D3BE8] mb-4" />
              <button type="submit" disabled={busy || !resetToken || newPwd.length < 10} className="w-full py-4 bg-[#1A237E] text-white font-bold rounded-xl disabled:opacity-50">{busy ? 'Saving…' : 'Update password'}</button>
            </form>
          )}
        </div>

        <button onClick={() => navigate('home')} className="w-full mt-4 text-center text-sm text-slate-400 hover:text-slate-600">
          ← Back to Citizen App
        </button>
      </div>
    </div>
  );
}
