'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw, RotateCcw, ChevronLeft, ChevronRight, Edit2, Check, X } from 'lucide-react';
import { fmt, MONTHS_FULL, inputStyle, selectStyle, btnPrimary, btnSecondary } from './shared';

const OPEX_LABELS: Record<string, string> = {
  rent: 'Rent',
  salary: 'Salary',
  transport: 'Transport',
  ads_meta: 'Meta Ads',
  ads_google: 'Google Ads',
  photoshoot: 'Photoshoot',
  miscellaneous: 'Miscellaneous',
};

interface FixedCost {
  id: string;
  label: string;
  category: string;
  default_amount: number;
  sort_order: number;
}

interface MonthOverride {
  fixed_cost_id: string;
  month: string;
  amount: number;
}

const emptyAdd = () => ({ label: '', category: 'rent', default_amount: '' });

export const FinanceFixedCosts: React.FC = () => {
  const [costs, setCosts] = useState<FixedCost[]>([]);
  const [overrides, setOverrides] = useState<MonthOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyAdd());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', category: 'rent', default_amount: '' });

  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [monthEdits, setMonthEdits] = useState<Record<string, string>>({});

  const monthKey = `${selYear}-${String(selMonth).padStart(2, '0')}`;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/fixed-costs');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCosts(json.costs || []);
      setOverrides(json.overrides || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setMonthEdits({}); }, [selYear, selMonth]);

  const flash = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 3000); };

  const getEffective = (cost: FixedCost) => {
    const ov = overrides.find(o => o.fixed_cost_id === cost.id && o.month === monthKey);
    return ov == null ? cost.default_amount : ov.amount;
  };

  const isOverridden = (cost: FixedCost) =>
    overrides.some(o => o.fixed_cost_id === cost.id && o.month === monthKey);

  const displayVal = (cost: FixedCost) =>
    monthEdits[cost.id] !== undefined ? monthEdits[cost.id] : String(getEffective(cost));

  const handleAdd = async () => {
    if (!addForm.label.trim() || !addForm.default_amount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/fixed-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: addForm.label.trim(), category: addForm.category, default_amount: Number(addForm.default_amount), sort_order: costs.length }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAddForm(emptyAdd());
      setShowAdd(false);
      await load();
      flash('Fixed cost added');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/fixed-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, label: editForm.label, category: editForm.category, default_amount: Number(editForm.default_amount) }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setEditingId(null);
      await load();
      flash('Updated');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fixed cost? All monthly overrides will also be removed.')) return;
    await fetch(`/api/finance/fixed-costs?id=${id}`, { method: 'DELETE' });
    await load();
    flash('Deleted');
  };

  const handleSaveMonth = async () => {
    const changed = costs.filter(c => monthEdits[c.id] !== undefined);
    if (!changed.length) return;
    setSaving(true);
    try {
      await Promise.all(changed.map(async cost => {
        const newAmt = Number(monthEdits[cost.id] || 0);
        const hasOverride = isOverridden(cost);
        if (newAmt === cost.default_amount) {
          if (hasOverride) {
            await fetch(`/api/finance/fixed-costs/month?fixed_cost_id=${cost.id}&month=${monthKey}`, { method: 'DELETE' });
          }
        } else {
          await fetch('/api/finance/fixed-costs/month', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fixed_cost_id: cost.id, month: monthKey, amount: newAmt }),
          });
        }
      }));
      setMonthEdits({});
      await load();
      flash(`Saved ${MONTHS_FULL[selMonth - 1]} ${selYear}`);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleResetOne = async (cost: FixedCost) => {
    await fetch(`/api/finance/fixed-costs/month?fixed_cost_id=${cost.id}&month=${monthKey}`, { method: 'DELETE' });
    setMonthEdits(prev => { const n = { ...prev }; delete n[cost.id]; return n; });
    await load();
  };

  const prevMonth = () => {
    if (selMonth === 1) { setSelYear(y => y - 1); setSelMonth(12); }
    else setSelMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (selMonth === 12) { setSelYear(y => y + 1); setSelMonth(1); }
    else setSelMonth(m => m + 1);
  };

  const totalDefault = costs.reduce((s, c) => s + c.default_amount, 0);
  const totalMonth = costs.reduce((s, c) => {
    const raw = monthEdits[c.id] !== undefined ? Number(monthEdits[c.id]) : getEffective(c);
    return s + raw;
  }, 0);
  const hasEdits = Object.keys(monthEdits).length > 0;

  const cellBorder = (cost: FixedCost) => {
    if (monthEdits[cost.id] !== undefined) return '#3b82f6';
    if (isOverridden(cost)) return '#7dd3fc';
    return '#d9dee6';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>Fixed Costs</h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
            Recurring expenses automatically included in each month's P&L
          </p>
        </div>
        {feedback && (
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#16a34a', padding: '4px 12px', background: 'rgba(22,163,74,0.08)', borderRadius: 6, whiteSpace: 'nowrap' }}>
            ✓ {feedback}
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: '0.82rem' }}>
          {error}
          {error.toLowerCase().includes('does not exist') && (
            <div style={{ marginTop: 6, fontSize: '0.74rem', color: '#7f1d1d' }}>
              Run the SQL migration below in Supabase → SQL Editor to create the required tables.
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 16, alignItems: 'start' }}>

        {/* Left: Default costs list */}
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

          {/* List header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>Default Monthly Costs</div>
              <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 1 }}>
                {costs.length === 0 ? 'No costs added yet' : `${costs.length} item${costs.length !== 1 ? 's' : ''} · ${fmt(totalDefault)}/mo`}
              </div>
            </div>
            <button onClick={() => setShowAdd(v => !v)} style={{ ...btnPrimary, padding: '7px 12px', fontSize: '0.8rem' }}>
              <Plus size={13} /> Add Cost
            </button>
          </div>

          {/* Inline add form */}
          {showAdd && (
            <div style={{ padding: '14px 18px', background: '#f8faff', borderBottom: '1px solid #dbeafe', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 170px' }}>
                <label style={{ display: 'block', fontSize: '0.67rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 4 }}>Label</label>
                <input type="text" value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Office Rent" style={inputStyle} />
              </div>
              <div style={{ flex: '0 1 150px' }}>
                <label style={{ display: 'block', fontSize: '0.67rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 4 }}>Category (P&L)</label>
                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} style={selectStyle}>
                  {Object.entries(OPEX_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 1 130px' }}>
                <label style={{ display: 'block', fontSize: '0.67rem', fontWeight: 700, color: '#68707a', textTransform: 'uppercase', marginBottom: 4 }}>Default ৳/mo</label>
                <input type="number" value={addForm.default_amount} onChange={e => setAddForm(f => ({ ...f, default_amount: e.target.value }))} placeholder="0" min="0" style={{ ...inputStyle, fontWeight: 700 }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleAdd}
                  disabled={saving || !addForm.label.trim() || !addForm.default_amount}
                  style={{ ...btnPrimary, padding: '8px 14px', opacity: (!addForm.label.trim() || !addForm.default_amount) ? 0.5 : 1 }}
                >
                  {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                  Save
                </button>
                <button onClick={() => { setShowAdd(false); setAddForm(emptyAdd()); }} style={{ ...btnSecondary, padding: '8px 10px' }}>
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* List body */}
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : costs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏷️</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>No fixed costs yet</div>
              <div style={{ fontSize: '0.74rem' }}>Add rent, salary, or any recurring expense above</div>
            </div>
          ) : (
            costs.map((cost, i) => (
              <div
                key={cost.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: i < costs.length - 1 ? '1px solid #f1f5f9' : 'none', background: editingId === cost.id ? '#f8faff' : '#fff' }}
              >
                {editingId === cost.id ? (
                  <>
                    <input type="text" value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, flex: '1 1 auto', fontSize: '0.83rem' }} />
                    <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={{ ...selectStyle, flex: '0 1 130px', fontSize: '0.83rem' }}>
                      {Object.entries(OPEX_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input type="number" value={editForm.default_amount} onChange={e => setEditForm(f => ({ ...f, default_amount: e.target.value }))} min="0" style={{ ...inputStyle, width: 100, fontWeight: 700, textAlign: 'right', fontSize: '0.88rem' }} />
                    <button onClick={handleSaveEdit} disabled={saving} style={{ ...btnPrimary, padding: '6px 10px' }}><Check size={13} /></button>
                    <button onClick={() => setEditingId(null)} style={{ ...btnSecondary, padding: '6px 10px' }}><X size={13} /></button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cost.label}</div>
                      <div style={{ fontSize: '0.71rem', color: '#94a3b8', marginTop: 1 }}>{OPEX_LABELS[cost.category] || cost.category} · P&L category</div>
                    </div>
                    <div style={{ whiteSpace: 'nowrap', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                      {fmt(cost.default_amount)}
                      <span style={{ fontSize: '0.68rem', fontWeight: 400, color: '#94a3b8' }}>/mo</span>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button
                        onClick={() => { setEditingId(cost.id); setEditForm({ label: cost.label, category: cost.category, default_amount: String(cost.default_amount) }); }}
                        style={{ background: 'none', border: '1px solid #e2e7ee', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#64748b', display: 'flex' }}
                      ><Edit2 size={12} /></button>
                      <button
                        onClick={() => handleDelete(cost.id)}
                        style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#f87171', display: 'flex' }}
                      ><Trash2 size={12} /></button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right: Monthly override panel */}
        <div style={{ background: '#fff', border: '1px solid #e2e7ee', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

          {/* Month picker */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 10 }}>Monthly Override</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={prevMonth} style={{ background: 'none', border: '1px solid #e2e7ee', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', color: '#64748b' }}>
                <ChevronLeft size={14} />
              </button>
              <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0f172a', textAlign: 'center', flex: 1 }}>
                {MONTHS_FULL[selMonth - 1]} {selYear}
              </div>
              <button onClick={nextMonth} style={{ background: 'none', border: '1px solid #e2e7ee', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', color: '#64748b' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {costs.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
              Add fixed costs on the left first
            </div>
          ) : (
            <>
              {costs.map((cost, i) => {
                const overridden = isOverridden(cost);
                const dirty = monthEdits[cost.id] !== undefined;
                return (
                  <div
                    key={cost.id}
                    style={{ padding: '10px 18px', borderBottom: i < costs.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: 8, background: overridden && !dirty ? '#f0f9ff' : '#fff' }}
                  >
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div style={{ fontSize: '0.83rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cost.label}</div>
                      {overridden && !dirty && (
                        <div style={{ fontSize: '0.67rem', color: '#0891b2', marginTop: 1 }}>override · default {fmt(cost.default_amount)}</div>
                      )}
                      {!overridden && !dirty && (
                        <div style={{ fontSize: '0.67rem', color: '#94a3b8', marginTop: 1 }}>default</div>
                      )}
                      {dirty && (
                        <div style={{ fontSize: '0.67rem', color: '#3b82f6', marginTop: 1 }}>edited — unsaved</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>৳</span>
                      <input
                        type="number"
                        value={displayVal(cost)}
                        onChange={e => setMonthEdits(prev => ({ ...prev, [cost.id]: e.target.value }))}
                        min="0"
                        style={{ ...inputStyle, width: 110, textAlign: 'right', fontWeight: 700, fontSize: '0.88rem', borderColor: cellBorder(cost), padding: '6px 10px' }}
                      />
                      {overridden && !dirty && (
                        <button
                          onClick={() => handleResetOne(cost)}
                          title="Reset to default"
                          style={{ background: 'none', border: '1px solid #e2e7ee', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
                        >
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Save footer */}
              <div style={{ padding: '12px 18px', background: hasEdits ? '#f8faff' : '#f9fafb', borderTop: '1px solid #e2e7ee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.83rem' }}>
                  <span style={{ color: '#64748b' }}>Total: </span>
                  <span style={{ fontWeight: 900, color: '#0f172a' }}>{fmt(totalMonth)}</span>
                  {totalMonth !== totalDefault && (
                    <span style={{ fontSize: '0.72rem', color: '#0891b2', marginLeft: 6 }}>
                      (default {fmt(totalDefault)})
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSaveMonth}
                  disabled={!hasEdits || saving}
                  style={{ ...btnPrimary, padding: '7px 14px', fontSize: '0.8rem', opacity: hasEdits ? 1 : 0.4 }}
                >
                  {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                  Save {MONTHS_FULL[selMonth - 1]}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SQL migration hint */}
      <details style={{ background: '#f8fafc', border: '1px solid #e2e7ee', borderRadius: 8, padding: '12px 16px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', userSelect: 'none' }}>
          Supabase SQL Migration (run once)
        </summary>
        <pre style={{ margin: '10px 0 0', fontSize: '0.72rem', color: '#374151', background: '#f1f5f9', borderRadius: 6, padding: '12px', overflowX: 'auto', lineHeight: 1.6 }}>{`CREATE TABLE IF NOT EXISTS fin_fixed_costs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text NOT NULL,
  category      text NOT NULL,
  default_amount numeric NOT NULL DEFAULT 0,
  sort_order    int  NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fin_fixed_cost_months (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_cost_id uuid NOT NULL REFERENCES fin_fixed_costs(id) ON DELETE CASCADE,
  month         text NOT NULL,
  amount        numeric NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (fixed_cost_id, month)
);`}</pre>
      </details>
    </div>
  );
};
