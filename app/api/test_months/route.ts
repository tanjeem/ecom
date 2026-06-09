import { getPathaoPortalOrders } from '@/lib/integrations/pathao';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ordersJan = await getPathaoPortalOrders('2026-01-01', '2026-01-31');
    const ordersFeb = await getPathaoPortalOrders('2026-02-01', '2026-02-28');
    
    return Response.json({
      jan: ordersJan.length,
      feb: ordersFeb.length
    });
  } catch (e: any) {
    return Response.json({ error: e.message });
  }
}
