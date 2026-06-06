'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wand2, Plus, Search, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import type { InboxOrderLineItem } from '@/lib/types/commerce';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InboxOrderData {
  name: string;
  phone: string;
  address: string;
  city?: string;
  items: InboxOrderLineItem[];
  deliveryCharge?: number;
}

interface ProductSuggestion {
  id: number;
  name: string;
  price: number;
  type: string;
  hasVariations: boolean;
}

interface VariationOption {
  id: number;
  label: string;
  price: number;
}

interface InboxOrderFormProps {
  readonly onSubmit: (data: InboxOrderData) => Promise<{ ok: boolean; error?: string }>;
}

// ── Phone helpers ─────────────────────────────────────────────────────────────

function normalisePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('880') && d.length === 13) return d.slice(2);
  if (d.startsWith('88')  && d.length === 12) return '0' + d.slice(2);
  return d;
}

function phoneError(raw: string): string | null {
  if (!raw) return null;
  const d = normalisePhone(raw);
  if (d.length === 0) return null;
  if (d.length !== 11) return `${d.length} digits — must be 11`;
  if (!d.startsWith('01')) return 'Must start with 01';
  return null;
}

// ── Product / size helpers ─────────────────────────────────────────────────────

const SIZE_RE = /\b(xs|s|m|l|xl|xxl|2xl|3xl|small|medium|large|\d{2,3})\b/gi;

function extractProductAndSize(text: string): { productQuery: string; sizeHint: string } {
  const sizes = Array.from(text.matchAll(new RegExp(SIZE_RE.source, 'gi'))).map(m => m[0].toLowerCase());
  const productQuery = text.replace(new RegExp(SIZE_RE.source, 'gi'), '').replace(/\s+/g, ' ').trim();
  return { productQuery: productQuery || text.trim(), sizeHint: sizes[0] ?? '' };
}

async function autoMatchProduct(
  productText: string,
  priceHint: number,
): Promise<InboxOrderLineItem> {
  const fallback: InboxOrderLineItem = { product: productText, price: priceHint, qty: 1 };
  const { productQuery, sizeHint } = extractProductAndSize(productText);
  if (productQuery.length < 2) return fallback;

  try {
    const res  = await fetch(`/api/products/search?q=${encodeURIComponent(productQuery)}`);
    const d    = await res.json() as { products: ProductSuggestion[] };
    const hits = d.products ?? [];
    if (hits.length === 0) return fallback;

    const match = hits[0];
    const line: InboxOrderLineItem = {
      product:   match.name,
      price:     match.price,
      qty:       1,
      productId: match.id,
    };

    if (match.hasVariations && sizeHint) {
      const vRes  = await fetch(`/api/products/variations?productId=${match.id}`);
      const vData = await vRes.json() as { variations: VariationOption[] };
      const vars  = vData.variations ?? [];
      const found = vars.find(v => new RegExp(`\\b${sizeHint}\\b`, 'i').test(v.label));
      if (found) {
        line.variationId = found.id;
        line.price       = found.price;
      }
    }

    // If the user had a price hint (parsed from text), prefer it over catalog price
    if (priceHint > 0) line.price = priceHint;
    return line;
  } catch {
    return fallback;
  }
}

// ── Parser ────────────────────────────────────────────────────────────────────

type ParsedBlock = {
  name?: string; phone?: string; address?: string;
  city?: string; products?: string[]; price?: number;
};

function isPhoneLine(line: string): boolean {
  const d = line.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13 &&
    (d.startsWith('01') || d.startsWith('8801') || d.startsWith('880'));
}

function isPriceLine(line: string): boolean {
  const t = line.trim();
  return /^\d{3,6}$/.test(t) && Number(t) >= 100;
}

function hasAddressKeyword(line: string): boolean {
  return /\b(road|rd|street|st|lane|block|sector|area|para|nagar|bazar|market|tower|house|flat|floor|plot|holding|village|thana|district|mohalla|sarani|mor|more|r\/a|c\/a)\b/i.test(line);
}

function hasSizeOrColor(line: string): boolean {
  return /\b(xs|s|m|l|xl|xxl|2xl|3xl|small|medium|large|black|white|red|blue|green|yellow|pink|purple|orange|grey|gray|brown|navy|beige|cream|maroon|off.white)\b/i.test(line);
}

