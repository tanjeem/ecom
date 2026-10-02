'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, LogIn } from 'lucide-react';

const field: React.CSSProperties = {
  width: '100%', border: '1px solid #d9dee6', borderRadius: 9, padding: '11px 12px', fontSize: '0.92rem',
  background: '#fff', color: '#202124', outline: 'none',
};

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Sign-in failed');
      // Only follow same-site paths, never an absolute URL from the query string
      const next = params.get('next') || '/';
      window.location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/';
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
        Username
        <input autoFocus autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required style={field} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
        Password
        <span style={{ position: 'relative', display: 'block' }}>
          <input type={show ? 'text' : 'password'} autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)} required style={{ ...field, paddingRight: 42 }} />
          <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', padding: 4 }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Keep me signed in for 30 days
      </label>
      {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.82rem', fontWeight: 600 }}>{error}</div>}
      <button type="submit" disabled={busy}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 14px', border: 'none', borderRadius: 9, background: '#111', color: '#fff', fontWeight: 800, fontSize: '0.92rem', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
        <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '24px 16px', background: '#f6f7f9' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', border: '1px solid #e2e7ee', borderRadius: 16, padding: '30px 28px', boxShadow: '0 18px 45px rgba(27,35,45,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900 }}>TO</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0f172a' }}>ThreadOps</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={11} /> Sign in to continue</div>
          </div>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
