'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Panel } from '@/components/Common/Panel';
import { 
  DollarSign, 
  TrendingUp, 
  Coins, 
  Briefcase, 
  Calendar, 
  User, 
  MessageSquare, 
  Tag, 
  Layers, 
  PlusCircle, 
  CheckCircle2, 
  XCircle,
  Megaphone,
  ShoppingBag,
  ArrowRightLeft,
  Truck,
  RotateCcw
} from 'lucide-react';

type MasterProduct = {
  productName: string;
  qty: number;
  cogs: number;
  cogsVar: number;
  unitPrice: number;
  netProfitPerUnit: number;
  totalCOGS: number;
  totalCOGSVar: number;
  netProfitValue: number;
  grossMargin: number;
  netMargin: number;
};

type ManufacturingDetail = {
  id: string;
  product: string;
  color: string;
  qty: number;
  fabricCost: number;
  manufCostPerUnit: number;
  accessoriesCost: number;
  totalManufCost: number;
  paid: boolean;
};

type Payout = {
  id: string;
  date: string;
  amount: number;
  product: string;
  comments: string;
};

type AdSpend = {
  id: string;
  date: string;
  amountUSD: number;
  amountBDT: number;
  comments: string;
};

type MscCost = {
  id: string;
  item: string;
  cost: number;
  comments: string;
};

type Funding = {
  id: string;
  date: string;
  amount: number;
  from: string;
  details: string;
};

type FixedCost = {
  id: string;
  description: string;
  amount: number;
  comments: string;
};

type LedgerData = {
  masterProducts: MasterProduct[];
  manufacturingDetails: ManufacturingDetail[];
  payouts: Payout[];
  adSpend: AdSpend[];
  mscShoot: MscCost[];
  fixedCosts: FixedCost[];
  funding: Funding[];
};

type TabType = 'overview' | 'manufacturing' | 'ads' | 'expenses' | 'funding' | 'reconciliation';

const fmt = (n: number) => `৳${Math.round(n).toLocaleString()}`;
const fmtUSD = (n: number) => `$${n.toFixed(2)}`;

