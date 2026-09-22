import { useState } from 'react';
import type { Screen } from '../../types';
import Sidebar from './Sidebar';
import { authority, friendly, toApiError, type StaffUser } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useStaff } from '../../hooks/useStaff';
import { AccessDenied, ErrorBox, Loading } from '../../components/ui/StateViews';

const ROLE_OPTIONS = [
  { value: 'officer', label: 'Authority Officer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Administrator' },
];

export default function AccessControl({ navigate }: { navigate: (s: Screen) => void }) {
  const { user: me, can } = useStaff();
  const allowed = can('users:manage');
  const roles = useAsync(() => (allowed ? authority.roles() : Promise.resolve(null)), [allowed]);
  const users = useAsync(() => (allowed ? authority.users() : Promise.resolve(null)), [allowed]);
  const [modal, setModal] = useState<null | { kind: 'add' } | { kind: 'edit'; user: StaffUser }>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = async (u: StaffUser, body: { role?: string; status?: string }, ok: string) => {
    try {
      await authority.updateUser(u.id, body);
      setMsg({ ok: true, text: ok });
      users.reload();
    } catch (e) {
      setMsg({ ok: false, text: friendly(toApiError(e)) });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F7FF]">
      <Sidebar active="auth-access" navigate={navigate} />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Users & Access Control</h1>
          <p className="text-xs text-slate-400">Role-based access control (RBAC) for authority portal</p>
        </div>

        {!allowed ? <AccessDenied what="manage users and roles" /> : (
        <div className="grid grid-cols-2 gap-6">
          {/* Permission matrix */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 col-span-2">
            <h3 className="font-semibold text-slate-800 mb-4">Permission Matrix</h3>
            {roles.loading && !roles.data && <Loading rows={2} />}
            {roles.error && <ErrorBox error={roles.error} onRetry={roles.reload} compact />}
            {roles.data && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-48">Permission</th>
                      {roles.data.roles.map(r => <th key={r.id} className="pb-3 text-xs font-semibold text-slate-700 text-center">{r.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {roles.data.permissions.map((p) => (
                      <tr key={p.id} className="border-t border-slate-50">
                        <td className="py-3 text-sm text-slate-600">{p.label}</td>
                        {roles.data!.roles.map((r) => <td key={r.id} className="py-3 text-center"><PermIcon val={!!roles.data!.matrix[r.id]?.[p.id]} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Users list */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Authority Users</h3>
              <button onClick={() => { setModal({ kind: 'add' }); setMsg(null); }} className="px-4 py-2 bg-[#1A237E] text-white text-xs font-semibold rounded-xl">+ Add User</button>
            </div>
            {msg && <p role="status" className={`mb-3 text-xs rounded-xl p-3 border ${msg.ok ? 'text-green-700 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg.text}</p>}
            {users.loading && !users.data && <Loading rows={3} />}
            {users.error && <ErrorBox error={users.error} onRetry={users.reload} compact />}
            {users.data && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Name', 'Official ID', 'Email', 'Role', 'Status', 'Actions'].map(h => <th key={h} className="text-left pb-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {users.data.users.map((u) => {
                    const self = u.id === me?.id;
                    return (
                      <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-3 text-sm font-semibold text-slate-800">{u.name}{self && <span className="ml-2 text-[10px] text-slate-400">(you)</span>}</td>
                        <td className="py-3 text-xs font-mono text-slate-500">{u.officialId}</td>
                        <td className="py-3 text-xs text-slate-400">{u.email}</td>
                        <td className="py-3"><span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{u.roleLabel}</span></td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${u.status === 'active' ? 'bg-green-500' : 'bg-slate-300'}`} />
                            <span className="text-xs text-slate-500 capitalize">{u.status}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <button disabled={self} onClick={() => { setModal({ kind: 'edit', user: u }); setMsg(null); }} className="text-xs text-blue-600 font-semibold px-2 py-1 bg-blue-50 rounded-lg disabled:opacity-30">Edit</button>
                            {u.status === 'active'
                              ? <button disabled={self} onClick={() => { if (window.confirm(`Revoke access for ${u.name}? They will be signed out immediately.`)) void patch(u, { status: 'inactive' }, `${u.name}'s access was revoked.`); }} className="text-xs text-red-500 font-semibold px-2 py-1 bg-red-50 rounded-lg disabled:opacity-30">Revoke</button>
                              : <button onClick={() => patch(u, { status: 'active' }, `${u.name} was reactivated.`)} className="text-xs text-green-600 font-semibold px-2 py-1 bg-green-50 rounded-lg">Reactivate</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        )}
      </main>

      {modal?.kind === 'add' && <AddUser onClose={() => setModal(null)} onDone={() => { setModal(null); setMsg({ ok: true, text: 'User created.' }); users.reload(); }} />}
      {modal?.kind === 'edit' && (
        <EditUser user={modal.user} onClose={() => setModal(null)}
          onSave={(role) => { setModal(null); void patch(modal.user, { role }, `${modal.user.name} is now ${ROLE_OPTIONS.find((r) => r.value === role)?.label}. Their sessions were ended so the new permissions apply.`); }} />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 text-xs" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const input = 'w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-[#2D3BE8]';

function AddUser({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ officialId: '', name: '', email: '', role: 'officer', password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await authority.createUser(f);
      onDone();
    } catch (x) {
      const a = toApiError(x);
      const first = (a.details as { message: string }[] | undefined)?.[0]?.message;
      setErr(a.code === 'VALIDATION_ERROR' && first ? first : friendly(a));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add authority user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input className={input} placeholder="Full name" value={f.name} onChange={set('name')} required />
        <input className={input} placeholder="Official ID (e.g. PN-OFC-0999)" value={f.officialId} onChange={set('officialId')} required />
        <input className={input} type="email" placeholder="Official e-mail" value={f.email} onChange={set('email')} required />
        <select className={input} value={f.role} onChange={set('role')}>{ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        <input className={input} type="password" placeholder="Initial password (10+ chars, letter + number)" value={f.password} onChange={set('password')} required autoComplete="new-password" />
        {err && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2.5">{err}</p>}
        <button disabled={busy} className="w-full py-3 bg-[#1A237E] text-white text-sm font-semibold rounded-xl disabled:opacity-50">{busy ? 'Creating…' : 'Create user'}</button>
      </form>
    </Modal>
  );
}

function EditUser({ user, onClose, onSave }: { user: StaffUser; onClose: () => void; onSave: (role: string) => void }) {
  const [role, setRole] = useState<string>(user.role);
  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose}>
      <label className="text-xs font-semibold text-slate-500">Role</label>
      <select className={`${input} mt-1 mb-3`} value={role} onChange={(e) => setRole(e.target.value)}>{ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
      <p className="text-[11px] text-slate-400 mb-4">Changing a role signs the user out everywhere, so the new permissions apply on their next sign-in. The change is recorded in the audit log.</p>
      <button disabled={role === user.role} onClick={() => onSave(role)} className="w-full py-3 bg-[#1A237E] text-white text-sm font-semibold rounded-xl disabled:opacity-40">Save role</button>
    </Modal>
  );
}

function PermIcon({ val }: { val: boolean }) {
  return val ? (
    <div className="inline-flex w-6 h-6 rounded-full bg-green-100 items-center justify-center">
      <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
  ) : (
    <div className="inline-flex w-6 h-6 rounded-full bg-slate-100 items-center justify-center">
      <svg className="w-3 h-3 text-slate-300" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </div>
  );
}
