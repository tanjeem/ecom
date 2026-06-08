'use client';

import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, AlertCircle, Check, ChevronDown, X } from 'lucide-react';
import type { FabricPurchase, AccessoryPurchase, ProductionBatch, FinVendor } from '@/lib/types/finance';
import { fmt, fmtFull, PAYMENT_METHODS, inputStyle, selectStyle, btnPrimary, btnSecondary, btnDanger } from './shared';

type ProcurementTab = 'fabric' | 'accessories' | 'production';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Ordered': { bg: '#eff6ff', color: '#2563eb' },
  'Received': { bg: '#f0fdf4', color: '#16a34a' },
  'Quality Check': { bg: '#fffbeb', color: '#d97706' },
  'Accepted': { bg: '#f0fdf4', color: '#16a34a' },
  'Rejected': { bg: '#fef2f2', color: '#dc2626' },
  'In Progress': { bg: '#eff6ff', color: '#2563eb' },
  'Completed': { bg: '#f0fdf4', color: '#16a34a' },
  'Cancelled': { bg: '#fef2f2', color: '#dc2626' },
};

const StatusPill = ({ status }: { status: string }) => {
  const c = STATUS_COLORS[status] || { bg: '#f1f5f9', color: '#64748b' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, background: c.bg, color: c.color }}>
      {status}
    </span>
  );
};

const SummaryCard = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '14px 16px' }}>
    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: color || '#0f172a' }}>{value}</div>
    {sub && <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
  </div>
);

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

