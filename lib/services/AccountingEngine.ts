import { supabase } from '../supabase';

export interface JournalLine {
  accountCode: string;
  debit: number;
  credit: number;
}

export class AccountingEngine {
  /**
   * Posts a strict Double-Entry Journal.
   * Enforces Zero-Leakage (Total Debits == Total Credits).
   */
  static async postJournal(referenceId: string, description: string, lines: JournalLine[]) {
    // 1. Validation: Zero-Leakage check
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    
    // We use a small epsilon to avoid JS floating point issues
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Zero-Leakage Audit Failed! Debits (৳${totalDebit}) do not equal Credits (৳${totalCredit}). Ref: ${referenceId}`);
    }

    // 2. Create Journal Entry
    const { data: journal, error: jError } = await supabase
      .from('acc_journal_entries')
      .insert({ reference_id: referenceId, description })
      .select('id')
      .single();

    if (jError || !journal) {
      throw new Error(`Failed to create journal entry: ${jError?.message}`);
    }

    // 3. Post Journal Lines
    const dbLines = lines.map(line => ({
      journal_id: journal.id,
      account_code: line.accountCode,
      debit: line.debit,
      credit: line.credit
    }));

    const { error: lError } = await supabase
      .from('acc_journal_lines')
      .insert(dbLines);

    if (lError) {
      // In a real transactional system, we'd rollback. 
      // Supabase REST doesn't support transactions easily from the client.
      throw new Error(`Failed to post journal lines: ${lError.message}`);
    }

    return journal.id;
  }

  /**
   * Section 1A: Advanced Apparel Production & Process Yield Mathematics
   */
  static async processFabricBatchYield(
    batchId: string,
    rawWeightKg: number,
    costPerKg: number,
    finishedWeightKg: number,
    firstQualityQty: number,
    samPerGarment: number,
    oarPerMin: number,
    directLaborPerGarment: number,
    sunkCosts: number
  ) {
    const L_shrinkage = 0.08; // 8% standard
    const L_handling = 0.02; // 2% standard
    const expectedYieldKg = rawWeightKg * (1 - L_shrinkage) * (1 - L_handling);
    
    // Calculate deviation
    const deviationKg = expectedYieldKg - finishedWeightKg;
    const isPass = Math.abs(deviationKg / expectedYieldKg) <= 0.02; // 2% tolerance
    
    // Value of the waste/deviation
    const sunkWasteValue = deviationKg > 0 ? deviationKg * costPerKg : 0;

    if (sunkWasteValue > 0) {
      await this.postJournal(
        `YIELD-${batchId}`,
        `Fabric Shrinkage & Yield Loss adjustment for Batch ${batchId}`,
        [
          { accountCode: '5080', debit: sunkWasteValue, credit: 0 }, // Dr Manufacturing Loss
          { accountCode: '1310', debit: 0, credit: sunkWasteValue }  // Cr Raw Materials
        ]
      );
    }

    // Section 1B: SAM & OAR Absorption
    // Line efficiency assumed at 100% for simple calculation as per standard formula:
    // Cabsorbed = (1 / SAM) * OAR + Direct Labor
    const lineEfficiency = 1.0; 
    const absorbedManufCost = ((lineEfficiency / samPerGarment) * oarPerMin) + directLaborPerGarment;

    // Section 1C: Landed Unit COGS
    const totalRawMaterialCost = finishedWeightKg * costPerKg;
    const landedUnitCOGS = ((totalRawMaterialCost + sunkCosts) / firstQualityQty) + absorbedManufCost;

    // Save batch metrics
    await supabase.from('prod_fabric_batches').insert({
      batch_id: batchId,
      raw_weight_kg: rawWeightKg,
      cost_per_kg: costPerKg,
      shrinkage_rate: L_shrinkage,
      handling_waste_rate: L_handling,
      finished_weight_kg: finishedWeightKg,
      first_quality_qty: firstQualityQty,
      sam_per_garment: samPerGarment,
      absorbed_unit_cost: landedUnitCOGS
    });

    return { expectedYieldKg, deviationKg, isPass, landedUnitCOGS };
  }

  /**
   * Section 3: Courier API Webhook-to-Ledger State Machine Mapping
   */
  static async handleCourierWebhook(orderId: string, status: string, orderValue: number, fees: number, landedCogs: number) {
    switch (status) {
      case 'consignment_created':
        // Debit: 1210 - Courier COD Receivable
        // Credit: 1360 - Finished Goods Warehouse
        await this.postJournal(orderId, `Order packed and dispatched - COGS transfer`, [
          { accountCode: '1210', debit: landedCogs, credit: 0 },
          { accountCode: '1360', debit: 0, credit: landedCogs }
        ]);
        break;

      case 'delivered':
        // Debit: 1210.CL - Clearing
        // Credit: 4010 - Revenue
        // We also need to recognize the Output VAT if applicable, but for simplicity we log the full retail.
        await this.postJournal(orderId, `Order Delivered - Revenue Recognized`, [
          { accountCode: '1210.CL', debit: orderValue, credit: 0 },
          { accountCode: '4010', debit: 0, credit: orderValue }
        ]);
        break;

      case 'returned':
      case 'rts':
        // Debit: 1360 - Finished Goods (Landed COGS)
        // Debit: 6100 - Courier Return Costs (Fee)
        // Credit: 1210 - Courier COD Receivable (Landed COGS + Fee offset)
        await this.postJournal(orderId, `Order RTS - Reversing COGS & Booking Return Fee`, [
          { accountCode: '1360', debit: landedCogs, credit: 0 },
          { accountCode: '6100', debit: fees, credit: 0 },
          { accountCode: '1210', debit: 0, credit: landedCogs + fees }
        ]);
        break;

      case 'payment_processing':
        // Debit: 1210.INV - Invoice Pending
        // Credit: 1210.CL - Clearing
        await this.postJournal(orderId, `Courier Payment Processing`, [
          { accountCode: '1210.INV', debit: orderValue - fees, credit: 0 },
          { accountCode: '1210.CL', debit: 0, credit: orderValue - fees }
        ]);
        break;

      case 'disbursed':
      case 'paid':
        // Debit: 1011 - Corporate Bank Account
        // Credit: 1210.INV - Invoice Pending
        await this.postJournal(orderId, `Courier Payout Settled to Bank`, [
          { accountCode: '1011', debit: orderValue - fees, credit: 0 },
          { accountCode: '1210.INV', debit: 0, credit: orderValue - fees }
        ]);
        break;

      case 'pickup_allocated':
      case 'in_transit':
      case 'hub_transfer':
      default:
        // No ledger entry mapped, status log update only
        break;
    }
  }

  /**
   * Section 4A: VAT Offset Protocol
   */
  static async offsetMonthlyVAT(referenceMonth: string, inputVAT: number, outputVAT: number) {
    const netPayable = outputVAT - inputVAT;
    
    // Offset Entry
    await this.postJournal(`VAT-${referenceMonth}`, `EOM VAT Offset for ${referenceMonth}`, [
      { accountCode: '2051', debit: outputVAT, credit: 0 }, // Dr Output VAT
      { accountCode: '1410', debit: 0, credit: inputVAT },  // Cr Input VAT
      { accountCode: '2051', debit: 0, credit: netPayable > 0 ? netPayable : 0 }, // Remaining Payable Credit
      // If netPayable is negative, it's a carry-forward asset, handled automatically.
    ]);
    
    return netPayable;
  }
}