export const FinanceView: React.FC = () => {
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [wooMetrics, setWooMetrics] = useState<{ revenueMTD: number; collected: number; codPending: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Search state for products
  const [prodSearch, setProdSearch] = useState('');
  
  // Transaction Logging Form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [logType, setLogType] = useState<'payout' | 'adSpend' | 'funding' | 'mscCost'>('payout');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formAmount, setFormAmount] = useState('');
  const [formAmountUSD, setFormAmountUSD] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formComments, setFormComments] = useState('');
  const [formProduct, setFormProduct] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch financial ledger and live WooCommerce cash flows
  const fetchData = async () => {
    setLoading(true);
    try {
      const [ledgerRes, wooRes] = await Promise.all([
        fetch('/api/finance'),
        fetch('/api/accounting?period=month')
      ]);
      const ledgerJson = await ledgerRes.json();
      const wooJson = await wooRes.json();
      
      setLedger(ledgerJson);
      setWooMetrics({
        revenueMTD: wooJson.revenueMTD || 0,
        collected: wooJson.collected || 0,
        codPending: wooJson.codPending || 0,
      });
    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle toggling paid status for variant manufacture cost
  const handleTogglePaid = async (id: string, currentPaidStatus: boolean) => {
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'togglePaidStatus',
          payload: { id, paid: !currentPaidStatus }
        })
      });
      if (res.ok) {
        const json = await res.json();
        setLedger(json.ledger);
      }
    } catch (e) {
      console.error("Failed to toggle paid status", e);
    }
  };

  // Submit transaction logging form
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    let action = '';
    let payload: any = {};

    if (logType === 'payout') {
      action = 'addPayout';
      payload = {
        date: formDate,
        amount: parseFloat(formAmount),
        product: formProduct,
        comments: formComments
      };
      if (!payload.amount || !payload.product) {
        setSubmitError('Please fill in amount and product name.');
        setSubmitting(false);
        return;
      }
    } else if (logType === 'adSpend') {
      action = 'addAdSpend';
      payload = {
        date: formDate,
        amountUSD: parseFloat(formAmountUSD || '0'),
        amountBDT: parseFloat(formAmount),
        comments: formComments || 'Meta Ads Boost'
      };
      if (!payload.amountBDT) {
        setSubmitError('Please fill in BDT amount.');
        setSubmitting(false);
        return;
      }
    } else if (logType === 'funding') {
      action = 'addFunding';
      payload = {
        date: formDate,
        amount: parseFloat(formAmount),
        from: formLabel,
        details: formComments
      };
      if (!payload.amount || !payload.from) {
        setSubmitError('Please fill in amount and investment source.');
        setSubmitting(false);
        return;
      }
    } else if (logType === 'mscCost') {
      action = 'addMscShoot';
      payload = {
        item: formLabel,
        cost: parseFloat(formAmount),
        comments: formComments
      };
      if (!payload.cost || !payload.item) {
        setSubmitError('Please fill in item name and cost amount.');
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      if (res.ok) {
        const json = await res.json();
        setLedger(json.ledger);
        setShowLogForm(false);
        // Reset form
        setFormAmount('');
        setFormAmountUSD('');
        setFormLabel('');
        setFormComments('');
        setFormProduct('');
      } else {
        const errJson = await res.json();
        setSubmitError(errJson.error || 'Failed to submit transaction.');
      }
    } catch (err) {
      setSubmitError('Network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  // Memoized financial aggregations
  const stats = useMemo(() => {
    if (!ledger) return null;

    const totalFunding = ledger.funding.reduce((sum, f) => sum + f.amount, 0);
    const totalPayouts = ledger.payouts.reduce((sum, p) => sum + p.amount, 0);
    const totalAdSpend = ledger.adSpend.reduce((sum, a) => sum + a.amountBDT, 0);
    
    // Split mscShoot into Paid vs Due
    const mscPaid = ledger.mscShoot
      .filter(m => !m.comments.toLowerCase().includes('due'))
      .reduce((sum, m) => sum + m.cost, 0);
    const mscDue = ledger.mscShoot
      .filter(m => m.comments.toLowerCase().includes('due'))
      .reduce((sum, m) => sum + m.cost, 0);

    const fixedCostsTotal = ledger.fixedCosts.reduce((sum, f) => sum + f.amount, 0);

    // Dynamic Manufacturing calculation
    const manufacturingDetailsTotal = ledger.manufacturingDetails.reduce((sum, m) => sum + m.totalManufCost, 0);
    const manufacturingDuesPaid = ledger.manufacturingDetails
      .filter(m => m.paid)
      .reduce((sum, m) => sum + m.totalManufCost, 0);
    const manufacturingDuesOutstanding = ledger.manufacturingDetails
      .filter(m => !m.paid)
      .reduce((sum, m) => sum + m.totalManufCost, 0);

    // Reconciliation calculations
    const wooCollected = wooMetrics?.collected ?? 0;
    const wooPending = wooMetrics?.codPending ?? 0;
    const wooTotalRevenue = wooMetrics?.revenueMTD ?? 0;

    // Available cash inside the bank account
    // Available = Invested equity + COD courier cash outs - logged cash payments
    const availableCashBalance = totalFunding + wooCollected - totalPayouts - totalAdSpend - mscPaid - fixedCostsTotal;

    // Projected runway cash (including COD currently in-transit)
    const projectedRunwayCash = availableCashBalance + wooPending;

    // Total outstanding liabilities
    const totalLiabilities = manufacturingDuesOutstanding + mscDue;

    // Total Net Worth / Net Equity position
    // Equity = cash reserves + stock valuation (total COGS of remaining units) - liabilities
    const inventoryAssetValuation = ledger.masterProducts.reduce((sum, p) => sum + p.totalCOGS, 0);
    const netEquity = projectedRunwayCash + inventoryAssetValuation - totalLiabilities;

    return {
      totalFunding,
      totalPayouts,
      totalAdSpend,
      mscPaid,
      mscDue,
      fixedCostsTotal,
      manufacturingDetailsTotal,
      manufacturingDuesPaid,
      manufacturingDuesOutstanding,
      availableCashBalance,
      projectedRunwayCash,
      totalLiabilities,
      inventoryAssetValuation,
      netEquity,
      wooTotalRevenue,
      wooCollected,
      wooPending
    };
  }, [ledger, wooMetrics]);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!ledger) return [];
    if (!prodSearch.trim()) return ledger.masterProducts;
    return ledger.masterProducts.filter(p => 
      p.productName.toLowerCase().includes(prodSearch.toLowerCase())
    );
  }, [ledger, prodSearch]);

  const filteredManufacturing = useMemo(() => {
    if (!ledger) return [];
    if (!prodSearch.trim()) return ledger.manufacturingDetails;
    return ledger.manufacturingDetails.filter(m => 
      m.product.toLowerCase().includes(prodSearch.toLowerCase()) ||
      m.color.toLowerCase().includes(prodSearch.toLowerCase())
    );
  }, [ledger, prodSearch]);

  if (loading || !ledger || !stats) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <div className="animate-spin" style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid #ccc', borderTopColor: '#2563eb', borderRadius: '50%', marginBottom: '1rem' }} />
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>Reconciling financial ledgers...</p>
      </div>
    );
  }

  return (
    <section className="view" id="finance-view" data-title="Finance Center">
      {/* ── Financial Summary KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Available Bank Balance</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#166534', marginTop: 4, lineHeight: 1 }}>{fmt(stats.availableCashBalance)}</div>
          </div>
          <span style={{ fontSize: '0.62rem', color: '#16a34a', marginTop: 8 }}>Cash on hand (Settled)</span>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Projected Capital</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#1e40af', marginTop: 4, lineHeight: 1 }}>{fmt(stats.projectedRunwayCash)}</div>
          </div>
          <span style={{ fontSize: '0.62rem', color: '#2563eb', marginTop: 8 }}>Bank + In-Transit Courier COD</span>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Outstanding Dues</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#991b1b', marginTop: 4, lineHeight: 1 }}>{fmt(stats.totalLiabilities)}</div>
          </div>
          <span style={{ fontSize: '0.62rem', color: '#ef4444', marginTop: 8 }}>Mfg Dues: {fmt(stats.manufacturingDuesOutstanding)}</span>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', border: '1px solid #e9d5ff', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stock Valuation</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#5b21b6', marginTop: 4, lineHeight: 1 }}>{fmt(stats.inventoryAssetValuation)}</div>
          </div>
          <span style={{ fontSize: '0.62rem', color: '#7c3aed', marginTop: 8 }}>Total Inventory Asset Cost</span>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Equity</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#92400e', marginTop: 4, lineHeight: 1 }}>{fmt(stats.netEquity)}</div>
          </div>
          <span style={{ fontSize: '0.62rem', color: '#d97706', marginTop: 8 }}>Net Worth (Cash + Stock - Debt)</span>
        </div>

      </div>

      {/* ── Sub-navigation Tabs & Controls ── */}
      <div className="module-toolbar" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="segmented-control" style={{ display: 'inline-flex', padding: 3, background: '#f1f5f9', borderRadius: 8 }}>
          {(['overview', 'reconciliation', 'manufacturing', 'ads', 'expenses', 'funding'] as TabType[]).map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'is-selected' : ''}
              onClick={() => setActiveTab(tab)}
              type="button"
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderRadius: 6,
                fontWeight: activeTab === tab ? 700 : 500,
                color: activeTab === tab ? '#0f172a' : '#64748b',
                background: activeTab === tab ? '#ffffff' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {['master', 'manufacturing'].includes(activeTab) || activeTab === 'overview' && (
            <input
              type="text"
              placeholder="Search product..."
              value={prodSearch}
              onChange={(e) => setProdSearch(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '0.78rem',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                width: 160,
                background: '#ffffff'
              }}
            />
          )}

          <button
            onClick={() => setShowLogForm(!showLogForm)}
            type="button"
            className="premium-action-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '6px 12px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <PlusCircle size={14} />
            <span>Log Transaction</span>
          </button>
        </div>
      </div>

      {/* ── Transaction Entry Form Panel (Collapsible) ── */}
      {showLogForm && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1.5px solid #0f172a',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 20,
          animation: 'slideDown 0.2s ease-out'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>Record Financial Event</h3>
          <form onSubmit={handleLogSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>TRANSACTION TYPE</label>
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value as any)}
                style={{ padding: '6px 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' }}
              >
                <option value="payout">Manufacturer Payout</option>
                <option value="adSpend">Meta Ads Boost (AMEX)</option>
                <option value="funding">Investment / Capital Injection</option>
                <option value="mscCost">Office / Studio Setup Cost</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>DATE</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
              />
            </div>

            {logType === 'adSpend' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>AMOUNT (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 80.05"
                  value={formAmountUSD}
                  onChange={(e) => setFormAmountUSD(e.target.value)}
                  style={{ padding: '5px 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>
                {logType === 'adSpend' ? 'AMOUNT (BDT)' : 'AMOUNT (BDT)'}
              </label>
              <input
                type="number"
                placeholder="e.g. 25000"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
              />
            </div>

            {logType === 'payout' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>TARGET PRODUCT</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Shirt"
                  value={formProduct}
                  onChange={(e) => setFormProduct(e.target.value)}
                  style={{ padding: '5px 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>
            )}

            {logType !== 'payout' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>
                  {logType === 'funding' ? 'INVESTMENT SOURCE' : 'ITEM / BENEFICIARY'}
                </label>
                <input
                  type="text"
                  placeholder={logType === 'funding' ? 'e.g. City Bank' : 'e.g. Sofa purchase'}
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  style={{ padding: '5px 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>MEMO / COMMENTS</label>
              <input
                type="text"
                placeholder="Details of transaction..."
                value={formComments}
                onChange={(e) => setFormComments(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '7px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                {submitting ? 'Writing...' : 'Post Entry'}
              </button>
              <button
                type="button"
                onClick={() => setShowLogForm(false)}
                style={{
                  padding: '7px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>

          </form>
          {submitError && (
            <div style={{ marginTop: 10, fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>
              Error: {submitError}
            </div>
          )}
        </div>
      )}

      {/* ── Active View Content ── */}
      
      {/* ── TABS: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'stretch' }}>
          
          <Panel title="Master Budget Allocation" subtitle="Overall financial plan vs historical raw ledger metrics.">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: 'center' }}>Total Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Total COGS+Var</th>
                    <th style={{ textAlign: 'right' }}>Retail Valuation</th>
                    <th style={{ textAlign: 'right' }}>Projected Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.productName}>
                      <td style={{ fontWeight: 700, fontSize: '0.82rem' }}>{p.productName}</td>
                      <td style={{ textAlign: 'center' }}>{p.qty}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(p.unitPrice)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(p.totalCOGSVar)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.qty * p.unitPrice)}</td>
                      <td style={{ textAlign: 'right', color: '#166534', fontWeight: 650 }}>{fmt(p.netProfitValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="General Ledger Summary" subtitle="Reconciled metrics across allocations.">
            <div style={{ padding: 6 }}>
              {[
                { label: 'Total Budget Valuations', value: fmt(3758116), desc: 'Master retail inventory value' },
                { label: 'Funds Required (Allocated)', value: fmt(2465373), desc: 'Includes fabrication, manufacturing & ads' },
                { label: 'Total Invested Equity', value: fmt(stats.totalFunding), desc: 'Equity deposits & credit injections' },
                { label: 'Unsold 45% Stock Value', value: fmt(1691152), desc: 'Estimated value of unsold goods' },
                { label: 'Meta Ads Allocated Spend', value: fmt(400000), desc: 'Allocated budget for campaigns' },
                { label: 'Total Manufacturer Dues Logged', value: fmt(stats.manufacturingDetailsTotal), desc: 'Raw manufacturer contracts' },
                { label: 'Fixed Costs Liabilities', value: fmt(stats.fixedCostsTotal), desc: 'Committed office rents & salaries' },
              ].map((item, idx, arr) => (
                <div key={item.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: idx < arr.length - 1 ? '1px solid #f1f5f9' : 'none'
                }}>
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: '#334155' }}>{item.label}</strong>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 1 }}>{item.desc}</div>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 750, color: '#0f172a' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </Panel>

        </div>
      )}

      {/* ── TABS: RECONCILIATION ── */}
      {activeTab === 'reconciliation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'stretch' }}>
          
          <Panel title="Courier & Sales Flow Reconciliation" subtitle="Tracking inflows from WooCommerce sales to settled bank reserves.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShoppingBag size={16} color="#2563eb" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>WooCommerce MTD Sales Inflow</span>
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: '#1e3a8a' }}>{fmt(stats.wooTotalRevenue)}</strong>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.68rem', color: '#64748b' }}>Live value of all placed orders in the WooCommerce system.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', color: '#94a3b8' }}>
                <ArrowRightLeft size={16} style={{ transform: 'rotate(90deg)' }} />
              </div>

              <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Truck size={16} color="#16a34a" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d' }}>Pathao COD Settlements Received</span>
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: '#14532d' }}>{fmt(stats.wooCollected)}</strong>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.68rem', color: '#166534' }}>Settled cash completely paid out by Pathao into bank reserves.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', color: '#94a3b8' }}>
                <ArrowRightLeft size={16} style={{ transform: 'rotate(90deg)' }} />
              </div>

              <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: 8, border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RotateCcw size={16} color="#d97706" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309' }}>Pending COD Balances In-Transit</span>
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: '#78350f' }}>{fmt(stats.wooPending)}</strong>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.68rem', color: '#92400e' }}>Funds currently processing or in review by Pathao courier.</p>
              </div>

            </div>
          </Panel>

          <Panel title="Landed Expense Deduction" subtitle="Where cash reserves are being spent.">
            <div style={{ padding: 4 }}>
              {[
                { label: 'Manufacturer Dues Settled', value: fmt(stats.totalPayouts), pct: stats.totalFunding > 0 ? (stats.totalPayouts / stats.totalFunding) * 100 : 0, color: '#ef4444' },
                { label: 'Meta Ads Marketing spend', value: fmt(stats.totalAdSpend), pct: stats.totalFunding > 0 ? (stats.totalAdSpend / stats.totalFunding) * 100 : 0, color: '#3b82f6' },
                { label: 'Fixed Costs (Rent, salaries)', value: fmt(stats.fixedCostsTotal), pct: stats.totalFunding > 0 ? (stats.fixedCostsTotal / stats.totalFunding) * 100 : 0, color: '#8b5cf6' },
                { label: 'Setup Assets, shoot & labels', value: fmt(stats.mscPaid), pct: stats.totalFunding > 0 ? (stats.mscPaid / stats.totalFunding) * 100 : 0, color: '#f59e0b' },
              ].map((item) => (
                <div key={item.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    <span>{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, item.pct)}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2 }}>
                    Consumes {item.pct.toFixed(1)}% of total equity funding reserves.
                  </div>
                </div>
              ))}
            </div>
          </Panel>

        </div>
      )}

      {/* ── TABS: MANUFACTURING ── */}
      {activeTab === 'manufacturing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'stretch' }}>
            
            <Panel title="Variant-Level Manufacturing Ledger" subtitle="Paid vs Due status per variant batch. Click check icon to toggle state.">
              <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product & Option</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Fabric Cost</th>
                      <th style={{ textAlign: 'right' }}>Unit Mfg</th>
                      <th style={{ textAlign: 'right' }}>Total Cost</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManufacturing.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{m.product}</div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{m.color}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{m.qty}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(m.fabricCost)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(m.manufCostPerUnit)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(m.totalManufCost)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleTogglePaid(m.id, m.paid)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: 4
                            }}
                            title={`Mark as ${m.paid ? 'Due' : 'Paid'}`}
                          >
                            {m.paid ? (
                              <CheckCircle2 size={16} color="#10b981" />
                            ) : (
                              <XCircle size={16} color="#ef4444" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Manufacturer Dues Reconciliation" subtitle="Total manufacturing liabilities.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', background: '#f8fafc' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Manufacturer Liabilities Required</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 850, color: '#0f172a', marginTop: 2 }}>{fmt(stats.manufacturingDetailsTotal)}</div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#94a3b8' }}>Total cost mapped in production specifications sheets.</p>
                </div>

                <div style={{ border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', background: '#f0fdf4' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Manufacture Dues Paid (Specs)</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 850, color: '#15803d', marginTop: 2 }}>{fmt(stats.manufacturingDuesPaid)}</div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#166534' }}>Costs validated and checked as Paid on variants list.</p>
                </div>

                <div style={{ border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', background: '#fff5f5' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Manufacturer Remaining Dues</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 850, color: '#b91c1c', marginTop: 2 }}>{fmt(stats.manufacturingDuesOutstanding)}</div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#ef4444' }}>Outstanding production values remaining to clear.</p>
                </div>
              </div>
            </Panel>

          </div>

          <Panel title="Manufacturer Payouts Log" subtitle="Historical cash payouts logged to manufacture partners.">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product Family</th>
                    <th>Comments / Memo</th>
                    <th style={{ textAlign: 'right' }}>Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.payouts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td style={{ fontWeight: 650 }}>{p.product}</td>
                      <td>{p.comments}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{fmt(p.amount)}</td>
                    </tr>
                  ))}
                  {ledger.payouts.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem' }}>No manufacturer payouts logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

        </div>
      )}

      {/* ── TABS: ADS & MARKETING ── */}
      {activeTab === 'ads' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'stretch' }}>
          
          <Panel title="AMEX Personal Card Meta Spend Statement" subtitle="Historical ad boosts card transaction ledger.">
            <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Campaign / Event</th>
                    <th style={{ textAlign: 'right' }}>USD Charge</th>
                    <th style={{ textAlign: 'right' }}>BDT Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.adSpend.map((a) => (
                    <tr key={a.id}>
                      <td>{a.date}</td>
                      <td>{a.comments}</td>
                      <td style={{ textAlign: 'right', color: '#2563eb' }}>{a.amountUSD > 0 ? fmtUSD(a.amountUSD) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(a.amountBDT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Ad Spend Summary" subtitle="Reconciled marketing ROI metric insights.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Logged Ad spend</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#0f172a', marginTop: 2 }}>{fmt(stats.totalAdSpend)}</div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#64748b' }}>Sum of BDT charges recorded across Amex statement lists.</p>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Marketing Budget Limit</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#0f172a', marginTop: 2 }}>{fmt(400000)}</div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#64748b' }}>Assigned master product ADS regular budget limit.</p>
              </div>

              <div style={{ border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', background: '#f0fdf4' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Remaining Marketing Runway</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#15803d', marginTop: 2 }}>{fmt(400000 - stats.totalAdSpend)}</div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#166534' }}>Unspent marketing funds currently available to scale.</p>
              </div>
            </div>
          </Panel>

        </div>
      )}

      {/* ── TABS: EXPENSES & ASSETS ── */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'stretch' }}>
            
            <Panel title="Miscellaneous & Shoot Costs Ledger" subtitle="Office assets purchases, model costs, logistics, labels and packaging.">
              <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Setup Item</th>
                      <th>Comments / Status</th>
                      <th style={{ textAlign: 'right' }}>BDT Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.mscShoot.map((m) => {
                      const isDue = m.comments.toLowerCase().includes('due');
                      return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 700, fontSize: '0.82rem' }}>{m.item}</td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              backgroundColor: isDue ? '#fff5f5' : '#f0fdf4',
                              color: isDue ? '#ef4444' : '#10b981',
                              border: isDue ? '1px solid #fee2e2' : '1px solid #bbf7d0'
                            }}>
                              {isDue ? 'Outstanding Due' : 'Paid Out'}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 8 }}>{m.comments}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: isDue ? '#ef4444' : '#0f172a' }}>{fmt(m.cost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Fixed Operational Commitments" subtitle="Monthly liabilities and rents.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
                {ledger.fixedCosts.map((f) => (
                  <div key={f.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>{f.description}</span>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{fmt(f.amount)}</strong>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 4, display: 'block' }}>{f.comments}</span>
                  </div>
                ))}
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Aggregated Expenditures</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.78rem', color: '#334155' }}>
                  <span>Fixed Expenses (Paid)</span>
                  <strong>{fmt(stats.fixedCostsTotal)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.78rem', color: '#334155' }}>
                  <span>Misc Setup (Paid)</span>
                  <strong>{fmt(stats.mscPaid)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.78rem', color: '#ef4444' }}>
                  <span>Misc Setup (Due)</span>
                  <strong>{fmt(stats.mscDue)}</strong>
                </div>
              </div>
            </Panel>

          </div>

        </div>
      )}

      {/* ── TABS: FUNDING & INVESTMENT ── */}
      {activeTab === 'funding' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'stretch' }}>
          
          <Panel title="Equity & Credit Funding Records" subtitle="Tracking seed capital injections.">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Source Entity</th>
                    <th>Description / Purpose</th>
                    <th style={{ textAlign: 'right' }}>Capital Deposited</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.funding.map((f) => (
                    <tr key={f.id}>
                      <td>{f.date}</td>
                      <td style={{ fontWeight: 700 }}>{f.from}</td>
                      <td>{f.details}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#166534' }}>{fmt(f.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Capital Runway Dashboard" subtitle="Total equity balance structure.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Injected Capital</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#0f172a', marginTop: 2 }}>{fmt(stats.totalFunding)}</div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#64748b' }}>Combined equity injections and bank credits.</p>
              </div>

              <div style={{ border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', background: '#f0fdf4' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Net Available Reserves</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 850, color: '#15803d', marginTop: 2 }}>{fmt(stats.availableCashBalance)}</div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#166534' }}>Injected reserves less all logged payments.</p>
              </div>
            </div>
          </Panel>

        </div>
      )}

    </section>
  );
};
