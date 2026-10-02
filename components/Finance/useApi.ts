'use client';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

/** GET a JSON endpoint; re-fetches when `url` changes. `reload(true)` asks the server to skip its cache. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [nonce, setNonce] = useState<{ n: number; refresh: boolean }>({ n: 0, refresh: false });

  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    setLoading(true);
    const full = nonce.refresh ? `${url}${url.includes('?') ? '&' : '?'}refresh=1` : url;
    fetch(full, { signal: ctrl.signal })
      .then(async r => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || `Request failed (${r.status})`); return j as T; })
      .then(j => { setData(j); setError(null); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [url, nonce]);

  const reload = useCallback((refresh = false) => setNonce(s => ({ n: s.n + 1, refresh })), []);
  return { data, error, loading, reload };
}

export const th: React.CSSProperties = {
  textAlign: 'left', padding: '9px 12px', fontSize: '0.66rem', fontWeight: 800, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e7ee', whiteSpace: 'nowrap', background: '#f8fafc',
};
export const td: React.CSSProperties = { padding: '9px 12px', fontSize: '0.8rem', color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };
export const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
