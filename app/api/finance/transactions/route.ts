import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const category = searchParams.get('category');
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

  let query = supabase
    .from('fin_transactions')
    .select('*, fin_vendors(name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);
  if (category) query = query.eq('category', category);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const transactions = (data || []).map((t: any) => ({
    ...t,
    vendor_name: t.fin_vendors?.name ?? null,
    fin_vendors: undefined,
  }));

  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, type, category, description, amount, payment_method, vendor_id, reference_no, notes } = body;

    if (!date || !type || !category || !description || !amount) {
      return NextResponse.json({ error: 'Missing required fields: date, type, category, description, amount' }, { status: 400 });
    }
    if (!['income', 'expense', 'transfer'].includes(type)) {
      return NextResponse.json({ error: 'type must be income, expense, or transfer' }, { status: 400 });
    }
    if (Number(amount) <= 0) {
      return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('fin_transactions')
      .insert({
        date,
        type,
        category,
        description,
        amount: Number(amount),
        payment_method: payment_method || 'Cash',
        vendor_id: vendor_id || null,
        reference_no: reference_no || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transaction: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('fin_transactions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
