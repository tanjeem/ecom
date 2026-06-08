import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'fabric';

  if (type === 'fabric') {
    const { data, error } = await supabase
      .from('fin_fabric_purchases')
      .select('*, fin_vendors(name)')
      .order('date', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      items: (data || []).map((d: any) => ({
        ...d,
        vendor_name: d.fin_vendors?.name ?? null,
        balance_due: Number(d.total_cost) - Number(d.amount_paid),
        fin_vendors: undefined,
      })),
    });
  }

  if (type === 'accessories') {
    const { data, error } = await supabase
      .from('fin_accessory_purchases')
      .select('*, fin_vendors(name)')
      .order('date', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      items: (data || []).map((d: any) => ({
        ...d,
        vendor_name: d.fin_vendors?.name ?? null,
        balance_due: Number(d.total_cost) - Number(d.amount_paid),
        fin_vendors: undefined,
      })),
    });
  }

  if (type === 'production') {
    const { data, error } = await supabase
      .from('fin_production_batches')
      .select('*')
      .order('date', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  }

  return NextResponse.json({ error: 'Invalid type. Use fabric, accessories, or production.' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();
    const today = new Date().toISOString().slice(0, 10);

    if (action === 'addFabric') {
      const { date, vendor_id, fabric_type, quantity, unit, unit_price, total_cost, amount_paid, payment_method, status, notes } = payload;
      if (!fabric_type || !quantity || !unit_price || !total_cost) {
        return NextResponse.json({ error: 'fabric_type, quantity, unit_price, total_cost required' }, { status: 400 });
      }

      let transactionId: string | null = null;
      const paid = Number(amount_paid) || 0;
      if (paid > 0) {
        const { data: tx } = await supabase
          .from('fin_transactions')
          .insert({
            date: date || today,
            type: 'expense',
            category: 'fabric',
            description: `Fabric: ${fabric_type}`,
            amount: paid,
            payment_method: payment_method || 'Cash',
            vendor_id: vendor_id || null,
          })
          .select('id')
          .single();
        transactionId = tx?.id ?? null;
      }

      const { data, error } = await supabase
        .from('fin_fabric_purchases')
        .insert({
          transaction_id: transactionId,
          vendor_id: vendor_id || null,
          date: date || today,
          fabric_type,
          quantity: Number(quantity),
          unit: unit || 'yards',
          unit_price: Number(unit_price),
          total_cost: Number(total_cost),
          amount_paid: paid,
          status: status || 'Received',
          notes: notes || null,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data }, { status: 201 });
    }

    if (action === 'addAccessory') {
      const { date, vendor_id, item, quantity, unit, unit_price, total_cost, amount_paid, payment_method, notes } = payload;
      if (!item || !quantity || !total_cost) {
        return NextResponse.json({ error: 'item, quantity, total_cost required' }, { status: 400 });
      }

      let transactionId: string | null = null;
      const paid = Number(amount_paid) || 0;
      if (paid > 0) {
        const { data: tx } = await supabase
          .from('fin_transactions')
          .insert({
            date: date || today,
            type: 'expense',
            category: 'accessories',
            description: `Accessories: ${item}`,
            amount: paid,
            payment_method: payment_method || 'Cash',
            vendor_id: vendor_id || null,
          })
          .select('id')
          .single();
        transactionId = tx?.id ?? null;
      }

      const { data, error } = await supabase
        .from('fin_accessory_purchases')
        .insert({
          transaction_id: transactionId,
          vendor_id: vendor_id || null,
          date: date || today,
          item,
          quantity: Number(quantity),
          unit: unit || 'pcs',
          unit_price: unit_price ? Number(unit_price) : null,
          total_cost: Number(total_cost),
          amount_paid: paid,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data }, { status: 201 });
    }

    if (action === 'addProduction') {
      const { date, batch_code, product_type, target_quantity, factory, estimated_sewing_cost, notes } = payload;
      if (!product_type || !target_quantity) {
        return NextResponse.json({ error: 'product_type and target_quantity required' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('fin_production_batches')
        .insert({
          date: date || today,
          batch_code: batch_code || `B-${Date.now().toString(36).toUpperCase()}`,
          product_type,
          target_quantity: Number(target_quantity),
          factory: factory || null,
          estimated_sewing_cost: estimated_sewing_cost ? Number(estimated_sewing_cost) : null,
          status: 'In Progress',
          notes: notes || null,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data }, { status: 201 });
    }

    if (action === 'recordPayment') {
      const { id, purchase_type, new_paid_amount, payment_method } = payload;
      if (!id || !purchase_type || new_paid_amount == null) {
        return NextResponse.json({ error: 'id, purchase_type, new_paid_amount required' }, { status: 400 });
      }
      const table = purchase_type === 'fabric' ? 'fin_fabric_purchases' : 'fin_accessory_purchases';

      const { data: current, error: fetchErr } = await supabase
        .from(table)
        .select('total_cost, amount_paid, vendor_id, fabric_type, item')
        .eq('id', id)
        .single();

      if (fetchErr || !current) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

      const additionalPayment = Number(new_paid_amount) - Number(current.amount_paid);
      if (additionalPayment > 0) {
        const desc = purchase_type === 'fabric'
          ? `Payment: fabric (${(current as any).fabric_type})`
          : `Payment: accessories (${(current as any).item})`;
        await supabase.from('fin_transactions').insert({
          date: today,
          type: 'expense',
          category: purchase_type === 'fabric' ? 'fabric' : 'accessories',
          description: desc,
          amount: additionalPayment,
          payment_method: payment_method || 'Cash',
          vendor_id: (current as any).vendor_id || null,
        });
      }

      const { error: updateErr } = await supabase
        .from(table)
        .update({ amount_paid: Number(new_paid_amount) })
        .eq('id', id);

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'completeProduction') {
      const { id, completed_quantity, actual_sewing_cost, completion_date, payment_method } = payload;
      if (!id || !completed_quantity) {
        return NextResponse.json({ error: 'id and completed_quantity required' }, { status: 400 });
      }

      if (actual_sewing_cost && Number(actual_sewing_cost) > 0) {
        const { data: batch } = await supabase
          .from('fin_production_batches')
          .select('product_type, factory')
          .eq('id', id)
          .single();

        await supabase.from('fin_transactions').insert({
          date: completion_date || today,
          type: 'expense',
          category: 'sewing',
          description: `Sewing: ${batch?.product_type || 'production batch'}`,
          amount: Number(actual_sewing_cost),
          payment_method: payment_method || 'Bank Transfer',
        });
      }

      const { error } = await supabase
        .from('fin_production_batches')
        .update({
          status: 'Completed',
          completed_quantity: Number(completed_quantity),
          actual_sewing_cost: actual_sewing_cost ? Number(actual_sewing_cost) : null,
          completion_date: completion_date || today,
        })
        .eq('id', id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