function parseBlockLabeled(text: string): ParsedBlock {
  const r: ParsedBlock = {};
  for (const raw of text.split('\n')) {
    const ci = raw.indexOf(':');
    if (ci <= 0) continue;
    const k = raw.slice(0, ci).trim().toLowerCase().replace(/[^a-zঀ-৿]/g, '');
    const v = raw.slice(ci + 1).trim();
    if (!v) continue;
    if      (['name','নাম','customer','customername','fullname'].includes(k))                                     r.name    = v;
    else if (['phone','mobile','number','ফোন','contact','phonenumber','mobilenumber','cell'].includes(k))         r.phone   = normalisePhone(v);
    else if (['address','ঠিকানা','addr','location','deliveryaddress'].includes(k))                               r.address = v;
    else if (['city','district','জেলা'].includes(k))                                                             r.city    = v;
    else if (['product','item','পণ্য','products','items','productsize','productname','size','order'].includes(k)) { if (!r.products) r.products = []; r.products.push(v); }
    else if (['price','amount','total','দাম','cost','taka','tk','bdt','payable','cod'].includes(k)) {
      const n = Number(v.replace(/[^\d.]/g, ''));
      if (!Number.isNaN(n) && n > 0) r.price = n;
    }
  }
  return r;
}

function parseBlockPositional(text: string): ParsedBlock {
  const r: ParsedBlock = {};
  const rem = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Extract phone (full line OR embedded like "emma 01731012345")
  for (let i = 0; i < rem.length; i++) {
    if (isPhoneLine(rem[i])) { r.phone = normalisePhone(rem[i]); rem.splice(i, 1); break; }
    const embedMatch = rem[i].match(/\b((?:880|88)?01\d{8,9})\b/);
    if (embedMatch) {
      r.phone = normalisePhone(embedMatch[1]);
      const rest = rem[i].replace(embedMatch[0], '').trim();
      rem.splice(i, 1);
      if (rest && !/\d/.test(rest) && rest.split(/\s+/).length <= 5) r.name = rest;
      else if (rest) rem.splice(i, 0, rest);
      break;
    }
  }
  // 2. Extract standalone price line (3-6 digits ≥ 100)
  for (let i = 0; i < rem.length; i++) {
    if (isPriceLine(rem[i])) { r.price = Number(rem[i].trim()); rem.splice(i, 1); break; }
  }
  // 3. Name: first all-letter line, no digits, ≤ 5 words, not a size/color hint
  for (let i = 0; i < rem.length; i++) {
    if (!/\d/.test(rem[i]) && rem[i].split(/\s+/).length <= 5 && !hasSizeOrColor(rem[i])) {
      r.name = rem[i]; rem.splice(i, 1); break;
    }
  }
  // 4. Address: starts with digit, has keywords, has comma (non-product), or mixed digits+letters
  for (let i = 0; i < rem.length; i++) {
    const line = rem[i];
    if (/^\d/.test(line) || hasAddressKeyword(line) || (line.includes(',') && !hasSizeOrColor(line)) || (/\d/.test(line) && /[a-z]/i.test(line) && !isPhoneLine(line))) {
      r.address = line; rem.splice(i, 1); break;
    }
  }
  // 5. Longest remaining line as address if still missing and multiple remain
  if (!r.address && rem.length > 1) {
    const idx = rem.reduce((best, l, i) => l.length > rem[best].length ? i : best, 0);
    r.address = rem[idx]; rem.splice(idx, 1);
  }
  // 6. Products: each remaining line is a separate product
  if (rem.length > 0) r.products = rem;
  return r;
}

export function parseBlock(text: string): ParsedBlock {
  const labeled = parseBlockLabeled(text);
  if (labeled.name || labeled.phone || labeled.address) return labeled;
  return parseBlockPositional(text);
}

export function splitBlocks(text: string): string[] {
  return text.split(/\n[ \t]*-{3,}[ \t]*\n|\n{2,}/).map(b => b.trim()).filter(Boolean);
}

// ── Product search autocomplete ───────────────────────────────────────────────

