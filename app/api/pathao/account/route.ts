import { NextRequest, NextResponse } from "next/server";
import { getPathaoStores } from "@/lib/integrations/pathao";

/**
 * GET /api/pathao/account
 * Get Pathao store/account information
 */
export async function GET(_request: NextRequest) {
  try {
    const result = await getPathaoStores();
    return NextResponse.json({
      stores: result.stores,
      total: result.total,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch account info" },
      { status: 400 },
    );
  }
}
