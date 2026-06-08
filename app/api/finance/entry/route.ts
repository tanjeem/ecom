import { NextRequest, NextResponse } from 'next/server';
import { AccountingEngine } from '@/lib/services/AccountingEngine';

export async function POST(req: NextRequest) {
  try {
    const { type, payload } = await req.json();

    if (type === 'batch') {
      await AccountingEngine.processFabricBatchYield(
        payload.batchId,
        Number(payload.rawWeightKg),
        Number(payload.costPerKg),
        Number(payload.finishedWeightKg),
        Number(payload.firstQualityQty),
        Number(payload.samPerGarment),
        Number(payload.oarPerMin),
        Number(payload.directLaborPerGarment),
        Number(payload.sunkCosts)
      );
      return NextResponse.json({ success: true, message: 'Batch processed successfully.' });
    }

    if (type === 'journal') {
      await AccountingEngine.postJournal(payload.referenceId, payload.description, [
        { accountCode: payload.debitAccount, debit: Number(payload.amount), credit: 0 },
        { accountCode: payload.creditAccount, debit: 0, credit: Number(payload.amount) }
      ]);
      return NextResponse.json({ success: true, message: 'Journal posted successfully.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid entry type' }, { status: 400 });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
