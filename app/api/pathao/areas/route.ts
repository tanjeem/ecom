import { NextRequest, NextResponse } from "next/server";
import { getPathaoAreas } from "@/lib/integrations/pathao";

/**
 * GET /api/pathao/areas
 * Get areas for a specific zone
 * Query: ?zoneId=123
 */
export async function GET(request: NextRequest) {
  try {
    const zoneIdStr = request.nextUrl.searchParams.get("zoneId");
    if (!zoneIdStr) {
      return NextResponse.json(
        { error: "zoneId query parameter is required" },
        { status: 400 }
      );
    }

    const zoneId = Number.parseInt(zoneIdStr, 10);
    const result = await getPathaoAreas(zoneId);
    return NextResponse.json({ areas: result.areas });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch areas" },
      { status: 400 }
    );
  }
}
