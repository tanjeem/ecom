import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { AccountingEngine } from '@/lib/services/AccountingEngine';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'lib/data/finance_ledger.json');
    const ledger = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    let migratedJournals = 0;

    // 1. Migrate Payouts (Assuming Supplier Payments: Dr 2010 AP, Cr 1011 Bank)
    for (const p of ledger.payouts || []) {
      await AccountingEngine.postJournal(p.id, `Legacy Payout: ${p.product} - ${p.comments}`, [
        { accountCode: '2010', debit: p.amount, credit: 0 },
        { accountCode: '1011', debit: 0, credit: p.amount }
      ]);
      migratedJournals++;
    }

    // 2. Migrate Ad Spend (Dr 6000 OPEX, Cr 1011 Bank)
    // We don't have a 6000 code specifically for ads seeded yet, let's just use a general expense or add one?
    // Let's add '6200' for Meta Ads Expense dynamically or just map it.
    // I'll ensure 6200 exists first.
    await supabase.from('acc_accounts').upsert({ account_code: '6200', account_name: 'Meta Ads Expense', account_type: 'EXPENSE' });

    for (const a of ledger.adSpend || []) {
      await AccountingEngine.postJournal(a.id, `Legacy Ad Spend: ${a.comments}`, [
        { accountCode: '6200', debit: a.amountBDT, credit: 0 },
        { accountCode: '1011', debit: 0, credit: a.amountBDT }
      ]);
      migratedJournals++;
    }

    // 3. Migrate MSC Shoot (Dr 6300 Shoot Expense, Cr 1011 Bank)
    await supabase.from('acc_accounts').upsert({ account_code: '6300', account_name: 'Shoot & Production Expense', account_type: 'EXPENSE' });
    for (const m of ledger.mscShoot || []) {
      await AccountingEngine.postJournal(m.id, `Legacy Shoot: ${m.item}`, [
        { accountCode: '6300', debit: m.cost, credit: 0 },
        { accountCode: '1011', debit: 0, credit: m.cost }
      ]);
      migratedJournals++;
    }

    // 4. Migrate Funding (Cr Equity 3000, Dr 1011 Bank)
    await supabase.from('acc_accounts').upsert({ account_code: '3000', account_name: 'Owner Equity', account_type: 'EQUITY' });
    for (const f of ledger.funding || []) {
      await AccountingEngine.postJournal(f.id, `Legacy Funding: ${f.from} - ${f.details}`, [
        { accountCode: '1011', debit: f.amount, credit: 0 },
        { accountCode: '3000', debit: 0, credit: f.amount }
      ]);
      migratedJournals++;
    }

    // 5. Migrate Manufacturing Details into `prod_fabric_batches`
    // The JSON doesn't perfectly match the Yield math (it has fabricCost, not rawWeightKg)
    // We will reverse engineer a mock weight. (Assume 1000 BDT/kg)
    for (const m of ledger.manufacturingDetails || []) {
      const mockWeight = m.fabricCost / 1000;
      await AccountingEngine.processFabricBatchYield(
        `BATCH-${m.id}`,
        mockWeight,
        1000,
        mockWeight * 0.9, // mock 10% shrinkage
        m.qty,
        15, // mock SAM
        20, // mock OAR
        m.manufCostPerUnit,
        m.accessoriesCost
      );
    }

    return NextResponse.json({ success: true, message: `Migrated ${migratedJournals} journals and ${ledger.manufacturingDetails?.length || 0} batches.` });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
