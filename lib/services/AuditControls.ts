import { supabase } from '../supabase';
import { AccountingEngine } from './AccountingEngine';

export class AuditControls {
  
  /**
   * Control B: B2B Wholesaler Credit Aging Audit
   * Analyzes aging buckets and automatically provides a 1% bad debt write-off for outstanding balances.
   */
  static async runB2BWholesalerAgingAudit() {
    const { data: clients, error } = await supabase.from('acc_wholesale_aging').select('*');
    if (error) throw new Error('Failed to fetch wholesale aging data');

    let totalPastDue = 0;
    
    for (const client of clients) {
      const pastDue = Number(client.balance_31_60) + Number(client.balance_61_90) + Number(client.balance_90_plus);
      
      // Auto-suspend rule
      if (pastDue > 0 && client.status !== 'SUSPENDED') {
        await supabase.from('acc_wholesale_aging').update({ status: 'SUSPENDED' }).eq('client_id', client.client_id);
      } else if (pastDue === 0 && client.status === 'SUSPENDED') {
        await supabase.from('acc_wholesale_aging').update({ status: 'ACTIVE' }).eq('client_id', client.client_id);
      }

      totalPastDue += pastDue;
    }

    // Write-off provision (1% of past due as a simplified placeholder for 1% of total sales logic)
    const provisionAmount = totalPastDue * 0.01;
    if (provisionAmount > 0) {
      await AccountingEngine.postJournal(
        `AGING-PROVISION-${new Date().toISOString().split('T')[0]}`,
        'Monthly Bad Debt Provision (1%)',
        [
          { accountCode: '6400', debit: provisionAmount, credit: 0 },
          { accountCode: '1220', debit: 0, credit: provisionAmount } // 1220 Allowance
        ]
      );
    }

    return { suspendedCount: clients.filter(c => Number(c.balance_31_60) + Number(c.balance_61_90) + Number(c.balance_90_plus) > 0).length, provisionAmount };
  }

  /**
   * Control C: Weekly Cash Flow & Liquidity Runway Forecast
   */
  static generateWeeklyCashflowForecast(startingCash: number, expectedCourierPayouts: number, scheduledVendorPayments: number, fixedOPEX: number) {
    const forecast = [];
    let currentCash = startingCash;

    for (let i = 1; i <= 4; i++) {
      currentCash = currentCash + expectedCourierPayouts - scheduledVendorPayments - fixedOPEX;
      forecast.push({
        week: i,
        projectedEndingCash: currentCash
      });
    }

    return forecast;
  }
}
