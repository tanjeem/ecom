import { NextRequest, NextResponse } from "next/server";
import { getPathaoConsignmentInfo } from "@/lib/integrations/pathao";

/**
 * GET /api/pathao/info/{consignmentId}
 * Get short info about a specific consignment
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ consignmentId: string }> },
) {
  try {
    const { consignmentId } = await params;
    const info = await getPathaoConsignmentInfo(consignmentId);
    return NextResponse.json({
      consignmentId: info.consignmentId,
      merchantOrderId: info.merchantOrderId,
      status: info.status,
      statusSlug: info.statusSlug,
      updatedAt: info.updatedAt,
      invoiceId: info.invoiceId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch consignment info" },
      { status: 400 }
    );
  }
}
