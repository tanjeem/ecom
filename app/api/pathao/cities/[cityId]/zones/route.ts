import { NextRequest, NextResponse } from "next/server";
import { getPathaoZones } from "@/lib/integrations/pathao";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> },
) {
  try {
    const { cityId } = await params;
    const result = await getPathaoZones(Number.parseInt(cityId, 10));
    return NextResponse.json({ zones: result.zones });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch zones" },
      { status: 400 },
    );
  }
}
