import { NextRequest, NextResponse } from "next/server";
import { getPathaoConsignmentInfo } from "@/lib/integrations/pathao";

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
      { error: error instanceof Error ? error.message : "Unable to get Pathao order" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ consignmentId: string }> },
) {
  const { consignmentId } = await params;
  return NextResponse.json({
    consignmentId,
    message: "Cancellation must be done via Pathao merchant portal.",
  });
}
