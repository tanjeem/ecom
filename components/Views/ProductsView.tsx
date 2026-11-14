'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  GripVertical, PackagePlus, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Search, RefreshCw, Save, Undo2, ExternalLink, Pencil, X, LayoutGrid, List, Minus, Plus,
} from 'lucide-react';
import { Card, LoadingState, ErrorState, useToasts, ToastStack, Spinner } from '@/components/Finance/ui';
import { fmt } from '@/components/Finance/shared';
import { useApi } from '@/components/Finance/useApi';
import { AddProduct } from '@/components/Products/AddProduct';

type Variant = { id: number; size: string; sku: string; regularPrice: string; salePrice: string; stock: number };
type Product = {
  id: number; name: string; type: string; menuOrder: number; image: string | null; link: string; categories: string[];
  categoryIds: number[]; description: string; shortDescription: string;
  inStock: boolean; regularPrice: string; salePrice: string; stock: number; variants: Variant[];
};
type Data = { fetchedAt: string; products: Product[]; categories: { id: number; name: string; count: number }[] };

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
const sizeRank = (s: string) => { const i = SIZE_ORDER.indexOf(s.toUpperCase()); return i < 0 ? 99 : i; };

/** A product's sizes as editable rows; a simple product is one row standing for itself. */
const rowsOf = (p: Product): (Variant & { variationId: number | null })[] => p.variants.length
  ? [...p.variants].sort((a, b) => sizeRank(a.size) - sizeRank(b.size)).map(v => ({ ...v, variationId: v.id }))
  : [{ id: p.id, variationId: null, size: 'One size', sku: '', regularPrice: p.regularPrice, salePrice: p.salePrice, stock: p.stock }];

const stockOf = (p: Product) => rowsOf(p).reduce((s, r) => s + Math.max(0, r.stock), 0);

/** "৳1,155" or "৳1,155–1,350" across sizes, plus the regular price it's down from. */
function priceOf(p: Product) {
  const rows = rowsOf(p);
  const now = rows.map(r => Number(r.salePrice || r.regularPrice) || 0).filter(Boolean);
  const reg = rows.map(r => Number(r.regularPrice) || 0).filter(Boolean);
  if (!now.length) return { now: '—', was: null as string | null, off: 0 };
  const lo = Math.min(...now), hi = Math.max(...now);
  const onSale = rows.some(r => r.salePrice);
  const regHi = Math.max(...reg);
  return {
    now: lo === hi ? fmt(lo) : `${fmt(lo)}–${hi.toLocaleString()}`,
    was: onSale ? fmt(regHi) : null,
    off: onSale && regHi ? Math.round((1 - hi / regHi) * 100) : 0,
  };
}

/** Move the item at `from` to `to` within a list. */
const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, x);
  return next;
};

const btn: React.CSSProperties = {
  border: '1px solid #d9dee6', background: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center', color: '#0f172a', fontFamily: 'inherit',
};
const iconBtn: React.CSSProperties = {
  border: '1px solid #e2e7ee', background: '#fff', borderRadius: 7, width: 28, height: 28, display: 'inline-flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', color: '#475569', padding: 0,
};

