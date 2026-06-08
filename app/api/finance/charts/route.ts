import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
  const to   = now.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('fin_transactions')
    .select('date, type, category, amount')
    .gte('date', from)
    .lte('date', to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Bucket = { month: string; label: string; total_expense: number; [cat: string]: any };
  const buckets: Record<string, Bucket> = {};

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = { month: key, label: d.toLocaleString('default', { month: 'short' }), total_expense: 0 };
  }

  for (const tx of data || []) {
    const key = tx.date.slice(0, 7);
    if (!buckets[key] || tx.type !== 'expense') continue;
    const amount = Number(tx.amount);
    buckets[key].total_expense += amount;
    buckets[key][tx.category] = (buckets[key][tx.category] || 0) + amount;
  }

  return NextResponse.json({ months: Object.values(buckets) });
}
