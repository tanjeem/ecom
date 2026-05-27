import { NextResponse } from "next/server";
import { hasEnv, requiredPathaoBookingEnv, requiredPathaoEnv, requiredWooEnv } from "@/lib/integrations/env";

export async function GET() {
  return NextResponse.json({
    woocommerce: hasEnv(requiredWooEnv),
    pathao: hasEnv(requiredPathaoEnv),
    pathaoBookingDefaults: hasEnv(requiredPathaoBookingEnv),
  });
}
