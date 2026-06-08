'use client';

import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, AlertCircle, X, Building2, Phone } from 'lucide-react';
import type { FinVendor } from '@/lib/types/finance';
import { VENDOR_CATEGORIES } from '@/lib/types/finance';
import { fmt, inputStyle, selectStyle, btnPrimary, btnSecondary } from './shared';

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

const emptyForm = () => ({ name: '', category: 'other', phone: '', bank_details: '', notes: '' });

export const FinanceVendors: React.FC = () => {
  const [vendors, setVendors] = useState<FinVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/vendors');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setVendors(json.vendors || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setFeedback({ msg: `${form.name} added`, ok: true });
      setForm(emptyForm());
      setShowForm(false);
      load();
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) {
      setFeedback({ msg: e.message, ok: false });
    } finally {
      setSaving(false);
    }
  };

  const filtered = vendors.filter(v => {
    const matchCat = !filterCategory || v.category === filterCategory;
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalOutstanding = vendors.reduce((s, v) => s + (v.balance_due || 0), 0);
  const totalPurchased = vendors.reduce((s, v) => s + (v.total_purchased || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 6 }}>Total Vendors</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{vendors.length}</div>
          <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 2 }}>{vendors.filter(v => (v.balance_due || 0) > 0).length} with outstanding balance</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 6 }}>Total Purchased</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{fmt(totalPurchased)}</div>
          <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 2 }}>All-time procurement</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 6 }}>Total Outstanding</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: totalOutstanding > 0 ? '#dc2626' : '#16a34a' }}>{fmt(totalOutstanding)}</div>
          <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 2 }}>Balance due across all vendors</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 9, padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 6 }}>Payment Rate</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
            {totalPurchased > 0 ? `${(((totalPurchased - totalOutstanding) / totalPurchased) * 100).toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 2 }}>Invoices cleared</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." style={{ ...inputStyle, flex: '1 1 200px', maxWidth: 280 }} />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...selectStyle, width: 180 }}>
          <option value="">All categories</option>
          {Object.entries(VENDOR_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={load} style={{ ...btnSecondary, padding: '8px 12px' }}><RefreshCw size={13} /></button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {feedback && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: feedback.ok ? '#16a34a' : '#dc2626' }}>{feedback.msg}</span>}
          <button onClick={() => setShowForm(!showForm)} style={btnPrimary}><Plus size={14} /> Add Vendor</button>
        </div>
      </div>

      {/* Add vendor form */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, padding: '20px 22px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>Add New Vendor</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
              <FormField label="Vendor Name">
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vendor or company name" style={inputStyle} required autoFocus />
              </FormField>
              <FormField label="Category">
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={selectStyle}>
                  {Object.entries(VENDOR_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Phone Number">
                <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="01XXXXXXXXX" style={inputStyle} />
              </FormField>
              <FormField label="Bank / Payment Details">
                <input type="text" value={form.bank_details} onChange={e => setForm(f => ({ ...f, bank_details: e.target.value }))} placeholder="Account no, bKash number, etc." style={inputStyle} />
              </FormField>
              <FormField label="Notes">
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={inputStyle} />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Add Vendor'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Vendor list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: 10, color: '#64748b', background: '#fff', borderRadius: 10, border: '1px solid #e2e7ee' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading vendors...</span>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #e2e7ee' }}>
          <AlertCircle size={20} color="#dc2626" style={{ marginBottom: 8 }} />
          <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #e2e7ee', color: '#94a3b8' }}>
          <Building2 size={28} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No vendors yet. Add your first vendor above.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {filtered.map(v => {
            const outstanding = v.balance_due || 0;
            const purchased = v.total_purchased || 0;
            const paid = v.total_paid || 0;
            const payRate = purchased > 0 ? ((paid / purchased) * 100) : 100;
            return (
              <div key={v.id} style={{ background: '#fff', border: `1px solid ${outstanding > 0 ? '#fecaca' : '#e2e7ee'}`, borderRadius: 10, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{v.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                        {VENDOR_CATEGORIES[v.category] || v.category}
                      </span>
                    </div>
                  </div>
                  {outstanding > 0 && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: 99, background: '#fef2f2', color: '#dc2626' }}>
                      OWES {fmt(outstanding)}
                    </span>
                  )}
                </div>
                {v.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#64748b', marginBottom: 10 }}>
                    <Phone size={12} /> {v.phone}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Total Purchased', value: fmt(purchased), color: '#0f172a' },
                    { label: 'Total Paid', value: fmt(paid), color: '#16a34a' },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#f9fafb', borderRadius: 7, padding: '8px 10px' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {purchased > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginBottom: 4 }}>
                      <span>Payment rate</span><span>{payRate.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${payRate}%`, background: payRate === 100 ? '#16a34a' : payRate > 50 ? '#d97706' : '#dc2626', borderRadius: 99 }} />
                    </div>
                  </div>
                )}
                {v.bank_details && (
                  <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                    {v.bank_details}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
