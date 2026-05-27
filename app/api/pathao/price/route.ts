import { NextRequest, NextResponse } from "next/server";
import { calculatePathaoPrice } from "@/lib/integrations/pathao";

/**
 * POST /api/pathao/price
 * Calculate delivery price based on parameters
 */
export async function POST(request: NextRequest) {
  try {
    const params = (await request.json()) as {
      storeId: number;
      itemType: number;
      deliveryType: number;
      itemWeight: number;
      recipientCity: number;
      recipientZone: number;
    };

    // Validate required parameters
    if (!params.storeId || !params.recipientCity || !params.recipientZone) {
      return NextResponse.json(
        { error: "storeId, recipientCity, and recipientZone are required" },
        { status: 400 }
      );
    }

    const price = await calculatePathaoPrice({
      storeId: params.storeId,
      itemType: params.itemType || 2,
      deliveryType: params.deliveryType || 48,
      itemWeight: params.itemWeight || 0.5,
      recipientCity: params.recipientCity,
      recipientZone: params.recipientZone,
    });

    return NextResponse.json({
      price: price.price,
      discount: price.discount,
      promoDiscount: price.promoDiscount,
      codEnabled: price.codEnabled,
      codPercentage: price.codPercentage,
      finalPrice: price.finalPrice,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to calculate price" },
      { status: 400 }
    );
  }
}
