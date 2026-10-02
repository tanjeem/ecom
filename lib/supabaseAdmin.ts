import { createClient } from '@supabase/supabase-js';

// Service-role client for server-only work the anon key can't do (storage).
// Never import this from a client component.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
  { auth: { persistSession: false } },
);

export const RECEIPTS_BUCKET = 'receipts';

let bucketReady: Promise<void> | null = null;

/** Creates the private receipts bucket the first time it's needed. */
export function ensureReceiptsBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data } = await supabaseAdmin.storage.getBucket(RECEIPTS_BUCKET);
      if (data) return;
      const { error } = await supabaseAdmin.storage.createBucket(RECEIPTS_BUCKET, {
        public: false,
        fileSizeLimit: 4 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
      });
      if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
    })().catch(e => { bucketReady = null; throw e; });
  }
  return bucketReady;
}
