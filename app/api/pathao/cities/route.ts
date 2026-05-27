import { NextRequest, NextResponse } from "next/server";
import { getPathaoCities } from "@/lib/integrations/pathao";

/**
 * GET /api/pathao/cities
 * Get list of cities available for delivery
 */
export async function GET(_request: NextRequest) {
  try {
    const result = await getPathaoCities();
    return NextResponse.json({ cities: result.cities });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch cities" },
      { status: 400 }
    );
  }
}
