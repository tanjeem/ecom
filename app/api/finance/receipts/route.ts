import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin, RECEIPTS_BUCKET, ensureReceiptsBucket } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);

/** Upload a receipt for a transaction. multipart/form-data: transaction_id, file. Replaces any existing receipt. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const id = String(form.get('transaction_id') || '');
    const file = form.get('file');
    if (!id || !(file instanceof File)) return NextResponse.json({ error: 'transaction_id and file required' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is larger than 4 MB' }, { status: 413 });
    if (!TYPES.has(file.type)) return NextResponse.json({ error: 'Use a JPG, PNG, WebP, HEIC or PDF' }, { status: 415 });

    const { data: tx, error: txErr } = await supabase.from('fin_transactions').select('id, receipt_path').eq('id', id).single();
    if (txErr || !tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    await ensureReceiptsBucket();
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const path = `${id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from(RECEIPTS_BUCKET).upload(path, file, { contentType: file.type });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { error } = await supabase.from('fin_transactions').update({ receipt_path: path }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (tx.receipt_path) await supabaseAdmin.storage.from(RECEIPTS_BUCKET).remove([tx.receipt_path]);
    return NextResponse.json({ ok: true, receipt_path: path });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}

/** Redirects to a short-lived signed link for a transaction's receipt. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { data: tx } = await supabase.from('fin_transactions').select('receipt_path').eq('id', id).single();
  if (!tx?.receipt_path) return NextResponse.json({ error: 'No receipt' }, { status: 404 });
  const { data, error } = await supabaseAdmin.storage.from(RECEIPTS_BUCKET).createSignedUrl(tx.receipt_path, 120);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not sign link' }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { data: tx } = await supabase.from('fin_transactions').select('receipt_path').eq('id', id).single();
  if (tx?.receipt_path) await supabaseAdmin.storage.from(RECEIPTS_BUCKET).remove([tx.receipt_path]);
  const { error } = await supabase.from('fin_transactions').update({ receipt_path: null }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
