'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, X, Star, ChevronLeft, ChevronRight, Save, Plus, Copy, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/Finance/ui';
import { supabase } from '@/lib/supabase';

type Template = {
  id: number; name: string; categoryIds: number[]; description: string; shortDescription: string;
  regularPrice: string; salePrice: string; variants: { size: string; regularPrice: string; salePrice: string }[];
};
type Photo = { key: string; preview: string; url?: string; state: 'uploading' | 'ready' | 'failed'; error?: string };
type SizeRow = { size: string; stock: string; regularPrice: string; salePrice: string };

const BUCKET = 'product-uploads';
const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const SALE_STEPS = [0, 10, 20, 25, 30, 40, 50];
const SIZE_LINE = /^\s*(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL)\s*[:\-–]/i;

/** Shrink big camera photos before upload; WordPress scales anything past 2560px anyway. */
async function shrink(file: File): Promise<Blob> {
  if (file.size < 1_500_000 && /image\/(jpeg|png|webp)/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fail) => canvas.toBlob(b => (b ? ok(b) : fail(new Error('Could not read this photo'))), 'image/jpeg', 0.88));
}

/** WooCommerce HTML → text the user can edit, and back. */
function htmlToText(html: string) {
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n\n');
  const text = new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent || '';
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textToHtml = (text: string) => text.trim()
  ? text.trim().split(/\n\s*\n/).map(p => `<p>${p.split('\n').map(esc).join('<br />\n')}</p>`).join('\n')
  : '';

const clean = (v: string) => v.replace(/[^\d.]/g, '');
const field: React.CSSProperties = {
  width: '100%', minWidth: 0, border: '1px solid #d9dee6', borderRadius: 8, padding: '8px 10px', fontSize: '0.84rem', fontFamily: 'inherit', color: '#0f172a', background: '#fff',
};
const label: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: 5 };
const chip = (on: boolean): React.CSSProperties => ({
  border: `1px solid ${on ? '#0f172a' : '#d9dee6'}`, background: on ? '#0f172a' : '#fff', color: on ? '#fff' : '#334155', borderRadius: 8,
  padding: '5px 11px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
});
const section: React.CSSProperties = { padding: '14px 18px', borderBottom: '1px solid #eef2f6' };
const sectionTitle: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 };

