import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const [vendorsRes, fabricRes, accessoryRes] = await Promise.all([
    supabase.from('fin_vendors').select('*').eq('is_active', true).order('name'),
    supabase.from('fin_fabric_purchases').select('vendor_id, total_cost, amount_paid'),
    supabase.from('fin_accessory_purchases').select('vendor_id, total_cost, amount_paid'),
  ]);

  if (vendorsRes.error) return NextResponse.json({ error: vendorsRes.error.message }, { status: 500 });

  const allPurchases = [
    ...(fabricRes.data || []),
    ...(accessoryRes.data || []),
  ];

  const vendors = (vendorsRes.data || []).map((v: any) => {
    const purchases = allPurchases.filter((p: any) => p.vendor_id === v.id);
    const total_purchased = purchases.reduce((s: number, p: any) => s + Number(p.total_cost), 0);
    const total_paid = purchases.reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
    return { ...v, total_purchased, total_paid, balance_due: total_purchased - total_paid };
  });

  return NextResponse.json({ vendors });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, phone, bank_details, notes } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });

    const { data, error } = await supabase
      .from('fin_vendors')
      .insert({ name: name.trim(), category: category || 'other', phone, bank_details, notes })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vendor: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data, error } = await supabase
      .from('fin_vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vendor: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