function ProductSearch({
  value, onChange, onSelect, placeholder,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSelect: (p: ProductSuggestion) => void;
  readonly placeholder?: string;
}) {
  const [hits, setHits] = useState<ProductSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap  = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setHits([]); setOpen(false); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      const d   = await res.json() as { products: ProductSuggestion[] };
      setHits(d.products ?? []);
      setOpen((d.products ?? []).length > 0);
    } catch { setHits([]); }
    finally  { setBusy(false); }
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={value}
          onChange={e => {
            onChange(e.target.value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => search(e.target.value), 300);
          }}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder={placeholder ?? 'Search products…'}
          style={{ width: '100%', padding: '7px 30px 7px 10px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.83rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>
          {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
        </span>
      </div>
      {open && hits.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, background: '#fff', border: '1px solid #e4e8ef', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: 2, maxHeight: 220, overflowY: 'auto' }}>
          {hits.map(p => (
            <button key={p.id} type="button"
              onMouseDown={() => { onSelect(p); setOpen(false); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.83rem' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f7fa'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <span style={{ fontWeight: 500 }}>{p.name}{p.hasVariations && <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: 4 }}>▾ sizes</span>}</span>
              <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', marginLeft: 8 }}>৳{p.price.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Variation picker ──────────────────────────────────────────────────────────

function VariationPicker({
  productId, selected, onSelect,
}: {
  readonly productId: number;
  readonly selected: number | undefined;
  readonly onSelect: (v: VariationOption) => void;
}) {
  const [variants, setVariants] = useState<VariationOption[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products/variations?productId=${productId}`)
      .then(r  => r.json() as Promise<{ variations: VariationOption[] }>)
      .then(d  => setVariants(d.variations ?? []))
      .catch(() => setVariants([]))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading)              return <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Loading sizes…</span>;
  if (variants.length === 0) return null;

  return (
    <select
      value={selected ?? ''}
      onChange={e => { const v = variants.find(x => x.id === Number(e.target.value)); if (v) onSelect(v); }}
      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.8rem', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}
    >
      <option value="">Select size / variant…</option>
      {variants.map(v => (
        <option key={v.id} value={v.id}>{v.label} — ৳{v.price.toLocaleString()}</option>
      ))}
    </select>
  );
}

// ── Product line row ──────────────────────────────────────────────────────────

const EMPTY_LINE: InboxOrderLineItem = { product: '', price: 0, qty: 1 };

function ProductLineRow({
  line, index, onChange, onRemove, canRemove,
}: {
  readonly line: InboxOrderLineItem;
  readonly index: number;
  readonly onChange: (idx: number, updated: InboxOrderLineItem) => void;
  readonly onRemove: (idx: number) => void;
  readonly canRemove: boolean;
}) {
  const set = (patch: Partial<InboxOrderLineItem>) => onChange(index, { ...line, ...patch });

  return (
    <div style={{ border: '1px solid #e4e8ef', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.7rem', color: '#68707a', marginBottom: 3 }}>Product</div>
          <ProductSearch
            value={line.product}
            onChange={v => set({ product: v, productId: undefined, variationId: undefined })}
            onSelect={p => set({ product: p.name, price: p.price, productId: p.id, variationId: undefined })}
            placeholder="Search or type product name…"
          />
        </div>
        <div style={{ width: 52, flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', color: '#68707a', marginBottom: 3 }}>Qty</div>
          <input type="number" min={1} value={line.qty}
            onChange={e => set({ qty: Math.max(1, Number(e.target.value)) })}
            style={{ width: '100%', padding: '7px 4px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.83rem', fontFamily: 'inherit', textAlign: 'center' }} />
        </div>
        <div style={{ width: 84, flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', color: '#68707a', marginBottom: 3 }}>Price ৳</div>
          <input type="number" min={0} value={line.price || ''}
            onChange={e => set({ price: Number(e.target.value) })}
            placeholder="0"
            style={{ width: '100%', padding: '7px 6px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.83rem', fontFamily: 'inherit' }} />
        </div>
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)}
            style={{ padding: '7px 6px', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', color: '#dc2626', flexShrink: 0 }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Variation picker — full-width row below product search */}
      {line.productId && (
        <div style={{ marginTop: 8 }}>
          <VariationPicker
            productId={line.productId}
            selected={line.variationId}
            onSelect={v => set({ variationId: v.id, price: v.price })}
          />
        </div>
      )}

      {line.qty > 1 && line.price > 0 && (
        <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#6b7280', textAlign: 'right' }}>
          Subtotal: ৳{(line.price * line.qty).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ── Single order form ─────────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', phone: '', address: '', city: '' };

export const InboxOrderForm: React.FC<InboxOrderFormProps> = ({ onSubmit }) => {
  const [fields,         setFields]         = useState(EMPTY_FORM);
  const [lines,          setLines]          = useState<InboxOrderLineItem[]>([{ ...EMPTY_LINE }]);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [pasteText,      setPasteText]      = useState('');
  const [isParsing,      setIsParsing]      = useState(false);
  const [status,         setStatus]         = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg,       setErrorMsg]       = useState('');
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set        = (k: keyof typeof EMPTY_FORM, v: string) => setFields(p => ({ ...p, [k]: v }));
  const phoneErr   = phoneError(fields.phone);
  const itemsTotal = lines.reduce((s, l) => s + (l.price || 0) * (l.qty || 1), 0);
  const totalCOD   = itemsTotal + (deliveryCharge || 0);

  async function applyParsed(text: string) {
    const parsed = parseBlock(text);
    if (parsed.name)    set('name',    parsed.name);
    if (parsed.phone)   set('phone',   parsed.phone);
    if (parsed.address) set('address', parsed.address);
    if (parsed.city)    set('city',    parsed.city);

    const allProducts = parsed.products ?? [];
    if (allProducts.length > 0) {
      setIsParsing(true);
      const matchedLines = await Promise.all(allProducts.map(p => autoMatchProduct(p, parsed.price ?? 0)));
      setLines(matchedLines.length > 0 ? matchedLines : [{ product: '', price: 0, qty: 1 }]);
      setIsParsing(false);
    } else if (parsed.price) {
      setLines([{ product: '', price: parsed.price, qty: 1 }]);
    }
  }

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setPasteText(v);
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => { void applyParsed(v); }, 600);
  };

  const updateLine = (idx: number, updated: InboxOrderLineItem) =>
    setLines(prev => prev.map((l, i) => i === idx ? updated : l));
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const addLine    = () => setLines(prev => [...prev, { ...EMPTY_LINE }]);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const phone = normalisePhone(fields.phone);
    if (!fields.name || !phone || !fields.address) {
      setStatus('error'); setErrorMsg('Name, phone and address are required.'); return;
    }
    if (phoneError(phone)) {
      setStatus('error'); setErrorMsg(`Phone: ${phoneError(phone) ?? ''}`); return;
    }
    const validLines = lines.filter(l => l.product && l.price > 0);
    if (validLines.length === 0) {
      setStatus('error'); setErrorMsg('Add at least one product with a price.'); return;
    }
    setStatus('loading'); setErrorMsg('');
    const result = await onSubmit({
      ...fields, phone, items: validLines,
      deliveryCharge: deliveryCharge > 0 ? deliveryCharge : undefined,
    });
    if (result.ok) {
      setStatus('success');
      setFields(EMPTY_FORM); setLines([{ ...EMPTY_LINE }]); setPasteText(''); setDeliveryCharge(0);
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error'); setErrorMsg(result.error || 'Failed to create order.');
    }
  }

  const validLines = lines.filter(l => l.product && l.price > 0);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28, alignItems: 'start' }}>

        {/* ── LEFT: customer + product inputs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Paste area */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#68707a', marginBottom: 4 }}>
              Paste order message <span style={{ fontWeight: 400, color: '#9ca3af' }}>(auto-fills all fields + product)</span>
            </label>
            <textarea
              rows={4} value={pasteText} onChange={handlePasteChange}
              placeholder={'emma\n01731012345\n6/2/1 borobagh\nelio xl\n\nor labeled:\nName: Ayesha | Phone: 01700000000 | Address: Banani | Product: Shirt M | Price: 2450'}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => { void applyParsed(pasteText); }} disabled={isParsing}
              style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0f4ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: isParsing ? 'wait' : 'pointer', opacity: isParsing ? 0.7 : 1 }}>
              {isParsing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={13} />}
              {isParsing ? 'Matching product…' : 'Parse & Fill'}
            </button>
          </div>

          {/* Name + Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#68707a' }}>Customer name</label>
              <input value={fields.name} onChange={e => set('name', e.target.value)} placeholder="Full name"
                style={{ padding: '8px 10px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.85rem', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#68707a' }}>Phone</label>
              <input value={fields.phone} onChange={e => set('phone', e.target.value.replace(/\s/g, ''))} placeholder="01700000000"
                style={{ padding: '8px 10px', border: `1px solid ${phoneErr ? '#dc2626' : '#d9dee6'}`, borderRadius: 6, fontSize: '0.85rem', fontFamily: 'monospace' }} />
              {phoneErr && <span style={{ fontSize: '0.7rem', color: '#dc2626' }}>{phoneErr}</span>}
            </div>
          </div>

          {/* Address + City */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#68707a' }}>Address</label>
              <input value={fields.address} onChange={e => set('address', e.target.value)} placeholder="Area, City"
                style={{ padding: '8px 10px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.85rem', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#68707a' }}>City</label>
              <input value={fields.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="Dhaka"
                style={{ padding: '8px 10px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.85rem', fontFamily: 'inherit' }} />
            </div>
          </div>

          {/* Products */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#68707a', marginBottom: 6 }}>
              Products <span style={{ fontWeight: 400, color: '#9ca3af' }}>({lines.length})</span>
            </div>
            {lines.map((line, i) => (
              <ProductLineRow key={i} line={line} index={i} onChange={updateLine} onRemove={removeLine} canRemove={lines.length > 1} />
            ))}
            <button type="button" onClick={addLine}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: '1px dashed #d9dee6', borderRadius: 6, padding: '7px 12px', fontSize: '0.78rem', color: '#2563eb', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
              <Plus size={13} /> Add another product
            </button>
          </div>
        </div>

        {/* ── RIGHT: order summary + delivery + total + submit ── */}
        <div style={{ position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Summary card */}
          <div style={{ background: '#f8f9fb', borderRadius: 10, border: '1px solid #e4e8ef', padding: '18px 20px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Order Summary</div>

            {/* Customer preview */}
            {fields.name && (
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #e4e8ef' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{fields.name}</div>
                {fields.phone && <div style={{ fontSize: '0.78rem', color: '#6b7280', fontFamily: 'monospace', marginTop: 2 }}>{normalisePhone(fields.phone)}</div>}
                {fields.address && (
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
                    {fields.address}{fields.city ? `, ${fields.city}` : ''}
                  </div>
                )}
              </div>
            )}

            {/* Line items */}
            {validLines.length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                {validLines.map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
                    <span style={{ fontSize: '0.82rem', color: '#374151', flex: 1 }}>
                      {l.product}{l.qty > 1 ? <span style={{ color: '#9ca3af' }}> ×{l.qty}</span> : ''}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                      ৳{(l.price * (l.qty || 1)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#d1d5db', marginBottom: 14, textAlign: 'center', padding: '6px 0' }}>No products added yet</div>
            )}

            {/* Delivery charge row */}
            <div style={{ borderTop: '1px solid #e4e8ef', paddingTop: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.82rem', color: '#68707a' }}>Delivery charge</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: '0.8rem', color: '#68707a' }}>৳</span>
                  <input type="number" min={0} value={deliveryCharge || ''}
                    onChange={e => setDeliveryCharge(Number(e.target.value))}
                    placeholder="0"
                    style={{ width: 80, padding: '4px 8px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.83rem', fontFamily: 'inherit', textAlign: 'right' }} />
                </div>
              </div>

              {deliveryCharge > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af' }}>
                    <span>Products</span><span>৳{itemsTotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af' }}>
                    <span>Delivery</span><span>৳{deliveryCharge.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Total COD */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e4e8ef', paddingTop: 12 }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#374151' }}>Total COD</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: totalCOD > 0 ? '#111827' : '#d1d5db' }}>
                ৳{totalCOD.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Submit button */}
          <button type="submit" disabled={status === 'loading'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: status === 'loading' ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '13px 16px', fontSize: '0.92rem', fontWeight: 700, cursor: status === 'loading' ? 'not-allowed' : 'pointer', boxShadow: '0 2px 10px rgba(37,99,235,0.3)' }}>
            <Plus size={17} />
            {status === 'loading' ? 'Creating…' : 'Create in WooCommerce'}
          </button>

          {status === 'success' && (
            <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 7, padding: '10px 14px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> Order created successfully.
            </div>
          )}
          {status === 'error' && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 7, padding: '10px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

// ── Bulk order form ───────────────────────────────────────────────────────────

type BulkRow = {
  _key: string;
  _status: 'pending' | 'loading' | 'success' | 'error';
  _error?: string;
  name?: string;
  phone?: string;
  address?: string;
  product?: string;
  price?: number;
  deliveryCharge?: number;
};

export const BulkOrderForm: React.FC = () => {
  const [pasteText, setPasteText] = useState('');
  const [rows,      setRows]      = useState<BulkRow[]>([]);
  const [creating,  setCreating]  = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function buildRows(text: string): Promise<BulkRow[]> {
    const blocks = splitBlocks(text);
    return Promise.all(blocks.map(async (block, i) => {
      const p = parseBlock(block);
      // Auto-match product from product text
      const products = p.products ?? [];
      let product = products.join(', ');
      let price   = p.price ?? 0;
      if (products.length > 0) {
        try {
          const matched = await autoMatchProduct(products[0], price);
          product = matched.product;
          if (matched.price > 0) price = matched.price;
        } catch { /* keep parsed values */ }
      }
      return {
        _key: `${i}-${block.slice(0, 15)}`, _status: 'pending' as const,
        name: p.name, phone: p.phone, address: p.address,
        product, price, deliveryCharge: 0,
      };
    }));
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setPasteText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setIsParsing(true);
      const built = await buildRows(v);
      setRows(built);
      setIsParsing(false);
    }, 600);
  };

  const updateRow = (idx: number, patch: Partial<BulkRow>) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  async function createOne(row: BulkRow): Promise<{ ok: boolean; error?: string }> {
    if (!row.name || !row.phone || !row.address || !row.product || !row.price) {
      return { ok: false, error: 'Missing required fields' };
    }
    const phone = normalisePhone(row.phone);
    const err   = phoneError(phone);
    if (err) return { ok: false, error: `Phone: ${err}` };
    try {
      const res = await fetch('/api/orders/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: row.name, phone, address: row.address,
          items: [{ product: row.product, price: row.price, qty: 1 }],
          deliveryCharge: row.deliveryCharge || 0,
        }),
      });
      const json = await res.json() as { error?: string };
      return res.ok ? { ok: true } : { ok: false, error: json.error ?? `Error ${res.status}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
    }
  }

  async function handleCreateAll() {
    if (rows.length === 0 || creating) return;
    setCreating(true);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]._status === 'success') continue;
      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, _status: 'loading' } : r));
      const result = await createOne(rows[i]);
      setRows(prev => prev.map((r, idx) =>
        idx === i ? { ...r, _status: result.ok ? 'success' : 'error', _error: result.error } : r,
      ));
    }
    setCreating(false);
  }

  const doneCount = rows.filter(r => r._status === 'success').length;
  const errCount  = rows.filter(r => r._status === 'error').length;
  const allDone   = rows.length > 0 && doneCount === rows.length;

  const inputStyle: React.CSSProperties = {
    padding: '3px 6px', border: '1px solid #e4e8ef', borderRadius: 4,
    fontSize: '0.78rem', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#68707a', marginBottom: 4 }}>
          Paste multiple orders — separate blocks with <code style={{ background: '#f3f4f6', borderRadius: 3, padding: '1px 5px' }}>---</code> or a blank line.
          Products are auto-matched from your WooCommerce catalog.
        </label>
        <textarea
          rows={10} value={pasteText} onChange={handleChange}
          placeholder={`tanzeem\n01731012345\n254 Ibrahimpur Road\nReid XL\n\n---\n\nFarah\n01800000000\nBanani, Dhaka\nWhite Robe L\n3200`}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d9dee6', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
        />
        {isParsing && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#6b7280' }}>
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Parsing and matching products…
          </div>
        )}
      </div>

      {rows.length > 0 && !isParsing && (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e4e8ef' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Name', 'Phone', 'Address', 'Product (auto-matched)', 'Price ৳', 'Delivery ৳', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#68707a', borderBottom: '1px solid #e4e8ef', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const phoneErr = row.phone ? phoneError(normalisePhone(row.phone)) : null;
                  const done     = row._status === 'success';
                  return (
                    <tr key={row._key} style={{ borderBottom: i < rows.length - 1 ? '1px solid #f0f2f5' : 'none', background: done ? '#f0fdf4' : undefined }}>
                      <td style={{ padding: '6px 10px', minWidth: 90 }}>
                        {done ? <span style={{ fontWeight: 500 }}>{row.name}</span>
                          : <input value={row.name ?? ''} onChange={e => updateRow(i, { name: e.target.value })} style={inputStyle} placeholder="Name" />}
                      </td>
                      <td style={{ padding: '6px 10px', minWidth: 110 }}>
                        {done
                          ? <span style={{ fontFamily: 'monospace' }}>{row.phone ? normalisePhone(row.phone) : '—'}</span>
                          : <input value={row.phone ?? ''} onChange={e => updateRow(i, { phone: e.target.value.replace(/\s/g, '') })} style={{ ...inputStyle, fontFamily: 'monospace', borderColor: phoneErr ? '#dc2626' : undefined }} placeholder="01700000000" />}
                      </td>
                      <td style={{ padding: '6px 10px', minWidth: 140 }}>
                        {done ? <span>{row.address || '—'}</span>
                          : <input value={row.address ?? ''} onChange={e => updateRow(i, { address: e.target.value })} style={inputStyle} placeholder="Address" />}
                      </td>
                      <td style={{ padding: '6px 10px', minWidth: 150 }}>
                        {done ? <span style={{ fontWeight: 500 }}>{row.product || '—'}</span>
                          : <input value={row.product ?? ''} onChange={e => updateRow(i, { product: e.target.value })} style={inputStyle} placeholder="Product" />}
                      </td>
                      <td style={{ padding: '6px 10px', minWidth: 90 }}>
                        {done ? <span style={{ fontWeight: 700 }}>৳{(row.price ?? 0).toLocaleString()}</span>
                          : <input type="number" min={0} value={row.price ?? ''} onChange={e => updateRow(i, { price: Number(e.target.value) })} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0" />}
                      </td>
                      <td style={{ padding: '6px 10px', minWidth: 90 }}>
                        {done ? <span>{row.deliveryCharge ? `৳${row.deliveryCharge}` : '—'}</span>
                          : <input type="number" min={0} value={row.deliveryCharge || ''} onChange={e => updateRow(i, { deliveryCharge: Number(e.target.value) })} style={{ ...inputStyle, textAlign: 'right' }} placeholder="0" />}
                      </td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                        {row._status === 'pending'  && <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>Pending</span>}
                        {row._status === 'loading'  && <span style={{ color: '#2563eb', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />Creating…</span>}
                        {row._status === 'success'  && <span style={{ color: '#16864d', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle size={11} />Done</span>}
                        {row._status === 'error'    && <span style={{ color: '#b91c1c', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 3 }} title={row._error}><AlertCircle size={11} />{row._error ?? 'Error'}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(doneCount > 0 || errCount > 0) && (
            <div style={{ fontSize: '0.82rem' }}>
              {doneCount > 0 && <span style={{ color: '#16864d', fontWeight: 600 }}>{doneCount} created </span>}
              {errCount  > 0 && <span style={{ color: '#b91c1c', fontWeight: 600 }}>{errCount} failed</span>}
            </div>
          )}

          <button type="button" onClick={handleCreateAll} disabled={creating || allDone}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: creating || allDone ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', fontSize: '0.9rem', fontWeight: 700, cursor: creating || allDone ? 'not-allowed' : 'pointer' }}>
            <Plus size={16} />
            {creating ? 'Creating orders…' : allDone ? 'All created ✓' : `Create All ${rows.length} Orders in WooCommerce`}
          </button>
        </>
      )}
    </div>
  );
};