export const AddProduct = ({ categories, templates, onClose, onCreated }: {
  categories: { id: number; name: string }[];
  templates: Template[];
  onClose: () => void;
  onCreated: (msg: string, link: string) => void;
}) => {
  const [name, setName] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sizes, setSizes] = useState<SizeRow[]>(['S', 'M', 'L', 'XL'].map(size => ({ size, stock: '', regularPrice: '', salePrice: '' })));
  const [oneSize, setOneSize] = useState({ stock: '', regularPrice: '', salePrice: '' });
  const [noSizes, setNoSizes] = useState(false);
  const [allRegular, setAllRegular] = useState('');
  const [salePct, setSalePct] = useState<number | null>(null);
  const [customSize, setCustomSize] = useState('');
  const [sizeChart, setSizeChart] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'publish' | 'draft'>('publish');
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [copiedFrom, setCopiedFrom] = useState('');
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overDrop, setOverDrop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty = !!(name || photos.length || description || sizeChart);
  const close = () => { if (busy) return; if (!dirty || confirm('Discard this new product?')) onClose(); };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  });

  // ── photos ──
  const addFiles = (files: FileList | File[]) => {
    const list = [...files].filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)).slice(0, 12 - photos.length);
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setPhotos(ps => [...ps, { key, preview: URL.createObjectURL(file), state: 'uploading' }]);
      (async () => {
        const blob = await shrink(file);
        const fileName = blob === file ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg';
        const r = await fetch('/api/catalog/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName }) });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || 'Upload failed');
        const { error: upErr } = await supabase.storage.from(BUCKET).uploadToSignedUrl(j.path, j.token, blob, { contentType: blob.type || 'image/jpeg' });
        if (upErr) throw new Error(upErr.message);
        setPhotos(ps => ps.map(p => (p.key === key ? { ...p, url: j.publicUrl, state: 'ready' } : p)));
      })().catch(e => setPhotos(ps => ps.map(p => (p.key === key ? { ...p, state: 'failed', error: /decode|read|source/i.test(e.message) ? 'Can’t read this file. Use JPG or PNG.' : e.message } : p))));
    }
  };
  const movePhoto = (from: number, to: number) => setPhotos(ps => {
    if (to < 0 || to >= ps.length) return ps;
    const next = [...ps]; const [x] = next.splice(from, 1); next.splice(to, 0, x); return next;
  });

  // ── sizes & prices ──
  const toggleSize = (size: string) => setSizes(rows => rows.some(r => r.size === size)
    ? rows.filter(r => r.size !== size)
    : [...rows, { size, stock: '', regularPrice: allRegular, salePrice: salePct ? String(Math.round(Number(allRegular) * (1 - salePct / 100))) : '' }]
      .sort((a, b) => {
        const ia = COMMON_SIZES.indexOf(a.size), ib = COMMON_SIZES.indexOf(b.size);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      }));
  const setRow = (size: string, k: keyof SizeRow, v: string) => setSizes(rows => rows.map(r => (r.size === size ? { ...r, [k]: v } : r)));
  const salePrice = (reg: string, pct: number | null) => (pct && Number(reg) ? String(Math.round(Number(reg) * (1 - pct / 100))) : '');
  const applyPrices = (reg: string, pct: number | null) => {
    setAllRegular(reg); setSalePct(pct);
    setSizes(rows => rows.map(r => ({ ...r, regularPrice: reg || r.regularPrice, salePrice: pct == null ? r.salePrice : salePrice(reg || r.regularPrice, pct) })));
    setOneSize(s => ({ ...s, regularPrice: reg || s.regularPrice, salePrice: pct == null ? s.salePrice : salePrice(reg || s.regularPrice, pct) }));
  };

  const copyFrom = (id: string) => {
    setCopiedFrom(id);
    const t = templates.find(x => String(x.id) === id);
    if (!t) return;
    setCategoryIds(t.categoryIds);
    setDescription(htmlToText(t.description));
    setSizeChart(htmlToText(t.shortDescription));
    const v = t.variants;
    if (v.length) {
      setNoSizes(false);
      const sorted = [...v].sort((a, b) => COMMON_SIZES.indexOf(a.size) - COMMON_SIZES.indexOf(b.size));
      setSizes(sorted.map(x => ({ size: x.size, stock: '', regularPrice: x.regularPrice, salePrice: x.salePrice })));
      const reg = sorted[0].regularPrice, sale = sorted[0].salePrice;
      setAllRegular(reg);
      setSalePct(sale && Number(reg) ? Math.round((1 - Number(sale) / Number(reg)) * 100) : 0);
    } else {
      setNoSizes(true);
      setOneSize({ stock: '', regularPrice: t.regularPrice, salePrice: t.salePrice });
    }
  };

  // Each size's own measurement line from the chart ("L: WAIST 34 …"), shown when that size is picked
  const chartLines = Object.fromEntries(sizeChart.split('\n').map(l => [l.match(SIZE_LINE)?.[1]?.toUpperCase(), l.trim()]).filter(([k]) => k));

  // ── checks ──
  const problems: string[] = [];
  if (!name.trim()) problems.push('Give the product a name');
  if (!photos.some(p => p.state === 'ready')) problems.push('Add at least one photo');
  if (photos.some(p => p.state === 'uploading')) problems.push('Wait for the photos to finish uploading');
  if (!categoryIds.length) problems.push('Pick a category');
  const rows = noSizes ? [{ size: 'Price', ...oneSize }] : sizes;
  if (!noSizes && !sizes.length) problems.push('Pick at least one size');
  for (const r of rows) {
    if (!(Number(r.regularPrice) > 0)) { problems.push(`${r.size}: enter a regular price`); break; }
    if (r.salePrice && Number(r.salePrice) >= Number(r.regularPrice)) { problems.push(`${r.size}: sale must be below regular`); break; }
    if (r.stock === '') { problems.push(`${r.size}: enter stock (0 is fine)`); break; }
  }

  const create = async () => {
    setBusy(true); setError('');
    try {
      const body = {
        name: name.trim(), status, position, categoryIds,
        imageUrls: photos.filter(p => p.state === 'ready').map(p => p.url),
        description: textToHtml(description), shortDescription: textToHtml(sizeChart),
        sizes: noSizes ? [] : sizes.map(r => ({ size: r.size, stock: Number(r.stock), regularPrice: r.regularPrice, salePrice: r.salePrice, description: chartLines[r.size.toUpperCase()] || '' })),
        ...(noSizes ? { stock: Number(oneSize.stock), regularPrice: oneSize.regularPrice, salePrice: oneSize.salePrice } : {}),
      };
      const r = await fetch('/api/catalog/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `Failed (${r.status})`);
      onCreated(j.warning || (status === 'publish' ? `${name.trim()} is live on the shop${position === 'top' ? ' at #1' : ''}.` : `${name.trim()} saved as a draft (not on the shop yet).`), j.link);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  const totalStock = rows.reduce((s, r) => s + (Number(r.stock) || 0), 0);

  return (
    <div role="dialog" aria-modal="true" aria-label="Add a product" className="prod-editor-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="prod-editor" style={{ width: 'min(680px, 100vw)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #eef2f6' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Add a product</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Goes straight to WooCommerce with sizes, prices and stock.</div>
          </div>
          <button type="button" onClick={close} aria-label="Close" disabled={busy}
            style={{ border: '1px solid #e2e7ee', background: '#fff', borderRadius: 7, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {templates.length > 0 && (
            <div style={{ ...section, background: '#f8fafc' }}>
              <label style={label} htmlFor="np-copy"><Copy size={11} style={{ verticalAlign: -1 }} /> Start from an existing product (optional)</label>
              <select id="np-copy" value={copiedFrom} onChange={e => copyFrom(e.target.value)} style={field}>
                <option value="">— Blank —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 5 }}>Copies its category, sizes, prices, size chart and description. Name, photos and stock stay yours.</div>
            </div>
          )}

          <div style={section}>
            <div style={sectionTitle}>Photos</div>
            <div
              onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOverDrop(true); } }}
              onDragLeave={() => setOverDrop(false)}
              onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } setOverDrop(false); }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8, padding: photos.length ? 0 : 0 }}>
              {photos.map((p, i) => (
                <div key={p.key} draggable onDragStart={() => setDragKey(p.key)} onDragEnd={() => setDragKey(null)}
                  onDragOver={e => { if (dragKey) e.preventDefault(); }}
                  onDrop={e => { if (dragKey) { e.preventDefault(); e.stopPropagation(); movePhoto(photos.findIndex(x => x.key === dragKey), i); setDragKey(null); } }}
                  style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#f1f5f9', border: i === 0 ? '2px solid #0f172a' : '1px solid #e2e7ee', cursor: 'grab', opacity: dragKey === p.key ? 0.4 : 1 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: p.state === 'uploading' ? 0.5 : 1 }} />
                  {i === 0 && <span style={{ position: 'absolute', top: 5, left: 5, background: '#0f172a', color: '#fff', fontSize: '0.62rem', fontWeight: 800, borderRadius: 5, padding: '1px 6px' }}>Main</span>}
                  <button type="button" aria-label="Remove photo" onClick={() => setPhotos(ps => ps.filter(x => x.key !== p.key))}
                    style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 99, border: 'none', background: 'rgba(15,23,42,0.75)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X size={12} />
                  </button>
                  {p.state === 'uploading' && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}><Spinner size={18} /></span>}
                  {p.state === 'failed' && <span title={p.error} style={{ position: 'absolute', inset: 'auto 0 0 0', background: 'rgba(127,29,29,0.9)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, padding: '3px 5px' }}>{p.error || 'Failed'}</span>}
                  {p.state === 'ready' && photos.length > 1 && (
                    <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <button type="button" aria-label="Move left" disabled={i === 0} onClick={() => movePhoto(i, i - 1)} style={miniBtn(i === 0)}><ChevronLeft size={12} /></button>
                      {i !== 0 && <button type="button" title="Make main photo" aria-label="Make main photo" onClick={() => movePhoto(i, 0)} style={miniBtn(false)}><Star size={11} /></button>}
                      <button type="button" aria-label="Move right" disabled={i === photos.length - 1} onClick={() => movePhoto(i, i + 1)} style={miniBtn(i === photos.length - 1)}><ChevronRight size={12} /></button>
                    </div>
                  )}
                </div>
              ))}
              {photos.length < 12 && (
                <button type="button" onClick={() => fileInput.current?.click()}
                  style={{ aspectRatio: photos.length ? '1' : 'auto', borderRadius: 10, border: `2px dashed ${overDrop ? '#0f172a' : '#cbd5e1'}`, background: overDrop ? '#f1f5f9' : '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#64748b', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'inherit', gridColumn: photos.length ? undefined : '1 / -1', minHeight: photos.length ? undefined : 120 }}>
                  <ImagePlus size={20} />
                  {photos.length ? 'Add more' : 'Drop photos here or click to choose'}
                </button>
              )}
            </div>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
            {photos.length > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>The first photo is the main one on the shop. Drag to reorder, or tap ★.</div>}
          </div>

          <div style={section}>
            <div style={sectionTitle}>Details</div>
            <label style={label} htmlFor="np-name">Name</label>
            <input id="np-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cairo | Half Sleeve Shirt" style={field} />
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>Your products are named “Name | Type”.</div>
            <div style={{ marginTop: 12 }}>
              <span style={label}>Category</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {categories.map(c => (
                  <button key={c.id} type="button" aria-pressed={categoryIds.includes(c.id)} style={chip(categoryIds.includes(c.id))}
                    onClick={() => setCategoryIds(ids => (ids.includes(c.id) ? ids.filter(x => x !== c.id) : [...ids, c.id]))}>{c.name}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ ...sectionTitle, marginBottom: 0 }}>Sizes, prices & stock</div>
              <label style={{ fontSize: '0.74rem', color: '#475569', display: 'inline-flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={noSizes} onChange={e => setNoSizes(e.target.checked)} /> One size only
              </label>
            </div>
            {!noSizes && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                {[...COMMON_SIZES, ...sizes.map(s => s.size).filter(s => !COMMON_SIZES.includes(s))].map(s => (
                  <button key={s} type="button" aria-pressed={sizes.some(r => r.size === s)} style={chip(sizes.some(r => r.size === s))} onClick={() => toggleSize(s)}>{s}</button>
                ))}
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <input value={customSize} onChange={e => setCustomSize(e.target.value.slice(0, 12))} placeholder="Other, e.g. 32" aria-label="Other size"
                    onKeyDown={e => { if (e.key === 'Enter' && customSize.trim()) { toggleSize(customSize.trim()); setCustomSize(''); } }}
                    style={{ ...field, width: 110, padding: '5px 8px' }} />
                  <button type="button" style={chip(false)} disabled={!customSize.trim() || sizes.some(r => r.size === customSize.trim())}
                    onClick={() => { toggleSize(customSize.trim()); setCustomSize(''); }}><Plus size={12} /></button>
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', background: '#f8fafc', border: '1px solid #eef2f6', borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <div style={{ width: 130 }}>
                <label style={label} htmlFor="np-reg">Regular price ৳</label>
                <input id="np-reg" value={allRegular} inputMode="decimal" onChange={e => applyPrices(clean(e.target.value), salePct)} style={field} placeholder="e.g. 1650" />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <span style={label}>Sale</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {SALE_STEPS.map(p => (
                    <button key={p} type="button" style={{ ...chip((salePct ?? 0) === p && salePct !== null), padding: '4px 8px', fontSize: '0.72rem' }} onClick={() => applyPrices(allRegular, p)}>
                      {p === 0 ? 'No sale' : `${p}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <table style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup><col style={{ width: '18%' }} /><col style={{ width: '22%' }} /><col style={{ width: '25%' }} /><col style={{ width: '25%' }} /><col style={{ width: '10%' }} /></colgroup>
              <thead>
                <tr style={{ fontSize: '0.64rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>
                  <th style={cell}>Size</th><th style={cell}>Stock</th><th style={cell}>Regular ৳</th><th style={cell}>Sale ৳</th><th style={cell}>Off</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const set = (k: keyof SizeRow, v: string) => (noSizes ? setOneSize(s => ({ ...s, [k]: v })) : setRow(r.size, k, v));
                  const off = r.salePrice && Number(r.regularPrice) ? Math.round((1 - Number(r.salePrice) / Number(r.regularPrice)) * 100) : 0;
                  return (
                    <tr key={r.size}>
                      <td style={{ ...cell, fontWeight: 800, fontSize: '0.84rem' }}>
                        {noSizes ? 'One size' : r.size}
                        {!noSizes && chartLines[r.size.toUpperCase()] && <div title={chartLines[r.size.toUpperCase()]} style={{ fontSize: '0.6rem', fontWeight: 600, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chartLines[r.size.toUpperCase()].replace(SIZE_LINE, '')}</div>}
                      </td>
                      <td style={cell}><input value={r.stock} inputMode="numeric" placeholder="0" aria-label={`${r.size} stock`} onChange={e => set('stock', e.target.value.replace(/\D/g, ''))} style={{ ...field, padding: '6px 8px' }} /></td>
                      <td style={cell}><input value={r.regularPrice} inputMode="decimal" aria-label={`${r.size} regular price`} onChange={e => set('regularPrice', clean(e.target.value))} style={{ ...field, padding: '6px 8px' }} /></td>
                      <td style={cell}><input value={r.salePrice} inputMode="decimal" placeholder="No sale" aria-label={`${r.size} sale price`} onChange={e => set('salePrice', clean(e.target.value))}
                        style={{ ...field, padding: '6px 8px', borderColor: r.salePrice && Number(r.salePrice) >= Number(r.regularPrice) ? '#f87171' : '#d9dee6' }} /></td>
                      <td style={{ ...cell, fontSize: '0.74rem', fontWeight: 800, color: off > 0 ? '#15803d' : '#cbd5e1' }}>{off > 0 ? `${off}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>{totalStock} pieces in total.</div>}
          </div>

          <div style={section}>
            <div style={sectionTitle}>Size chart & description</div>
            <label style={label} htmlFor="np-chart">Size chart (shown beside the price)</label>
            <textarea id="np-chart" value={sizeChart} onChange={e => setSizeChart(e.target.value)} rows={5}
              placeholder={'Size chart:\nS: CHEST 40 LENGTH 27\nM: CHEST 42 LENGTH 28'} style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '4px 0 12px' }}>Lines starting “S:”, “M:”… are also shown when a customer picks that size.</div>
            <label style={label} htmlFor="np-desc">Description (fabric, fit, care)</label>
            <textarea id="np-desc" value={description} onChange={e => setDescription(e.target.value)} rows={4}
              placeholder={'- 100% Cotton\n- Relaxed Fit'} style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <div style={{ ...section, borderBottom: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <span style={label}>When I click create</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={chip(status === 'publish')} onClick={() => setStatus('publish')}>Publish on the shop</button>
                <button type="button" style={chip(status === 'draft')} onClick={() => setStatus('draft')}>Save as draft</button>
              </div>
            </div>
            <div>
              <span style={label}>Place on the shop</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={chip(position === 'top')} onClick={() => setPosition('top')}>First (#1)</button>
                <button type="button" style={chip(position === 'bottom')} onClick={() => setPosition('bottom')}>Last</button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', padding: '12px 18px', borderTop: '1px solid #eef2f6' }}>
          <span style={{ flex: 1, minWidth: 180, fontSize: '0.74rem', color: error ? '#dc2626' : problems.length ? '#b45309' : '#15803d', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            {error ? <><AlertCircle size={13} /> {error}</> : problems.length ? problems[0] : busy ? 'Creating… WordPress is importing the photos' : 'Ready to create'}
          </span>
          <button type="button" onClick={close} disabled={busy}
            style={{ border: '1px solid #d9dee6', background: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button type="button" onClick={create} disabled={busy || problems.length > 0}
            style={{ border: 'none', background: busy || problems.length ? '#e2e8f0' : '#0f172a', color: busy || problems.length ? '#94a3b8' : '#fff', borderRadius: 8, padding: '8px 16px', fontSize: '0.8rem', fontWeight: 800, cursor: busy || problems.length ? 'default' : 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: 'inherit' }}>
            {busy ? <Spinner size={13} /> : <Save size={13} />} {status === 'publish' ? 'Create & publish' : 'Create draft'}
          </button>
        </div>
      </div>
    </div>
  );
};

const cell: React.CSSProperties = { padding: '6px 5px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
const miniBtn = (off: boolean): React.CSSProperties => ({
  width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.92)', color: '#0f172a', cursor: off ? 'default' : 'pointer',
  opacity: off ? 0.3 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
});
