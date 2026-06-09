'use client';

import React, { useEffect, useState } from 'react';
import { 
  Megaphone, 
  TrendingUp, 
  RefreshCw, 
  DollarSign, 
  Percent, 
  Target, 
  Activity, 
  AlertTriangle,
  Info,
  Coins,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Eye,
  MousePointerClick
} from 'lucide-react';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import type { MetaCampaign } from '@/lib/integrations/meta';
import { fmt } from './shared';

interface ReconciledMonth {
  month: string;
  label: string;
  spend: number; // USD
  revenue: number; // USD
  roas: number;
  cpa: number;
  purchases: number;
  impressions: number;
  clicks: number;
  storeRevenue: number; // BDT
  deliveredOrders: number;
  returnedOrders: number;
  deliveredAmount: number; // BDT
}

// Format as USD since Meta Ads account is denominated in USD
const fmtUSD = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const fmtUSDDec = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const KPICard = ({
  label, 
  value, 
  sub, 
  color, 
  icon: Icon,
  badge,
}: {
  label: string; 
  value: string; 
  sub?: string; 
  color: string; 
  icon: React.FC<any>;
  badge?: React.ReactNode;
}) => {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      borderTop: `3px solid ${color}`,
      display: 'flex', 
      flexDirection: 'column', 
      gap: 10,
      transition: 'transform 150ms ease, box-shadow 150ms ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)';
    }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {badge}
          <div style={{ background: `${color}18`, borderRadius: 8, padding: 7, display: 'grid', placeItems: 'center' }}>
            <Icon size={14} color={color} />
          </div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: '1.7rem', fontWeight: 900, letterSpacing: '-0.03em', color: color, lineHeight: 1 }}>{value}</span>
        </div>
        {sub && <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 5 }}>{sub}</div>}
      </div>
    </div>
  );
};

