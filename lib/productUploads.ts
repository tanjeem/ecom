// Product photos on their way into WooCommerce. WooCommerce can only import an
// image from a URL, so the browser uploads each photo here (Supabase Storage,
// public bucket) and WordPress copies it into its Media Library when the product
// is created. The copies here are deleted afterwards.
import { createClient } from '@supabase/supabase-js';

export const UPLOAD_BUCKET = 'product-uploads';

const admin = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
};

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const s = admin();
  const { data } = await s.storage.getBucket(UPLOAD_BUCKET);
  if (!data) {
    const { error } = await s.storage.createBucket(UPLOAD_BUCKET, { public: true, fileSizeLimit: '15MB', allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
    if (error && !/exists/i.test(error.message)) throw new Error(error.message);
  }
  bucketReady = true;
}

/** A one-off URL the browser can upload one photo to, plus the public URL it will have. */
export async function signPhotoUpload(fileName: string) {
  await ensureBucket();
  const ext = (fileName.match(/\.(jpe?g|png|webp)$/i)?.[1] || 'jpg').toLowerCase();
  const stem = fileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'photo';
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now().toString(36)}-${stem}.${ext}`;
  const s = admin();
  const { data, error } = await s.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message || 'Could not prepare the upload');
  return { path, token: data.token, publicUrl: s.storage.from(UPLOAD_BUCKET).getPublicUrl(path).data.publicUrl };
}

/** True for a URL that points into the upload bucket (only those are accepted as product photos). */
export const isUploadUrl = (url: string) =>
  url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${UPLOAD_BUCKET}/`);

export async function deletePhotoUploads(urls: string[]) {
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${UPLOAD_BUCKET}/`;
  const paths = urls.filter(u => u.startsWith(prefix)).map(u => u.slice(prefix.length));
  if (paths.length) await admin().storage.from(UPLOAD_BUCKET).remove(paths).catch(() => {});
}
