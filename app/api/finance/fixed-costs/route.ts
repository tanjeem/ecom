import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const [costsRes, overridesRes] = await Promise.all([
    supabase.from('fin_fixed_costs').select('*').order('sort_order').order('created_at'),
    supabase.from('fin_fixed_cost_months').select('*'),
  ]);
  if (costsRes.error) return NextResponse.json({ error: costsRes.error.message }, { status: 500 });
  return NextResponse.json({ costs: costsRes.data || [], overrides: overridesRes.data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, label, category, default_amount, sort_order } = body;

  if (id) {
    const { data, error } = await supabase
      .from('fin_fixed_costs')
      .update({ label, category, default_amount: Number(default_amount) })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cost: data });
  }

  const { data, error } = await supabase
    .from('fin_fixed_costs')
    .insert({ label, category, default_amount: Number(default_amount) || 0, sort_order: sort_order || 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cost: data });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await supabase.from('fin_fixed_costs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