export const ProductsView: React.FC = () => {
  const { data, error, loading, reload } = useApi<Data>('/api/catalog');
  const { toasts, push, dismiss } = useToasts();
  const [order, setOrder] = useState<number[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const byId = useMemo(() => new Map((data?.products || []).map(p => [p.id, p])), [data]);
  const dirty = order.length > 0 && order.join() !== saved.join();

  // Fresh data from WooCommerce: take its order, unless there's an unsaved arrangement to keep
  useEffect(() => {
    if (!data) return;
    const ids = data.products.map(p => p.id);
    setSaved(ids);
    setOrder(cur => {
      if (!cur.length || cur.join() === saved.join()) return ids;
      return [...cur.filter(id => ids.includes(id)), ...ids.filter(id => !cur.includes(id))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of data?.products || []) for (const c of p.categories) counts.set(c, (counts.get(c) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const matches = (p: Product | undefined) => {
    if (!p) return false;
    const needle = q.trim().toLowerCase();
    return (cat === 'All' || p.categories.includes(cat)) && (!needle || p.name.toLowerCase().includes(needle));
  };
  const visible = order.filter(id => matches(byId.get(id)));
  const filtered = visible.length !== order.length;

  /**
   * Reorder within what's on screen. With a category or search filter on, the other
   * products keep their places and the filtered ones swap among their own slots.
   */
  const reorderVisible = (from: number, to: number) => {
    const next = move(visible, from, to);
    let k = 0;
    const set = new Set(visible);
    setOrder(order.map(id => (set.has(id) ? next[k++] : id)));
  };
  const moveTo = (id: number, position: number) => setOrder(move(order, order.indexOf(id), position - 1));

  const drop = (targetId: number) => {
    if (dragId == null || dragId === targetId) return;
    reorderVisible(visible.indexOf(dragId), visible.indexOf(targetId));
  };
  const dragProps = (id: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(id)); },
    onDragOver: (e: React.DragEvent) => { if (dragId == null) return; e.preventDefault(); if (overId !== id) setOverId(id); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); drop(id); setDragId(null); setOverId(null); },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  });

  const saveOrder = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/catalog/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: order }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `Save failed (${r.status})`);
      setSaved(order);
      push({ text: j.moved ? `Shop order saved: ${j.moved} product${j.moved === 1 ? '' : 's'} moved. The store shows it within a minute.` : 'Nothing changed. The shop already has this order.' });
      reload();
    } catch (e: any) {
      push({ text: e.message, tone: 'error' }, 8000);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <section className="view"><LoadingState label="Loading products from WooCommerce…" /></section>;
  if (error && !data) return <section className="view"><ErrorState message="Could not load products" hint={error} onRetry={() => reload()} /></section>;

  const products = data?.products || [];
  const hidden = products.filter(p => !p.inStock).length;
  const editing = editId != null ? byId.get(editId) : undefined;
  const changedCount = order.filter((id, i) => saved[i] !== id).length;

  return (
    <section className="view" id="products-view" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card padding="14px 16px">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Shop order</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 3 }}>
              Drag products into the order customers should see them. #1 is first on the shop. Click <b>Edit</b> to change sizes, prices and stock.
              {' '}{products.length} on the shop{hidden ? `, ${hidden} sold out (hidden until restocked)` : ''}.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => setAdding(true)} style={{ ...btn, padding: '7px 14px', borderColor: '#0f172a' }}>
              <PackagePlus size={14} /> Add product
            </button>
            {dirty && (
              <button type="button" style={btn} onClick={() => setOrder(saved)} disabled={saving}><Undo2 size={13} /> Undo</button>
            )}
            <button type="button" onClick={saveOrder} disabled={!dirty || saving}
              style={{ ...btn, background: dirty ? '#0f172a' : '#f1f5f9', color: dirty ? '#fff' : '#94a3b8', borderColor: dirty ? '#0f172a' : '#e2e7ee', cursor: dirty ? 'pointer' : 'default', padding: '7px 14px' }}>
              {saving ? <Spinner size={13} /> : <Save size={13} />} {dirty ? `Save order to shop (${changedCount} moved)` : 'Order saved'}
            </button>
          </div>
        </div>
      </Card>

      <Card padding="14px 16px">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <label style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products" aria-label="Search products"
              style={{ width: '100%', border: '1px solid #d9dee6', borderRadius: 8, padding: '7px 10px 7px 30px', fontSize: '0.82rem' }} />
          </label>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', maxWidth: '100%' }}>
            {[['All', products.length] as [string, number], ...categories].map(([c, n]) => (
              <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
                style={{ ...btn, whiteSpace: 'nowrap', padding: '5px 10px', background: cat === c ? '#0f172a' : '#fff', color: cat === c ? '#fff' : '#334155', borderColor: cat === c ? '#0f172a' : '#e2e7ee' }}>
                {c} <span style={{ opacity: 0.6, fontWeight: 600 }}>{n}</span>
              </button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <div role="group" aria-label="Layout" style={{ display: 'inline-flex', border: '1px solid #d9dee6', borderRadius: 8, overflow: 'hidden' }}>
            {([['list', List, 'List'], ['grid', LayoutGrid, 'Shop view']] as const).map(([id, Icon, label]) => (
              <button key={id} type="button" onClick={() => setLayout(id)} aria-pressed={layout === id}
                style={{ border: 'none', padding: '6px 10px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center', fontFamily: 'inherit',
                  background: layout === id ? '#0f172a' : '#fff', color: layout === id ? '#fff' : '#334155' }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          <button type="button" style={btn} onClick={() => reload()} disabled={loading} aria-label="Reload from WooCommerce">
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>

        {filtered && (
          <div style={{ fontSize: '0.72rem', color: '#64748b', background: '#f8fafc', border: '1px solid #eef2f6', borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
            Showing {visible.length} of {order.length}. Moving these swaps them among their own places; the other products stay where they are. Numbers are positions on the main shop page.
          </div>
        )}

        {visible.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>No products match.</div>
        ) : layout === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visible.map((id, i) => {
              const p = byId.get(id)!;
              const pos = order.indexOf(id) + 1;
              const price = priceOf(p);
              const movedHere = saved.indexOf(id) !== order.indexOf(id);
              return (
                <div key={id} {...dragProps(id)} className={`prod-row${dragId === id ? ' is-dragging' : ''}${overId === id && dragId !== id ? ' is-over' : ''}`}
                  style={{ opacity: p.inStock ? 1 : 0.62 }}>
                  <GripVertical size={16} color="#94a3b8" className="prod-grip" aria-hidden />
                  <PositionInput pos={pos} max={order.length} changed={movedHere} onMove={n => moveTo(id, n)} />
                  <Thumb src={p.image} size={48} />
                  <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 3, fontSize: '0.7rem', color: '#64748b' }}>
                      <span>{p.categories.join(', ') || 'No category'}</span>
                      {!p.inStock && <span style={{ fontWeight: 800, color: '#b91c1c', background: '#fee2e2', borderRadius: 99, padding: '1px 7px' }}>Sold out · hidden on shop</span>}
                    </div>
                  </div>
                  <div className="prod-sizes"><SizeChips p={p} /></div>
                  <div className="prod-price">
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>{price.now}</div>
                    {price.was && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}><s>{price.was}</s> <b style={{ color: '#15803d' }}>{price.off}% off</b></div>}
                  </div>
                  <div className="prod-actions">
                    <button type="button" style={iconBtn} title="Move to top" aria-label={`Move ${p.name} to top`} disabled={pos === 1} onClick={() => moveTo(id, 1)}><ChevronsUp size={14} /></button>
                    <button type="button" style={iconBtn} title="Move up" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => reorderVisible(i, i - 1)}><ArrowUp size={14} /></button>
                    <button type="button" style={iconBtn} title="Move down" aria-label={`Move ${p.name} down`} disabled={i === visible.length - 1} onClick={() => reorderVisible(i, i + 1)}><ArrowDown size={14} /></button>
                    <button type="button" style={iconBtn} title="Move to bottom" aria-label={`Move ${p.name} to bottom`} disabled={pos === order.length} onClick={() => moveTo(id, order.length)}><ChevronsDown size={14} /></button>
                    <button type="button" style={{ ...btn, padding: '5px 10px' }} onClick={() => setEditId(id)}><Pencil size={12} /> Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="prod-grid">
            {visible.map(id => {
              const p = byId.get(id)!;
              const price = priceOf(p);
              const pos = order.indexOf(id) + 1;
              return (
                <div key={id} {...dragProps(id)} className={`prod-card${dragId === id ? ' is-dragging' : ''}${overId === id && dragId !== id ? ' is-over' : ''}`}
                  style={{ opacity: p.inStock ? 1 : 0.55 }}>
                  <div style={{ position: 'relative' }}>
                    <Thumb src={p.image} size="100%" />
                    <span style={{ position: 'absolute', top: 6, left: 6, background: saved.indexOf(id) !== order.indexOf(id) ? '#f59e0b' : '#0f172a', color: '#fff', fontSize: '0.7rem', fontWeight: 800, borderRadius: 6, padding: '2px 7px' }}>#{pos}</span>
                    {!p.inStock && <span style={{ position: 'absolute', bottom: 6, left: 6, right: 6, textAlign: 'center', background: 'rgba(127,29,29,0.88)', color: '#fff', fontSize: '0.66rem', fontWeight: 800, borderRadius: 6, padding: '2px 4px' }}>Sold out · hidden</span>}
                  </div>
                  <div style={{ padding: '8px 4px 2px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f172a', lineHeight: 1.25, minHeight: '2.5em' }}>{p.name}</div>
                    <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                      <b>{price.now}</b> {price.was && <s style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{price.was}</s>}
                    </div>
                    <button type="button" onClick={() => setEditId(id)} style={{ ...btn, marginTop: 6, width: '100%', justifyContent: 'center', padding: '4px 8px' }}><Pencil size={12} /> Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && (
        <ProductEditor key={editing.id} product={editing} onClose={() => setEditId(null)}
          onSaved={msg => { push({ text: msg }); setEditId(null); reload(); }}
          onError={msg => push({ text: msg, tone: 'error' }, 9000)} />
      )}
      {adding && (
        <AddProduct categories={data?.categories || []} onClose={() => setAdding(false)}
          templates={products.map(p => ({ id: p.id, name: p.name, categoryIds: p.categoryIds, description: p.description, shortDescription: p.shortDescription,
            regularPrice: p.regularPrice, salePrice: p.salePrice, variants: p.variants.map(v => ({ size: v.size, regularPrice: v.regularPrice, salePrice: v.salePrice })) }))}
          onCreated={(msg, link) => { setAdding(false); push({ text: msg, action: { label: 'View', run: () => window.open(link, '_blank') } }, 10000); reload(); }} />
      )}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </section>
  );
};

const Thumb = ({ src, size }: { src: string | null; size: number | string }) => (
  <div style={{ width: size, height: typeof size === 'number' ? size : undefined, aspectRatio: '1', flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9' }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src && <img src={src} alt="" draggable={false} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
  </div>
);

const SizeChips = ({ p }: { p: Product }) => (
  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
    {rowsOf(p).map(r => (
      <span key={r.id} title={`${r.size}: ${r.stock} in stock`}
        style={{ fontSize: '0.68rem', fontWeight: 700, borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap',
          background: r.stock > 0 ? '#f1f5f9' : '#fef2f2', color: r.stock > 0 ? '#334155' : '#dc2626' }}>
        {r.variationId == null ? 'Stock' : r.size} <b>{r.stock}</b>
      </span>
    ))}
    <span style={{ fontSize: '0.68rem', color: '#94a3b8', padding: '2px 2px' }}>= {stockOf(p)}</span>
  </div>
);

/** The position number; type a new one to send the product there. */
const PositionInput = ({ pos, max, changed, onMove }: { pos: number; max: number; changed: boolean; onMove: (n: number) => void }) => {
  const [v, setV] = useState(String(pos));
  useEffect(() => setV(String(pos)), [pos]);
  const commit = () => {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= 1 && n !== pos) onMove(Math.min(max, n)); else setV(String(pos));
  };
  return (
    <input value={v} inputMode="numeric" aria-label="Position on the shop" title="Type a position and press Enter"
      onChange={e => setV(e.target.value.replace(/\D/g, ''))} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onFocus={e => e.target.select()}
      style={{ width: 40, textAlign: 'center', border: `1px solid ${changed ? '#f59e0b' : '#e2e7ee'}`, background: changed ? '#fffbeb' : '#fff', borderRadius: 7,
        padding: '5px 2px', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', flexShrink: 0 }} />
  );
};

// ─── editor ──────────────────────────────────────────────────────────────────

type Edit = { regularPrice: string; salePrice: string; stock: string };
const SALE_STEPS = [0, 10, 20, 25, 30, 40, 50];

const ProductEditor = ({ product, onClose, onSaved, onError }: {
  product: Product; onClose: () => void; onSaved: (msg: string) => void; onError: (msg: string) => void;
}) => {
  const rows = rowsOf(product);
  const [edits, setEdits] = useState<Record<number, Edit>>(() =>
    Object.fromEntries(rows.map(r => [r.id, { regularPrice: r.regularPrice, salePrice: r.salePrice, stock: String(r.stock) }])));
  const [allRegular, setAllRegular] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [busy, onClose]);

  const set = (id: number, k: keyof Edit, v: string) => setEdits(s => ({ ...s, [id]: { ...s[id], [k]: v } }));
  const clean = (v: string) => v.replace(/[^\d.]/g, '');

  const applyAll = (regular: string, pct: number | null) => setEdits(s => Object.fromEntries(rows.map(r => {
    const e = s[r.id];
    const reg = regular || e.regularPrice;
    const sale = pct == null ? e.salePrice : pct === 0 ? '' : String(Math.round(Number(reg) * (1 - pct / 100)));
    return [r.id, { ...e, regularPrice: reg, salePrice: sale }];
  })));

  const diff = rows.map(r => {
    const e = edits[r.id];
    const priceChanged = e.regularPrice !== r.regularPrice || e.salePrice !== r.salePrice;
    const stockChanged = e.stock !== String(r.stock);
    return { r, e, priceChanged, stockChanged };
  }).filter(d => d.priceChanged || d.stockChanged);

  const problems = rows.flatMap(r => {
    const e = edits[r.id];
    const out: string[] = [];
    if (!e.regularPrice || Number(e.regularPrice) <= 0) out.push(`${r.size}: regular price is empty`);
    if (e.salePrice && Number(e.salePrice) >= Number(e.regularPrice)) out.push(`${r.size}: sale must be below regular`);
    if (e.stock === '' || !Number.isInteger(Number(e.stock)) || Number(e.stock) < 0) out.push(`${r.size}: stock must be 0 or more`);
    return out;
  });

  const save = async () => {
    setBusy(true);
    try {
      const changes = diff.map(({ r, e, priceChanged, stockChanged }) => ({
        variationId: r.variationId, size: r.variationId == null ? undefined : r.size,
        ...(priceChanged ? { regularPrice: e.regularPrice, salePrice: e.salePrice } : {}),
        ...(stockChanged ? { stock: Number(e.stock), stockWas: r.stock } : {}),
      }));
      const res = await fetch('/api/catalog/product', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, productName: product.name, changes }),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || `Save failed (${res.status})`);
      onSaved(`${product.name}: ${diff.length} size${diff.length === 1 ? '' : 's'} updated on WooCommerce.${j.logged === false ? ' (Stock log could not be written.)' : ''}`);
    } catch (e: any) {
      onError(e.message);
      setBusy(false);
    }
  };

  const cell: React.CSSProperties = { padding: '7px 6px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
  const input = (changed: boolean, bad = false): React.CSSProperties => ({
    width: '100%', minWidth: 0, border: `1px solid ${bad ? '#f87171' : changed ? '#f59e0b' : '#d9dee6'}`, background: changed ? '#fffbeb' : '#fff',
    borderRadius: 7, padding: '6px 8px', fontSize: '0.82rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#0f172a',
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={`Edit ${product.name}`} className="prod-editor-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="prod-editor">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #eef2f6' }}>
          <Thumb src={product.image} size={52} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{product.name}</div>
            <a href={product.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#2563eb', display: 'inline-flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
              View on shop <ExternalLink size={11} />
            </a>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn} disabled={busy}><X size={15} /></button>
        </div>

        <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1 }}>
          {rows.length > 1 && (
            <div style={{ background: '#f8fafc', border: '1px solid #eef2f6', borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: 6 }}>Set every size at once</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={allRegular} onChange={e => setAllRegular(clean(e.target.value))} placeholder="Regular price" inputMode="decimal" aria-label="Regular price for all sizes"
                  style={{ ...input(false), width: 120 }} />
                <button type="button" style={btn} disabled={!allRegular} onClick={() => applyAll(allRegular, null)}>Apply price</button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginRight: 2 }}>Sale{rows.length > 1 ? ' (all sizes)' : ''}:</span>
            {SALE_STEPS.map(p => (
              <button key={p} type="button" onClick={() => applyAll('', p)} style={{ ...btn, padding: '4px 9px', fontSize: '0.74rem' }}>
                {p === 0 ? 'No sale' : `${p}% off`}
              </button>
            ))}
          </div>

          <table style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: '17%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /><col style={{ width: '10%' }} /><col style={{ width: '25%' }} /></colgroup>
            <thead>
              <tr style={{ fontSize: '0.66rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>
                <th style={cell}>Size</th><th style={cell}>Regular ৳</th><th style={cell}>Sale ৳</th><th style={cell}>Off</th><th style={cell}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const e = edits[r.id];
                const off = e.salePrice && Number(e.regularPrice) ? Math.round((1 - Number(e.salePrice) / Number(e.regularPrice)) * 100) : 0;
                const badSale = !!e.salePrice && Number(e.salePrice) >= Number(e.regularPrice);
                const stockN = Number(e.stock) || 0;
                return (
                  <tr key={r.id}>
                    <td style={{ ...cell, fontWeight: 800, fontSize: '0.84rem' }}>{r.size}</td>
                    <td style={cell}>
                      <input value={e.regularPrice} onChange={ev => set(r.id, 'regularPrice', clean(ev.target.value))} inputMode="decimal" aria-label={`${r.size} regular price`}
                        style={input(e.regularPrice !== r.regularPrice, !e.regularPrice)} />
                    </td>
                    <td style={cell}>
                      <input value={e.salePrice} onChange={ev => set(r.id, 'salePrice', clean(ev.target.value))} inputMode="decimal" placeholder="No sale" aria-label={`${r.size} sale price`}
                        style={input(e.salePrice !== r.salePrice, badSale)} />
                    </td>
                    <td style={{ ...cell, fontSize: '0.76rem', fontWeight: 800, color: off > 0 ? '#15803d' : '#cbd5e1' }}>{off > 0 ? `${off}%` : '—'}</td>
                    <td style={cell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <button type="button" style={{ ...iconBtn, width: 26, height: 30 }} aria-label={`${r.size} one less`} disabled={stockN <= 0} onClick={() => set(r.id, 'stock', String(Math.max(0, stockN - 1)))}><Minus size={12} /></button>
                        <input value={e.stock} onChange={ev => set(r.id, 'stock', ev.target.value.replace(/\D/g, ''))} inputMode="numeric" aria-label={`${r.size} stock`}
                          style={{ ...input(e.stock !== String(r.stock), e.stock === ''), textAlign: 'center', padding: '6px 2px' }} />
                        <button type="button" style={{ ...iconBtn, width: 26, height: 30 }} aria-label={`${r.size} one more`} onClick={() => set(r.id, 'stock', String(stockN + 1))}><Plus size={12} /></button>
                      </div>
                      {e.stock !== String(r.stock) && <div style={{ fontSize: '0.64rem', color: '#92400e', textAlign: 'center', marginTop: 2 }}>was {r.stock}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '10px 0 0' }}>
            Stock changes are logged in Inventory’s adjustment history. Leave the sale price empty for no sale.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', padding: '12px 16px', borderTop: '1px solid #eef2f6' }}>
          <span style={{ flex: 1, fontSize: '0.74rem', color: problems.length ? '#dc2626' : '#64748b', minWidth: 160 }}>
            {problems.length ? problems[0] : diff.length ? `${diff.length} size${diff.length === 1 ? '' : 's'} changed` : 'No changes yet'}
          </span>
          <button type="button" style={btn} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" onClick={save} disabled={busy || !diff.length || problems.length > 0}
            style={{ ...btn, background: diff.length && !problems.length ? '#0f172a' : '#f1f5f9', color: diff.length && !problems.length ? '#fff' : '#94a3b8', borderColor: 'transparent', padding: '7px 14px' }}>
            {busy ? <Spinner size={13} /> : <Save size={13} />} Save to WooCommerce
          </button>
        </div>
      </div>
    </div>
  );
};
