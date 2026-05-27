import { NextRequest, NextResponse } from "next/server";
import { getPathaoAreas } from "@/lib/integrations/pathao";

export async function GET(request: NextRequest) {
  const zoneId = request.nextUrl.searchParams.get("zoneId");
  if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });
  try {
    const result = await getPathaoAreas(Number.parseInt(zoneId, 10));
    return NextResponse.json({ areas: result.areas });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch areas" },
      { status: 400 },
    );
  }
}