export const FinanceAds: React.FC = () => {
  const [data, setData] = useState<ReconciledMonth[]>([]);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Twin Sub-Tabs State
  const [subTab, setSubTab] = useState<'financial' | 'creative'>('financial');

  // Dynamic Parameter Modeling Parameters
  const [exchangeRate, setExchangeRate] = useState<number>(130);
  const [vatRate, setVatRate] = useState<number>(15);
  const [avgCogs, setAvgCogs] = useState<number>(750);
  const [avgShipping, setAvgShipping] = useState<number>(120);
  const [avgReturnCost, setAvgReturnCost] = useState<number>(60);

  const fetchAdsData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const url = `/api/finance/ads${isRefresh ? '?refresh=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load ads insights: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while loading Meta Ads data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/ads?period=month');
      if (res.ok) {
        const json = await res.json();
        setCampaigns(json.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    fetchAdsData();
  }, []);

  useEffect(() => {
    if (subTab === 'creative') {
      fetchCampaigns();
    }
  }, [subTab]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: '#0066fe' }} />
        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Reconciling Meta, Supabase & Pathao structures...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, padding: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#991b1b' }}>Failed to retrieve reconciled Meta insights</h4>
          <p style={{ margin: '4px 0 12px 0', fontSize: '0.83rem', color: '#b91c1c' }}>{error}</p>
          <button 
            onClick={() => fetchAdsData()} 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '6px 12px', 
              background: '#ef4444', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 6, 
              fontSize: '0.8rem', 
              fontWeight: 700, 
              cursor: 'pointer' 
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // 1. Process data for outliers (Meta pixel tracking anomaly)
  const processedData = data.map(item => {
    const isOutlier = item.purchases > 0 && (item.revenue / item.purchases) > 100;
    return {
      ...item,
      isOutlier,
    };
  });

  const hasOutlier = processedData.some(item => item.isOutlier);

  // Calculate average AOV of non-outlier months
  const nonOutlierMonths = processedData.filter(m => m.purchases > 0 && !m.isOutlier);
  const avgAov = nonOutlierMonths.length > 0
    ? nonOutlierMonths.reduce((sum, m) => sum + (m.revenue / m.purchases), 0) / nonOutlierMonths.length
    : 15; // default fallback AOV of $15

  // 2. Perform dynamic e-commerce formulas based on user modeling parameters
  const resolvedMonths = processedData.map(item => {
    // True BDT Spend
    const actualSpendBDT = Math.round(item.spend * exchangeRate * (1 + vatRate / 100));

    // Unified store sales revenue (prepaid ledger + Pathao COD collections)
    const storeRevenueUnified = (item.storeRevenue || 0) + (item.deliveredAmount || 0);

    // True MER
    const trueMER = actualSpendBDT > 0 ? parseFloat((storeRevenueUnified / actualSpendBDT).toFixed(2)) : 0;

    // Delivered CAC (BDT)
    const deliveredOrders = item.deliveredOrders || 0;
    const deliveredCAC = deliveredOrders > 0 ? Math.round(actualSpendBDT / deliveredOrders) : 0;

    // Returns Loss (shipping lost + processing loss)
    const returnedOrders = item.returnedOrders || 0;
    const returnLoss = returnedOrders * (avgShipping + avgReturnCost);

    // Shipping fee
    const shippingCost = deliveredOrders * avgShipping;

    // CM2 Profit
    const cm2Profit = storeRevenueUnified - (deliveredOrders * avgCogs) - actualSpendBDT - shippingCost - returnLoss;
    const cm2Margin = storeRevenueUnified > 0 ? parseFloat(((cm2Profit / storeRevenueUnified) * 100).toFixed(1)) : 0;

    // Creative metrics
    const displayRevenueUSD = item.isOutlier ? Math.round(item.purchases * avgAov) : item.revenue;
    const displayRoas = item.spend > 0 ? parseFloat((displayRevenueUSD / item.spend).toFixed(2)) : 0;

    const yearShort = item.month.slice(2, 4);
    const chartLabel = `${item.label} '${yearShort}`;

    return {
      ...item,
      chartLabel,
      actualSpendBDT,
      storeRevenueUnified,
      trueMER,
      deliveredCAC,
      cm2Profit,
      cm2Margin,
      displayRevenueUSD,
      displayRoas,
    };
  });

  // 3. Reconciled aggregates (Totals)
  const totalSpendUSD = resolvedMonths.reduce((sum, m) => sum + m.spend, 0);
  const totalSpendBDT = resolvedMonths.reduce((sum, m) => sum + m.actualSpendBDT, 0);
  const totalStoreRevenue = resolvedMonths.reduce((sum, m) => sum + m.storeRevenueUnified, 0);
  const totalDeliveredOrders = resolvedMonths.reduce((sum, m) => sum + m.deliveredOrders, 0);
  const totalReturnedOrders = resolvedMonths.reduce((sum, m) => sum + m.returnedOrders, 0);
  const totalCM2Profit = resolvedMonths.reduce((sum, m) => sum + m.cm2Profit, 0);

  const blendedMER = totalSpendBDT > 0 ? parseFloat((totalStoreRevenue / totalSpendBDT).toFixed(2)) : 0;
  const blendedDeliveredCAC = totalDeliveredOrders > 0 ? Math.round(totalSpendBDT / totalDeliveredOrders) : 0;
  const blendedCM2Margin = totalStoreRevenue > 0 ? parseFloat(((totalCM2Profit / totalStoreRevenue) * 100).toFixed(1)) : 0;

  // Creative side aggregates
  const totalPurchases = resolvedMonths.reduce((sum, m) => sum + m.purchases, 0);
  const totalImpressions = resolvedMonths.reduce((sum, m) => sum + m.impressions, 0);
  const totalClicks = resolvedMonths.reduce((sum, m) => sum + m.clicks, 0);

  const blendedCTR = totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
  const blendedCPC = totalClicks > 0 ? parseFloat((totalSpendUSD / totalClicks).toFixed(2)) : 0;
  const blendedCPA = totalPurchases > 0 ? parseFloat((totalSpendUSD / totalPurchases).toFixed(2)) : 0;

  // Raw vs Normalized Attributed ROAS for Creative Audit KPIs
  const totalRevenueRaw = resolvedMonths.reduce((sum, m) => sum + m.revenue, 0);
  const totalRevenueNormalized = resolvedMonths.reduce((sum, m) => {
    const rev = m.isOutlier ? (m.purchases * avgAov) : m.revenue;
    return sum + rev;
  }, 0);

  const blendedRoasRaw = totalSpendUSD > 0 ? parseFloat((totalRevenueRaw / totalSpendUSD).toFixed(2)) : 0;
  const blendedRoasNormalized = totalSpendUSD > 0 ? parseFloat((totalRevenueNormalized / totalSpendUSD).toFixed(2)) : 0;

  // Render Tooltip for Financial Ledger Composed Chart
  const financialTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ 
        background: '#fff', 
        border: '1px solid #e2e7ee', 
        borderRadius: 8, 
        padding: '10px 14px', 
        fontSize: '0.8rem', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)' 
      }}>
        <div style={{ fontWeight: 800, marginBottom: 6, color: '#0f172a' }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 4 }}>
            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color }} />
              {p.name}
            </span>
            <span style={{ fontWeight: 700, color: p.name === 'CM2 Net Profit' && p.value < 0 ? '#ef4444' : '#0f172a' }}>
              {fmt(p.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Render Tooltip for Creative performance chart
  const creativeTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ 
        background: '#fff', 
        border: '1px solid #e2e7ee', 
        borderRadius: 8, 
        padding: '10px 14px', 
        fontSize: '0.8rem', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)' 
      }}>
        <div style={{ fontWeight: 800, marginBottom: 6, color: '#0f172a' }}>{label}</div>
        {payload.map((p: any) => {
          const isRoas = p.name === 'Attributed ROAS';
          return (
            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 4 }}>
              <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color }} />
                {p.name}
              </span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                {isRoas ? `${p.value}x` : fmtUSD(p.value)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Megaphone size={20} color="#0066fe" /> Meta Ads Audit Center
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
            Unified marketing reconciliations syncing Meta Manager, Supabase general ledgers, and Pathao shipments
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => fetchAdsData(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: '#fff',
              color: '#0f172a',
              border: '1px solid #e2e7ee',
              borderRadius: 8,
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'background-color 150ms ease',
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing...' : 'Sync Cross-Channel'}
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 2 }}>
        <button
          onClick={() => setSubTab('financial')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'financial' ? '2px solid #0066fe' : '2px solid transparent',
            color: subTab === 'financial' ? '#0066fe' : '#64748b',
            padding: '8px 16px',
            fontSize: '0.88rem',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <Coins size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
          Financial Profitability Ledger
        </button>
        <button
          onClick={() => setSubTab('creative')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'creative' ? '2px solid #0066fe' : '2px solid transparent',
            color: subTab === 'creative' ? '#0066fe' : '#64748b',
            padding: '8px 16px',
            fontSize: '0.88rem',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <Target size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
          Creative & Campaign Audit
        </button>
      </div>

      {/* RENDER SUB-TAB 1: FINANCIAL PROFITABILITY LEDGER */}
      {subTab === 'financial' && (
        <>
          {/* Dynamic Modeling Variables Input Panel */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e7ee',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} color="#0066fe" />
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Operational Modeling Variables (Dynamic Audit)
              </span>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
              gap: 16 
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                  EXCHANGE RATE (BDT/USD)
                </label>
                <input 
                  type="number" 
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Math.max(1, Number(e.target.value)))}
                  style={{
                    width: '100%',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.83rem',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                  AD BILL SURCHARGE (VAT %)
                </label>
                <input 
                  type="number" 
                  value={vatRate}
                  onChange={(e) => setVatRate(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: '100%',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.83rem',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                  AVG PRODUCT COGS (৳)
                </label>
                <input 
                  type="number" 
                  value={avgCogs}
                  onChange={(e) => setAvgCogs(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: '100%',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.83rem',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                  AVG SHIPPING CHARGE (৳)
                </label>
                <input 
                  type="number" 
                  value={avgShipping}
                  onChange={(e) => setAvgShipping(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: '100%',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.83rem',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                  AVG RETURN LOSS (৳/ORDER)
                </label>
                <input 
                  type="number" 
                  value={avgReturnCost}
                  onChange={(e) => setAvgReturnCost(Math.max(0, Number(e.target.value)))}
                  style={{
                    width: '100%',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.83rem',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Reconciled KPI Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <KPICard 
              label="True Ad Spend (BDT)" 
              value={fmt(totalSpendBDT)} 
              sub={`Converted $${totalSpendUSD.toLocaleString()} USD at ৳${exchangeRate}`} 
              color="#0066fe" 
              icon={DollarSign} 
              badge={
                <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>
                  +{vatRate}% VAT
                </span>
              }
            />
            <KPICard 
              label="Unified MER" 
              value={`${blendedMER}x`} 
              sub={`Total Store Revenue: ${fmt(totalStoreRevenue)}`} 
              color={blendedMER >= 4.0 ? '#10b981' : blendedMER >= 2.5 ? '#d97706' : '#ef4444'} 
              icon={TrendingUp} 
              badge={
                <span style={{ 
                  fontSize: '0.6rem', 
                  fontWeight: 800, 
                  background: blendedMER >= 4.0 ? '#d1fae5' : blendedMER >= 2.5 ? '#fef3c7' : '#fee2e2', 
                  color: blendedMER >= 4.0 ? '#065f46' : blendedMER >= 2.5 ? '#92400e' : '#991b1b', 
                  padding: '2px 5px', 
                  borderRadius: 4,
                }}>
                  {blendedMER >= 4.0 ? 'Scalable' : blendedMER >= 2.5 ? 'Moderate' : 'Risky'}
                </span>
              }
            />
            <KPICard 
              label="Delivered CAC" 
              value={totalDeliveredOrders > 0 ? fmt(blendedDeliveredCAC) : '৳0'} 
              sub={`Fulfillment completed: ${totalDeliveredOrders} orders`} 
              color="#ea580c" 
              icon={Target} 
            />
            <KPICard 
              label="CM2 Net Margin" 
              value={fmt(totalCM2Profit)} 
              sub={`CM2 Margin Rate: ${blendedCM2Margin}%`} 
              color={totalCM2Profit >= 0 ? '#8b5cf6' : '#ef4444'} 
              icon={ShieldCheck} 
            />
          </div>

          {/* Reconciliation Trends Chart */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
          }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Cross-Channel Reconciliation Trend</h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                Comparison of marketing cash burn, aggregated business revenue (ledger + payouts), and dynamic CM2 margins
              </p>
            </div>
            
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <ComposedChart data={resolvedMonths} margin={{ top: 10, right: 0, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="chartLabel" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickFormatter={(val) => `৳${(val / 1000)}k`}
                  />
                  <Tooltip content={financialTooltip} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle" 
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }} 
                  />
                  <Bar 
                    name="Unified Store Revenue" 
                    dataKey="storeRevenueUnified" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={30}
                  />
                  <Bar 
                    name="Actual BDT Spend" 
                    dataKey="actualSpendBDT" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={30}
                  />
                  <Line 
                    type="monotone" 
                    name="CM2 Net Profit" 
                    dataKey="cm2Profit" 
                    stroke="#8b5cf6" 
                    strokeWidth={2.5} 
                    dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} 
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Financial Ledger Table */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Financial Reconciliation Ledger</h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                Consolidated view of ad investment converted to local BDT, sales channels, return losses, and unit margins
              </p>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px 24px', color: '#475569', fontWeight: 700 }}>Month</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>USD Spend</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>BDT Spend (VAT-in)</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Store Revenue</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>True MER</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Delivered Orders</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Delivered CAC</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Returns (Count)</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>CM2 Profit</th>
                    <th style={{ padding: '12px 24px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>CM2 Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedMonths.slice().reverse().map((item) => (
                    <tr 
                      key={item.month} 
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 100ms ease',
                      }}
                      className="hover-row"
                    >
                      <td style={{ padding: '12px 24px', fontWeight: 700, color: '#0f172a' }}>{item.month}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>{fmtUSDDec(item.spend)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{fmt(item.actualSpendBDT)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{fmt(item.storeRevenueUnified)}</td>
                      <td style={{ 
                        padding: '12px 16px', 
                        textAlign: 'right', 
                        fontWeight: 700, 
                        color: item.trueMER >= 4.0 ? '#10b981' : item.trueMER >= 2.5 ? '#d97706' : '#ef4444' 
                      }}>
                        {item.trueMER}x
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155' }}>{item.deliveredOrders}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>{item.deliveredOrders > 0 ? fmt(item.deliveredCAC) : '৳0'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444' }}>{item.returnedOrders}</td>
                      <td style={{ 
                        padding: '12px 16px', 
                        textAlign: 'right', 
                        fontWeight: 700, 
                        color: item.cm2Profit >= 0 ? '#8b5cf6' : '#ef4444' 
                      }}>
                        {fmt(item.cm2Profit)}
                      </td>
                      <td style={{ 
                        padding: '12px 24px', 
                        textAlign: 'right', 
                        fontWeight: 700, 
                        color: item.cm2Margin >= 25 ? '#10b981' : item.cm2Margin >= 10 ? '#4f46e5' : '#ef4444' 
                      }}>
                        {item.cm2Margin}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e7ee' }}>
                    <td style={{ padding: '14px 24px', color: '#0f172a' }}>Blended Total</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#64748b' }}>{fmtUSDDec(totalSpendUSD)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#334155' }}>{fmt(totalSpendBDT)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#10b981' }}>{fmt(totalStoreRevenue)}</td>
                    <td style={{ 
                      padding: '14px 16px', 
                      textAlign: 'right', 
                      color: blendedMER >= 4.0 ? '#10b981' : blendedMER >= 2.5 ? '#d97706' : '#ef4444' 
                    }}>
                      {blendedMER}x
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#334155' }}>{totalDeliveredOrders}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#ea580c' }}>{fmt(blendedDeliveredCAC)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#ef4444' }}>{totalReturnedOrders}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#8b5cf6' }}>{fmt(totalCM2Profit)}</td>
                    <td style={{ padding: '14px 24px', textAlign: 'right', color: '#8b5cf6' }}>{blendedCM2Margin}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* RENDER SUB-TAB 2: CREATIVE & CAMPAIGN AUDIT */}
      {subTab === 'creative' && (
        <>
          {/* Alert Warnings for Meta anomalies */}
          {hasOutlier && (
            <div style={{ 
              background: '#fffbeb', 
              border: '1px solid #fde68a', 
              borderRadius: 10, 
              padding: '12px 16px', 
              display: 'flex', 
              gap: 12, 
              alignItems: 'flex-start' 
            }}>
              <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.4 }}>
                <strong style={{ fontWeight: 700 }}>Pixel Event Attribution Outlier:</strong> August 2025 exhibits highly inflated revenue aggregates due to a checkout tracking bug (reported AOV of $6.8M USD). The trend charts and metrics below are automatically normalized using the 12-month average AOV ({fmtUSD(avgAov)}).
              </div>
            </div>
          )}

          {/* Top-of-Funnel KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <KPICard 
              label="Blended CTR" 
              value={`${blendedCTR}%`} 
              sub={`Clicks: ${totalClicks.toLocaleString()} / Imps: ${totalImpressions.toLocaleString()}`} 
              color="#0066fe" 
              icon={MousePointerClick} 
            />
            <KPICard 
              label="Blended CPC" 
              value={fmtUSDDec(blendedCPC)} 
              sub="Cost per Link Click (USD)" 
              color="#10b981" 
              icon={Activity} 
            />
            <KPICard 
              label="Attributed ROAS" 
              value={`${hasOutlier ? blendedRoasNormalized : blendedRoasRaw}x`} 
              sub={hasOutlier ? `Normalized (${blendedRoasRaw}x raw)` : "Meta Pixel Attributed"} 
              color="#8b5cf6" 
              icon={Percent} 
            />
            <KPICard 
              label="Attributed CPA" 
              value={totalPurchases > 0 ? fmtUSDDec(blendedCPA) : '$0.00'} 
              sub={`Pixel Purchases: ${totalPurchases}`} 
              color="#ea580c" 
              icon={Target} 
            />
          </div>

          {/* Spend vs ROAS Composed Chart */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
          }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Top-of-Funnel Conversion Efficiency</h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                Track Meta USD budget allocation against pixel conversions and attributed ROAS multipliers {hasOutlier && '(outlier normalized)'}
              </p>
            </div>
            
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <ComposedChart data={resolvedMonths} margin={{ top: 10, right: -5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="chartLabel" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickFormatter={(val) => `$${val}`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#8b5cf6', fontWeight: 600 }} 
                    tickFormatter={(val) => `${val}x`}
                  />
                  <Tooltip content={creativeTooltip} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle" 
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }} 
                  />
                  <Bar 
                    yAxisId="left"
                    name="Spend (USD)" 
                    dataKey="spend" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={30}
                  />
                  <Bar 
                    yAxisId="left"
                    name="Attributed Revenue (USD)" 
                    dataKey="displayRevenueUSD" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={30}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    name="Attributed ROAS" 
                    dataKey="displayRoas" 
                    stroke="#8b5cf6" 
                    strokeWidth={2.5} 
                    dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} 
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Performance Ledger Table */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            marginBottom: 24,
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Monthly Performance Ledger</h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                Granular month-over-month breakdown of USD ad spend, pixel-attributed conversion revenues, and CTR/CPC efficiency
              </p>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px 24px', color: '#475569', fontWeight: 700 }}>Month</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Spend (USD)</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Spend (BDT)</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Store Revenue</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>True ROAS</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Attributed ROAS</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Purchases</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Delivered Orders</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>CPA (USD)</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Impressions</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Clicks</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>CTR</th>
                    <th style={{ padding: '12px 24px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>CPC (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedMonths.slice().reverse().map((item) => {
                    const ctr = item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(2) : '0.00';
                    const cpc = item.clicks > 0 ? (item.spend / item.clicks).toFixed(2) : '0.00';
                    return (
                      <tr 
                        key={item.month} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background-color 100ms ease',
                          background: item.isOutlier ? '#fffbeb' : 'transparent',
                        }}
                        className="hover-row"
                      >
                        <td style={{ padding: '12px 24px', fontWeight: 700, color: '#0f172a' }}>
                          {item.month}
                          {item.isOutlier && (
                            <div style={{ fontSize: '0.62rem', color: '#d97706', fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>
                              Anomaly Outlier
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                          {item.spend > 0 ? fmtUSDDec(item.spend) : '$0.00'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                          {fmt(item.actualSpendBDT)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                          {fmt(item.storeRevenueUnified)}
                        </td>
                        <td style={{ 
                          padding: '12px 16px', 
                          textAlign: 'right', 
                          fontWeight: 700, 
                          color: item.trueMER >= 4.0 ? '#10b981' : item.trueMER >= 2.5 ? '#d97706' : '#ef4444' 
                        }}>
                          {item.trueMER}x
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: item.isOutlier ? '#d97706' : (item.displayRoas >= 2.5 ? '#8b5cf6' : '#64748b') }}>
                          {item.isOutlier ? (
                            <>
                              <div style={{ textDecoration: 'line-through', fontSize: '0.73rem', color: '#94a3b8' }}>
                                {item.roas.toLocaleString()}x
                              </div>
                              <div>
                                {parseFloat(((item.purchases * avgAov) / item.spend).toFixed(2))}x
                              </div>
                            </>
                          ) : (
                            item.displayRoas > 0 ? `${item.displayRoas}x` : '0.00x'
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155' }}>
                          {item.purchases.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155' }}>
                          {item.deliveredOrders.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: item.cpa > 0 ? '#b45309' : '#64748b' }}>
                          {item.cpa > 0 ? fmtUSDDec(item.cpa) : '$0.00'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>
                          {item.impressions.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>
                          {item.clicks.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>
                          {ctr}%
                        </td>
                        <td style={{ padding: '12px 24px', textAlign: 'right', color: '#64748b' }}>
                          ${Number(cpc).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e7ee' }}>
                    <td style={{ padding: '14px 24px', color: '#0f172a' }}>Blended Total</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#334155' }}>{fmtUSDDec(totalSpendUSD)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#334155' }}>{fmt(totalSpendBDT)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#10b981' }}>{fmt(totalStoreRevenue)}</td>
                    <td style={{ 
                      padding: '14px 16px', 
                      textAlign: 'right', 
                      color: blendedMER >= 4.0 ? '#10b981' : blendedMER >= 2.5 ? '#d97706' : '#ef4444' 
                    }}>
                      {blendedMER}x
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#8b5cf6' }}>
                      {hasOutlier ? (
                        <>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 500 }}>
                            {blendedRoasRaw}x
                          </div>
                          <div>{blendedRoasNormalized}x</div>
                        </>
                      ) : (
                        `${blendedRoasRaw}x`
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#334155' }}>{totalPurchases.toLocaleString()}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#334155' }}>{totalDeliveredOrders.toLocaleString()}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#ea580c' }}>{fmtUSDDec(blendedCPA)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#64748b' }}>{totalImpressions.toLocaleString()}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#64748b' }}>{totalClicks.toLocaleString()}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#64748b' }}>{blendedCTR}%</td>
                    <td style={{ padding: '14px 24px', textAlign: 'right', color: '#64748b' }}>
                      ${blendedCPC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Active Campaigns Panel */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Active Campaigns performance</h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                Creative performance of active ad campaign flows and budgets
              </p>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              {loadingCampaigns ? (
                <div style={{ padding: 40, textAlign: 'center', fontSize: '0.82rem', color: '#64748b' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                  Loading Campaign Breakdowns...
                </div>
              ) : campaigns.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', fontSize: '0.82rem', color: '#64748b' }}>
                  No campaign details available.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ padding: '12px 24px', color: '#475569', fontWeight: 700 }}>Campaign Name</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Spend</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Attributed Revenue</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>ROAS</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>CPA</th>
                      <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Impressions</th>
                      <th style={{ padding: '12px 24px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c, i) => (
                      <tr 
                        key={i} 
                        style={{ borderBottom: '1px solid #f1f5f9' }}
                        className="hover-row"
                      >
                        <td style={{ padding: '12px 24px', fontWeight: 700, color: '#0f172a' }}>{c.name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmtUSDDec(c.spend)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmtUSDDec(c.revenue)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#8b5cf6' }}>{c.roas}x</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#b45309' }}>{c.cpa > 0 ? fmtUSDDec(c.cpa) : '$0.00'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>{c.impressions.toLocaleString()}</td>
                        <td style={{ padding: '12px 24px', textAlign: 'right', color: '#64748b' }}>{c.clicks.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Dynamic Hover Styles */}
      <style jsx global>{`
        .hover-row:hover {
          background-color: #f8fafc !important;
        }
      `}</style>
    </div>
  );
};
