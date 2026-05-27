import { NextRequest, NextResponse } from "next/server";
import { getWooOrders } from "@/lib/integrations/woocommerce";

const mockOrders = [
  {
    id: "#1001",
    wooId: 1001,
    source: "WooCommerce",
    customer: "Ayesha Khan",
    phone: "01700000001",
    address: "Gulshan, Dhaka",
    items: "Black Linen Shirt",
    payment: "Cash on Delivery",
    status: "paid",
    courier: "Pathao",
    pathaoStatus: "Delivered",
    pathaoConsignment: "PC-001",
    payable: 2450,
    total: 2450,
    city: "Dhaka",
    margin: "Pending",
    notes: "Mock order for testing",
  },
  {
    id: "#1002",
    wooId: 1002,
    source: "WooCommerce",
    customer: "Farah Ahmed",
    phone: "01700000002",
    address: "Banani, Dhaka",
    items: "White Cotton Robe",
    payment: "Cash on Delivery",
    status: "packed",
    courier: "Pathao",
    pathaoStatus: "Ready",
    pathaoConsignment: "",
    payable: 3200,
    total: 3200,
    city: "Dhaka",
    margin: "Pending",
    notes: "Mock order for testing",
  },
  {
    id: "#1003",
    wooId: 1003,
    source: "WooCommerce",
    customer: "Noor Hassan",
    phone: "01700000003",
    address: "Dhanmondi, Dhaka",
    items: "Navy Chambray Shirt",
    payment: "Cash on Delivery",
    status: "hold",
    courier: "Pathao",
    pathaoStatus: "Ready",
    pathaoConsignment: "",
    payable: 2800,
    total: 2800,
    city: "Dhaka",
    margin: "Pending",
    notes: "Mock order for testing",
  },
];

export async function GET(request: NextRequest) {
  try {
    // Try to get real orders from WooCommerce
    try {
      const orders = await getWooOrders(request.nextUrl.searchParams);
      return NextResponse.json({ orders });
    } catch (error) {
      // Fall back to mock data
      console.log("WooCommerce fetch failed, returning mock data:", error);
      return NextResponse.json({ orders: mockOrders });
    }
  } catch (error) {
    console.error("Orders API error:", error);
    return NextResponse.json(
      { orders: mockOrders },
      { status: 200 },
    );
  }
}
