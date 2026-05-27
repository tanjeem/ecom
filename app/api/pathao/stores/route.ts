import { NextRequest, NextResponse } from "next/server";
import { getPathaoStores } from "@/lib/integrations/pathao";

/**
 * GET /api/pathao/stores
 * Get all merchant stores
 */
export async function GET(_request: NextRequest) {
  try {
    const result = await getPathaoStores();
    return NextResponse.json({
      stores: result.stores,
      total: result.total,
      currentPage: result.currentPage,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch stores" },
      { status: 400 }
    );
  }
}
