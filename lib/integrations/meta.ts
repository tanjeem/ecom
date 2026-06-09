import { hasEnv } from './env';

export interface MetaCampaign {
  name: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  impressions: number;
  clicks: number;
}

export interface MetaAdsData {
  campaigns: MetaCampaign[];
  creatives: any[];
}

const GRAPH_API_VERSION = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Format Next.js period to Meta's date_preset or custom time_range
 */
function getMetaTimeParams(period: string, from?: string, to?: string) {
  const params: Record<string, string> = {};

  if (period === 'custom' && from) {
    // Meta requires format: time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
    const end = to || from;
    params.time_range = JSON.stringify({ since: from, until: end });
  } else {
    // Map periods to Meta date presets
    const presets: Record<string, string> = {
      today: 'today',
      week: 'last_7d',
      month: 'this_month',
      year: 'this_year',
      all: 'lifetime',
    };
    params.date_preset = presets[period] || 'this_month';
  }

  return params;
}

export async function fetchMetaCampaignInsights(
  period: string,
  from?: string,
  to?: string
): Promise<MetaAdsData> {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;

  if (!accountId || !accessToken) {
    console.warn('Meta Ads credentials missing, returning mock data.');
    return getMockAdsData();
  }

  try {
    // Clean account id (ensure act_ prefix)
    const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const timeParams = getMetaTimeParams(period, from, to);

    const query = new URLSearchParams({
      level: 'campaign',
      fields: 'campaign_name,spend,impressions,clicks,purchase_roas,actions,action_values',
      access_token: accessToken,
      limit: '100',
      ...timeParams,
    });

    const url = `${BASE_URL}/${formattedId}/insights?${query.toString()}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        `Meta Graph API failed: ${res.status} - ${JSON.stringify(errBody)}`
      );
    }

    const json = await res.json();
    const data = json.data || [];

    const campaigns: MetaCampaign[] = data.map((item: any) => {
      const name = item.campaign_name || 'Unnamed Campaign';
      const spend = parseFloat(item.spend || '0');
      const impressions = parseInt(item.impressions || '0');
      const clicks = parseInt(item.clicks || '0');

      // Extract Purchase ROAS
      const roasItem = item.purchase_roas?.find(
        (r: any) =>
          r.action_type === 'purchase' ||
          r.action_type === 'offsite_conversion.fb_pixel_purchase'
      );
      const roas = roasItem ? parseFloat(roasItem.value) : 0;

      // Extract Purchase Value (Revenue)
      const valItem = item.action_values?.find(
        (v: any) =>
          v.action_type === 'purchase' ||
          v.action_type === 'offsite_conversion.fb_pixel_purchase'
      );
      let revenue = valItem ? parseFloat(valItem.value) : spend * roas;

      // Ensure sanity in calculated revenue (if roas > 0 and revenue is 0)
      if (revenue === 0 && roas > 0) {
        revenue = spend * roas;
      }

      // Extract conversions for CPA
      const actionItem = item.actions?.find(
        (a: any) =>
          a.action_type === 'purchase' ||
          a.action_type === 'offsite_conversion.fb_pixel_purchase'
      );
      const conversions = actionItem ? parseInt(actionItem.value) : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      return {
        name,
        spend,
        revenue,
        roas,
        cpa,
        impressions,
        clicks,
      };
    });

    return {
      campaigns,
      creatives: getFallbackCreatives(),
    };
  } catch (error) {
    console.error('Failed to fetch Meta campaign insights:', error);
    return getMockAdsData();
  }
}

function getFallbackCreatives() {
  return [
    {
      name: 'Mirror fit check (Video ad)',
      impressions: 45200,
      cpm: 0.89,
      status: 'hot',
    },
    {
      name: 'Flat lay - New collection (Image ad)',
      impressions: 32100,
      cpm: 1.05,
      status: 'testing',
    },
    {
      name: 'Product demo - 15s (Reel)',
      impressions: 18500,
      cpm: 1.34,
      status: 'declining',
    },
  ];
}

function getMockAdsData(): MetaAdsData {
  return {
    campaigns: [
      {
        name: 'Summer Collection Launch [Mock]',
        spend: 5240,
        revenue: 21850,
        roas: 4.17,
        cpa: 18.5,
        impressions: 589000,
        clicks: 12400,
      },
      {
        name: 'Spring Clearance [Mock]',
        spend: 3120,
        revenue: 9360,
        roas: 3.0,
        cpa: 22.1,
        impressions: 341000,
        clicks: 8900,
      },
      {
        name: 'Brand Awareness Test [Mock]',
        spend: 2100,
        revenue: 4200,
        roas: 2.0,
        cpa: 42.0,
        impressions: 215000,
        clicks: 5600,
      },
    ],
    creatives: getFallbackCreatives(),
  };
}

export interface MetaMonthlyMetric {
  month: string;
  label: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  purchases: number;
  impressions: number;
  clicks: number;
}

function getMockMonthlyAdsData(): MetaMonthlyMetric[] {
  const months: MetaMonthlyMetric[] = [];
  const now = new Date();
  
  const startDate = new Date(2025, 0, 1);
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  
  while (current <= now) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const label = current.toLocaleString('default', { month: 'short' });
    
    // Vary spend and performance logically for mock consistency
    const monthIndex = current.getMonth();
    const baseSpend = 30000 + (monthIndex % 4) * 8000 + Math.sin(monthIndex) * 5000;
    const spend = Math.round(baseSpend);
    const roas = parseFloat((2.1 + (monthIndex % 3) * 0.4 + Math.cos(monthIndex) * 0.3).toFixed(2));
    const revenue = Math.round(spend * roas);
    const purchases = Math.round(revenue / 1500); // 1500 BDT average order size
    const cpa = purchases > 0 ? parseFloat((spend / purchases).toFixed(2)) : 0;
    const clicks = Math.round(spend / 10); // 10 BDT CPC
    const impressions = clicks * 40; // 2.5% CTR
    
    months.push({
      month: monthKey,
      label,
      spend,
      revenue,
      roas,
      cpa,
      purchases,
      impressions,
      clicks,
    });
    
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

export async function fetchMetaMonthlyInsights(): Promise<MetaMonthlyMetric[]> {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;

  if (!accountId || !accessToken) {
    console.warn('Meta Ads credentials missing, returning mock monthly data.');
    return getMockMonthlyAdsData();
  }

  try {
    const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const now = new Date();
    // Fetch since Jan 1, 2025
    const sinceDate = new Date(2025, 0, 1);
    const since = sinceDate.toISOString().slice(0, 10);
    const until = now.toISOString().slice(0, 10);
    const time_range = JSON.stringify({ since, until });

    const query = new URLSearchParams({
      level: 'account',
      fields: 'spend,impressions,clicks,purchase_roas,actions,action_values,date_start,date_stop',
      time_range,
      time_increment: 'monthly',
      access_token: accessToken,
      limit: '100',
    });

    const url = `${BASE_URL}/${formattedId}/insights?${query.toString()}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        `Meta Graph API failed: ${res.status} - ${JSON.stringify(errBody)}`
      );
    }

    const json = await res.json();
    const data = json.data || [];

    const monthsData: MetaMonthlyMetric[] = data.map((item: any) => {
      const month = item.date_start.slice(0, 7); // YYYY-MM
      const d = new Date(item.date_start + 'T12:00:00'); // avoid timezone shifts
      const label = d.toLocaleString('default', { month: 'short' });
      
      const spend = parseFloat(item.spend || '0');
      const impressions = parseInt(item.impressions || '0');
      const clicks = parseInt(item.clicks || '0');

      // Extract Purchase Value (Revenue)
      const valItem = item.action_values?.find(
        (v: any) =>
          v.action_type === 'purchase' ||
          v.action_type === 'offsite_conversion.fb_pixel_purchase'
      );
      const revenue = valItem ? parseFloat(valItem.value) : 0;

      // Extract conversions for Purchases
      const actionItem = item.actions?.find(
        (a: any) =>
          a.action_type === 'purchase' ||
          a.action_type === 'offsite_conversion.fb_pixel_purchase'
      );
      const purchases = actionItem ? parseInt(actionItem.value) : 0;

      const roas = spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0;
      const cpa = purchases > 0 ? parseFloat((spend / purchases).toFixed(2)) : 0;

      return {
        month,
        label,
        spend,
        revenue,
        roas,
        cpa,
        purchases,
        impressions,
        clicks,
      };
    });

    // Sort ascending, but also fill missing months
    const completeMonths: MetaMonthlyMetric[] = [];
    const startDate = new Date(2025, 0, 1);
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (current <= now) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      const label = current.toLocaleString('default', { month: 'short' });
      
      const existing = monthsData.find((m) => m.month === monthKey);
      if (existing) {
        completeMonths.push(existing);
      } else {
        completeMonths.push({
          month: monthKey,
          label,
          spend: 0,
          revenue: 0,
          roas: 0,
          cpa: 0,
          purchases: 0,
          impressions: 0,
          clicks: 0,
        });
      }
      current.setMonth(current.getMonth() + 1);
    }

    return completeMonths;
  } catch (error) {
    console.error('Failed to fetch Meta monthly insights:', error);
    return getMockMonthlyAdsData();
  }
}
