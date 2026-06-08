import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { fixed_cost_id, month, amount } = await req.json();
  if (!fixed_cost_id || !month) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const { data, error } = await supabase
    .from('fin_fixed_cost_months')
    .upsert({ fixed_cost_id, month, amount: Number(amount) }, { onConflict: 'fixed_cost_id,month' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ override: data });
}

export async function DELETE(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const fixed_cost_id = p.get('fixed_cost_id');
  const month = p.get('month');
  if (!fixed_cost_id || !month) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const { error } = await supabase
    .from('fin_fixed_cost_months')
    .delete()
    .eq('fixed_cost_id', fixed_cost_id)
    .eq('month', month);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