export const FinanceProcurement: React.FC = () => {
  const [tab, setTab] = useState<ProcurementTab>('fabric');
  const [fabricItems, setFabricItems] = useState<FabricPurchase[]>([]);
  const [accessoryItems, setAccessoryItems] = useState<AccessoryPurchase[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionBatch[]>([]);
  const [vendors, setVendors] = useState<FinVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ id: string; type: 'fabric' | 'accessories'; current: number; total: number } | null>(null);
  const [newPayment, setNewPayment] = useState('');
  const [completeModal, setCompleteModal] = useState<ProductionBatch | null>(null);
  const [completeForm, setCompleteForm] = useState({ qty: '', cost: '', date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer' });

  // Fabric form state
  const [fabricForm, setFabricForm] = useState({ date: new Date().toISOString().slice(0, 10), vendor_id: '', fabric_type: '', quantity: '', unit: 'yards', unit_price: '', total_cost: '', amount_paid: '', payment_method: 'Cash', status: 'Received', notes: '' });
  // Accessory form state
  const [accForm, setAccForm] = useState({ date: new Date().toISOString().slice(0, 10), vendor_id: '', item: '', quantity: '', unit: 'pcs', unit_price: '', total_cost: '', amount_paid: '', payment_method: 'Cash', notes: '' });
  // Production form state
  const [prodForm, setProdForm] = useState({ date: new Date().toISOString().slice(0, 10), batch_code: '', product_type: '', target_quantity: '', factory: '', estimated_sewing_cost: '', notes: '' });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fabRes, accRes, prodRes, vendRes] = await Promise.all([
        fetch('/api/finance/procurement?type=fabric'),
        fetch('/api/finance/procurement?type=accessories'),
        fetch('/api/finance/procurement?type=production'),
        fetch('/api/finance/vendors'),
      ]);
      const [fab, acc, prod, vend] = await Promise.all([fabRes.json(), accRes.json(), prodRes.json(), vendRes.json()]);
      if (fab.error) throw new Error(fab.error);
      setFabricItems(fab.items || []);
      setAccessoryItems(acc.items || []);
      setProductionItems(prod.items || []);
      setVendors(vend.vendors || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const showFeedback = (msg: string, ok: boolean) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3500);
  };

  const submitFabric = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/finance/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addFabric', payload: fabricForm }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      showFeedback('Fabric purchase recorded', true);
      setShowForm(false);
      setFabricForm({ date: new Date().toISOString().slice(0, 10), vendor_id: '', fabric_type: '', quantity: '', unit: 'yards', unit_price: '', total_cost: '', amount_paid: '', payment_method: 'Cash', status: 'Received', notes: '' });
      loadData();
    } catch (e: any) { showFeedback(e.message, false); }
    finally { setSaving(false); }
  };

  const submitAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/finance/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addAccessory', payload: accForm }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      showFeedback('Accessory purchase recorded', true);
      setShowForm(false);
      loadData();
    } catch (e: any) { showFeedback(e.message, false); }
    finally { setSaving(false); }
  };

  const submitProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/finance/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addProduction', payload: prodForm }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      showFeedback('Production batch created', true);
      setShowForm(false);
      loadData();
    } catch (e: any) { showFeedback(e.message, false); }
    finally { setSaving(false); }
  };

  const recordPayment = async () => {
    if (!paymentModal || !newPayment) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recordPayment', payload: { id: paymentModal.id, purchase_type: paymentModal.type, new_paid_amount: Number(newPayment) } }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      showFeedback('Payment recorded', true);
      setPaymentModal(null);
      setNewPayment('');
      loadData();
    } catch (e: any) { showFeedback(e.message, false); }
    finally { setSaving(false); }
  };

  const completeProduction = async () => {
    if (!completeModal || !completeForm.qty) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completeProduction', payload: { id: completeModal.id, completed_quantity: completeForm.qty, actual_sewing_cost: completeForm.cost, completion_date: completeForm.date, payment_method: completeForm.method } }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      showFeedback('Batch marked as completed', true);
      setCompleteModal(null);
      loadData();
    } catch (e: any) { showFeedback(e.message, false); }
    finally { setSaving(false); }
  };

  const fabricVendors = vendors.filter(v => v.category === 'fabric' || v.category === 'other');
  const accessoryVendors = vendors.filter(v => v.category === 'accessories' || v.category === 'other');

  const fabricOutstanding = fabricItems.reduce((s, i) => s + i.balance_due, 0);
  const accessoryOutstanding = accessoryItems.reduce((s, i) => s + i.balance_due, 0);
  const activeBatches = productionItems.filter(b => b.status === 'In Progress').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
        <SummaryCard label="Fabric Purchases" value={fmt(fabricItems.reduce((s, i) => s + i.total_cost, 0))} sub={`${fabricItems.length} orders`} />
        <SummaryCard label="Fabric Outstanding" value={fmt(fabricOutstanding)} sub="Balance due to vendors" color={fabricOutstanding > 0 ? '#dc2626' : '#16a34a'} />
        <SummaryCard label="Accessory Outstanding" value={fmt(accessoryOutstanding)} sub="Balance due to vendors" color={accessoryOutstanding > 0 ? '#dc2626' : '#16a34a'} />
        <SummaryCard label="Active Batches" value={String(activeBatches)} sub={`${productionItems.filter(b => b.status === 'Completed').length} completed`} />
      </div>

      {/* Tab bar + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div className="segmented-control" style={{ background: '#f1f5f9' }}>
          {(['fabric', 'accessories', 'production'] as ProcurementTab[]).map(t => (
            <button key={t} className={tab === t ? 'is-selected' : ''} onClick={() => { setTab(t); setShowForm(false); }}
              style={{ textTransform: 'capitalize', fontSize: '0.82rem' }}>
              {t === 'production' ? 'Sewing Batches' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {feedback && (
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: feedback.ok ? '#16a34a' : '#dc2626', padding: '4px 10px', background: feedback.ok ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)', borderRadius: 6 }}>
              {feedback.msg}
            </span>
          )}
          <button onClick={() => setShowForm(!showForm)} style={btnPrimary}>
            <Plus size={14} />
            {tab === 'fabric' ? 'Add Fabric' : tab === 'accessories' ? 'Add Accessories' : 'New Batch'}
          </button>
        </div>
      </div>

      {/* Inline add forms */}
      {showForm && tab === 'fabric' && (
        <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '20px 22px', boxShadow: '0 4px 14px rgba(37,99,235,0.07)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 800 }}>Record Fabric Purchase</h3>
          <form onSubmit={submitFabric}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <FormField label="Date"><input type="date" value={fabricForm.date} onChange={e => setFabricForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} required /></FormField>
              <FormField label="Vendor">
                <select value={fabricForm.vendor_id} onChange={e => setFabricForm(f => ({ ...f, vendor_id: e.target.value }))} style={selectStyle}>
                  <option value="">No vendor</option>
                  {fabricVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </FormField>
              <FormField label="Fabric Type">
                <input type="text" value={fabricForm.fabric_type} onChange={e => setFabricForm(f => ({ ...f, fabric_type: e.target.value }))} placeholder="e.g. 100% Cotton, Viscose" style={inputStyle} required />
              </FormField>
              <FormField label="Quantity">
                <input type="number" value={fabricForm.quantity} onChange={e => setFabricForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" min="0.01" step="0.01" style={inputStyle} required />
              </FormField>
              <FormField label="Unit">
                <select value={fabricForm.unit} onChange={e => setFabricForm(f => ({ ...f, unit: e.target.value }))} style={selectStyle}>
                  {['yards', 'meters', 'kg'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </FormField>
              <FormField label="Unit Price (৳)">
                <input type="number" value={fabricForm.unit_price} onChange={e => {
                  const up = Number(e.target.value);
                  const tc = fabricForm.quantity ? (up * Number(fabricForm.quantity)).toFixed(2) : '';
                  setFabricForm(f => ({ ...f, unit_price: e.target.value, total_cost: tc }));
                }} placeholder="0" min="0" style={inputStyle} required />
              </FormField>
              <FormField label="Total Cost (৳)">
                <input type="number" value={fabricForm.total_cost} onChange={e => setFabricForm(f => ({ ...f, total_cost: e.target.value }))} placeholder="Auto-calculated" style={inputStyle} required />
              </FormField>
              <FormField label="Amount Paid (৳)">
                <input type="number" value={fabricForm.amount_paid} onChange={e => setFabricForm(f => ({ ...f, amount_paid: e.target.value }))} placeholder="0" min="0" style={inputStyle} />
              </FormField>
              <FormField label="Payment Method">
                <select value={fabricForm.payment_method} onChange={e => setFabricForm(f => ({ ...f, payment_method: e.target.value }))} style={selectStyle}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </FormField>
              <FormField label="Status">
                <select value={fabricForm.status} onChange={e => setFabricForm(f => ({ ...f, status: e.target.value }))} style={selectStyle}>
                  {['Ordered', 'Received', 'Quality Check', 'Accepted', 'Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Notes">
                <input type="text" value={fabricForm.notes} onChange={e => setFabricForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={inputStyle} />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Record Purchase'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showForm && tab === 'accessories' && (
        <div style={{ background: '#fff', border: '1px solid #ede9fe', borderRadius: 10, padding: '20px 22px', boxShadow: '0 4px 14px rgba(124,58,237,0.07)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 800 }}>Record Accessory Purchase</h3>
          <form onSubmit={submitAccessory}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <FormField label="Date"><input type="date" value={accForm.date} onChange={e => setAccForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} required /></FormField>
              <FormField label="Vendor">
                <select value={accForm.vendor_id} onChange={e => setAccForm(f => ({ ...f, vendor_id: e.target.value }))} style={selectStyle}>
                  <option value="">No vendor</option>
                  {accessoryVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </FormField>
              <FormField label="Item Description">
                <input type="text" value={accForm.item} onChange={e => setAccForm(f => ({ ...f, item: e.target.value }))} placeholder="e.g. Metal buttons, YKK zippers" style={inputStyle} required />
              </FormField>
              <FormField label="Quantity">
                <input type="number" value={accForm.quantity} onChange={e => setAccForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" min="1" style={inputStyle} required />
              </FormField>
              <FormField label="Unit">
                <select value={accForm.unit} onChange={e => setAccForm(f => ({ ...f, unit: e.target.value }))} style={selectStyle}>
                  {['pcs', 'dozen', 'gross', 'kg', 'set'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </FormField>
              <FormField label="Unit Price (৳)">
                <input type="number" value={accForm.unit_price} onChange={e => setAccForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="Optional" style={inputStyle} />
              </FormField>
              <FormField label="Total Cost (৳)">
                <input type="number" value={accForm.total_cost} onChange={e => setAccForm(f => ({ ...f, total_cost: e.target.value }))} placeholder="0" min="1" style={inputStyle} required />
              </FormField>
              <FormField label="Amount Paid (৳)">
                <input type="number" value={accForm.amount_paid} onChange={e => setAccForm(f => ({ ...f, amount_paid: e.target.value }))} placeholder="0" min="0" style={inputStyle} />
              </FormField>
              <FormField label="Payment Method">
                <select value={accForm.payment_method} onChange={e => setAccForm(f => ({ ...f, payment_method: e.target.value }))} style={selectStyle}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Record Purchase'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showForm && tab === 'production' && (
        <div style={{ background: '#fff', border: '1px solid #dcfce7', borderRadius: 10, padding: '20px 22px', boxShadow: '0 4px 14px rgba(22,163,74,0.07)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 800 }}>Create Production Batch</h3>
          <form onSubmit={submitProduction}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <FormField label="Date"><input type="date" value={prodForm.date} onChange={e => setProdForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} required /></FormField>
              <FormField label="Batch Code">
                <input type="text" value={prodForm.batch_code} onChange={e => setProdForm(f => ({ ...f, batch_code: e.target.value }))} placeholder="Auto-generated if blank" style={inputStyle} />
              </FormField>
              <FormField label="Product Type">
                <input type="text" value={prodForm.product_type} onChange={e => setProdForm(f => ({ ...f, product_type: e.target.value }))} placeholder="e.g. Polo Shirt, Cargo Pants" style={inputStyle} required />
              </FormField>
              <FormField label="Target Quantity (pcs)">
                <input type="number" value={prodForm.target_quantity} onChange={e => setProdForm(f => ({ ...f, target_quantity: e.target.value }))} placeholder="0" min="1" style={inputStyle} required />
              </FormField>
              <FormField label="Factory / Sewing House">
                <input type="text" value={prodForm.factory} onChange={e => setProdForm(f => ({ ...f, factory: e.target.value }))} placeholder="Factory name" style={inputStyle} />
              </FormField>
              <FormField label="Estimated Sewing Cost (৳)">
                <input type="number" value={prodForm.estimated_sewing_cost} onChange={e => setProdForm(f => ({ ...f, estimated_sewing_cost: e.target.value }))} placeholder="0" min="0" style={inputStyle} />
              </FormField>
              <FormField label="Notes">
                <input type="text" value={prodForm.notes} onChange={e => setProdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={inputStyle} />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Create Batch'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Data table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: 10, color: '#64748b', background: '#fff', borderRadius: 10, border: '1px solid #e2e7ee' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.85rem' }}>Loading...</span>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #e2e7ee' }}>
          <AlertCircle size={20} color="#dc2626" style={{ marginBottom: 8 }} />
          <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>{error}</p>
        </div>
      ) : tab === 'fabric' ? (
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Date', 'Vendor', 'Fabric Type', 'Qty', 'Unit Price', 'Total Cost', 'Paid', 'Balance Due', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e7ee', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fabricItems.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No fabric purchases yet.</td></tr>
                ) : fabricItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: '#64748b' }}>{item.date}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem' }}>{item.vendor_name || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600 }}>{item.fabric_type}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem' }}>{item.quantity} {item.unit}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#64748b' }}>{fmtFull(item.unit_price)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 700 }}>{fmt(item.total_cost)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#16a34a', fontWeight: 700 }}>{fmt(item.amount_paid)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 800, color: item.balance_due > 0 ? '#dc2626' : '#16a34a' }}>
                      {item.balance_due > 0 ? fmt(item.balance_due) : '✓ Paid'}
                    </td>
                    <td style={{ padding: '10px 14px' }}><StatusPill status={item.status} /></td>
                    <td style={{ padding: '10px 14px' }}>
                      {item.balance_due > 0 && (
                        <button onClick={() => { setPaymentModal({ id: item.id, type: 'fabric', current: item.amount_paid, total: item.total_cost }); setNewPayment(String(item.total_cost)); }}
                          style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'accessories' ? (
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Date', 'Vendor', 'Item', 'Qty', 'Total Cost', 'Paid', 'Balance Due', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e7ee', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accessoryItems.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No accessory purchases yet.</td></tr>
                ) : accessoryItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: '#64748b' }}>{item.date}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem' }}>{item.vendor_name || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600 }}>{item.item}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem' }}>{item.quantity} {item.unit}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 700 }}>{fmt(item.total_cost)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#16a34a', fontWeight: 700 }}>{fmt(item.amount_paid)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 800, color: item.balance_due > 0 ? '#dc2626' : '#16a34a' }}>
                      {item.balance_due > 0 ? fmt(item.balance_due) : '✓ Paid'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {item.balance_due > 0 && (
                        <button onClick={() => { setPaymentModal({ id: item.id, type: 'accessories', current: item.amount_paid, total: item.total_cost }); setNewPayment(String(item.total_cost)); }}
                          style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Date', 'Batch Code', 'Product Type', 'Target Qty', 'Completed Qty', 'Factory', 'Sewing Cost', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e7ee', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productionItems.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No production batches yet.</td></tr>
                ) : productionItems.map(batch => (
                  <tr key={batch.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: '#64748b' }}>{batch.date}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem', fontFamily: 'monospace', fontWeight: 700 }}>{batch.batch_code}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600 }}>{batch.product_type}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem' }}>{batch.target_quantity.toLocaleString()} pcs</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: batch.completed_quantity ? '#16a34a' : '#94a3b8' }}>
                      {batch.completed_quantity ? `${batch.completed_quantity.toLocaleString()} pcs` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#64748b' }}>{batch.factory || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.83rem' }}>
                      {batch.actual_sewing_cost ? <span style={{ fontWeight: 700 }}>{fmt(batch.actual_sewing_cost)}</span> :
                        batch.estimated_sewing_cost ? <span style={{ color: '#94a3b8' }}>Est. {fmt(batch.estimated_sewing_cost)}</span> : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}><StatusPill status={batch.status} /></td>
                    <td style={{ padding: '10px 14px' }}>
                      {batch.status === 'In Progress' && (
                        <button onClick={() => { setCompleteModal(batch); setCompleteForm({ qty: String(batch.target_quantity), cost: String(batch.estimated_sewing_cost || ''), date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer' }); }}
                          style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer' }}>
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Record Payment</h3>
              <button onClick={() => setPaymentModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: '0.83rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Total Cost:</span><span style={{ fontWeight: 700 }}>{fmt(paymentModal.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Already Paid:</span><span style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(paymentModal.current)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Balance:</span><span style={{ fontWeight: 800, color: '#dc2626' }}>{fmt(paymentModal.total - paymentModal.current)}</span>
              </div>
            </div>
            <FormField label="New Total Amount Paid (৳)">
              <input type="number" value={newPayment} onChange={e => setNewPayment(e.target.value)} min={paymentModal.current} max={paymentModal.total} style={inputStyle} autoFocus />
            </FormField>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={recordPayment} disabled={saving || !newPayment || Number(newPayment) <= paymentModal.current} style={btnPrimary}>
                {saving ? 'Saving...' : 'Record Payment'}
              </button>
              <button onClick={() => setPaymentModal(null)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete production modal */}
      {completeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Complete Batch — {completeModal.batch_code}</h3>
              <button onClick={() => setCompleteModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormField label="Completion Date"><input type="date" value={completeForm.date} onChange={e => setCompleteForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></FormField>
              <FormField label="Actual Completed Quantity (pcs)"><input type="number" value={completeForm.qty} onChange={e => setCompleteForm(f => ({ ...f, qty: e.target.value }))} min="1" style={inputStyle} required /></FormField>
              <FormField label="Actual Sewing Cost (৳)"><input type="number" value={completeForm.cost} onChange={e => setCompleteForm(f => ({ ...f, cost: e.target.value }))} min="0" style={inputStyle} /></FormField>
              <FormField label="Payment Method">
                <select value={completeForm.method} onChange={e => setCompleteForm(f => ({ ...f, method: e.target.value }))} style={selectStyle}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={completeProduction} disabled={saving || !completeForm.qty} style={btnPrimary}>{saving ? 'Saving...' : 'Mark Complete'}</button>
              <button onClick={() => setCompleteModal(null)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
