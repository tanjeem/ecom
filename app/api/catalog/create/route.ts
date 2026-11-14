import { NextRequest, NextResponse } from 'next/server';
import { createWooProduct, getWooCatalog, type NewProductInput } from '@/lib/integrations/woocommerce';
import { deletePhotoUploads, isUploadUrl } from '@/lib/productUploads';
import { invalidateStockSnapshot } from '@/lib/finance/stock';

export const dynamic = 'force-dynamic';
// WordPress downloads every photo while creating the product
export const maxDuration = 60;

const PRICE = /^\d{1,7}(\.\d{1,2})?$/;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

type PriceRow = { regularPrice?: string; salePrice?: string; stock?: number };
function checkPrice(label: string, r: PriceRow): string | null {
  const reg = String(r.regularPrice ?? '').trim(), sale = String(r.salePrice ?? '').trim();
  if (!PRICE.test(reg) || Number(reg) <= 0) return `${label}: enter a regular price`;
  if (sale && (!PRICE.test(sale) || Number(sale) >= Number(reg))) return `${label}: the sale price must be a number below the regular price`;
  if (!Number.isInteger(r.stock) || r.stock! < 0 || r.stock! > 100_000) return `${label}: stock must be a whole number, 0 or more`;
  return null;
}

/** Create a product in WooCommerce. See `NewProductInput`; `position: 'top' | 'bottom'` places it on the shop. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const name = String(b.name || '').trim();
    if (name.length < 2 || name.length > 200) return bad('Give the product a name');
    const imageUrls: string[] = Array.isArray(b.imageUrls) ? b.imageUrls.map(String) : [];
    if (!imageUrls.length) return bad('Add at least one photo');
    if (imageUrls.length > 12 || imageUrls.some(u => !isUploadUrl(u))) return bad('Photos must be uploaded from this page (12 at most)');
    const categoryIds: number[] = (Array.isArray(b.categoryIds) ? b.categoryIds : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0);
    if (!categoryIds.length) return bad('Pick a category');

    const rawSizes: any[] = Array.isArray(b.sizes) ? b.sizes : [];
    const sizes = rawSizes.map(s => ({
      size: String(s.size || '').trim().slice(0, 20), regularPrice: String(s.regularPrice ?? '').trim(), salePrice: String(s.salePrice ?? '').trim(),
      stock: Number(s.stock), description: String(s.description || '').slice(0, 300),
    }));
    if (sizes.some(s => !s.size) || new Set(sizes.map(s => s.size.toUpperCase())).size !== sizes.length) return bad('Each size needs a different name');
    for (const s of sizes) { const err = checkPrice(s.size, s); if (err) return bad(err); }
    let simple: NewProductInput['simple'];
    if (!sizes.length) {
      simple = { regularPrice: String(b.regularPrice ?? '').trim(), salePrice: String(b.salePrice ?? '').trim(), stock: Number(b.stock) };
      const err = checkPrice('Price', simple); if (err) return bad(err);
    }

    // First on the shop = below the current #1; last = after the current last
    const orders = (await getWooCatalog()).map(p => p.menuOrder);
    const menuOrder = b.position === 'bottom' ? Math.max(0, ...orders) + 1 : Math.min(1, ...orders) - 1;

    const created = await createWooProduct({
      name, status: b.status === 'draft' ? 'draft' : 'publish', categoryIds,
      description: String(b.description || '').slice(0, 20_000), shortDescription: String(b.shortDescription || '').slice(0, 5_000),
      imageUrls, menuOrder, sizes, simple,
    });
    // WordPress has its own copies now
    await deletePhotoUploads(imageUrls);
    invalidateStockSnapshot();
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not create the product' }, { status: 500 });
  }
}
