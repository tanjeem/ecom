'use client';

import React from 'react';
import { Panel } from '@/components/Common/Panel';
import { useAdsData } from '@/lib/hooks/useData';

export const AdsView: React.FC = () => {
  const ads = useAdsData();

  const getActionLabel = (roas: number) => {
    if (roas >= 4) return '📈 Scale';
    if (roas >= 2.5) return '⏸️ Pause';
    return '❌ Stop';
  };

  const getCreativeStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      hot: '✓ High engagement | 🔥 Hot performer',
      testing: '↗️ Testing | Average performance',
      declining: '📉 Declining | Consider refreshing',
    };
    return statusMap[status] || status;
  };

  return (
    <section className="view" id="ads-view" data-title="Meta Ads">
      <div className="module-toolbar">
        <div className="segmented-control">
          <button className="is-selected" type="button">
            Campaigns
          </button>
          <button type="button">Creatives</button>
          <button type="button">Audiences</button>
        </div>
        <button className="primary-action" type="button">
          🚀 Scale Winners
        </button>
      </div>

      <div className="content-grid">
        <Panel
          title="Campaign Performance"
          subtitle="Budget, ROAS, CPA, revenue, and inventory risk."
          className="wide-panel"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Spend</th>
                  <th>Revenue</th>
                  <th>ROAS</th>
                  <th>CPA</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="ads-table">
                {ads.campaigns.map((campaign: any) => (
                  <tr key={campaign.name}>
                    <td>{campaign.name}</td>
                    <td>${campaign.spend.toLocaleString()}</td>
                    <td>${campaign.revenue.toLocaleString()}</td>
                    <td>{campaign.roas}x</td>
                    <td>${campaign.cpa.toFixed(2)}</td>
                    <td>{getActionLabel(campaign.roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Creative Library"
          subtitle="Winning looks and fatigue signals."
        >
          <div className="creative-list" id="creative-list">
            <div style={{ padding: '1rem' }}>
              {ads.creatives.map((creative: any, idx: number) => (
                <div
                  key={`${creative.name}-${idx}`}
                  style={{
                    marginBottom: idx === ads.creatives.length - 1 ? 0 : '1.5rem',
                    paddingBottom: idx === ads.creatives.length - 1 ? 0 : '1rem',
                    borderBottom: idx === ads.creatives.length - 1 ? 'none' : '1px solid #e0e0e0',
                  }}
                >
                  <strong>{creative.name}</strong>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                    Impressions: {(creative.impressions / 1000).toFixed(1)}K | CPM: ${creative.cpm.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                    {getCreativeStatus(creative.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
};
