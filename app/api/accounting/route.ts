import { NextRequest, NextResponse } from "next/server";
import { getWooOrders } from "@/lib/integrations/woocommerce";
import { pathaoFetch } from "@/lib/integrations/pathao";
import type { CommerceOrder } from "@/lib/types/commerce";

type InvoiceSummary = {
  last_invoice_date: string;
  payment_sent: number;
  payment_method_name: string;
  lifetime_earning: number;
  payment_in_process: number;
  payment_in_review: number;
  payment_preparing_for_invoice: number;
};

type Period = "week" | "month" | "year";

function getDateRange(period: Period): { after: string; label: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;

  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { after: iso(start), label: "Last 7 Days" };
  }
  if (period === "year") {
    return { after: iso(new Date(now.getFullYear(), 0, 1)), label: "This Year" };
  }
  // month (default)
  return { after: iso(new Date(now.getFullYear(), now.getMonth(), 1)), label: "This Month" };
}

async function fetchOrdersForPeriod(after: string): Promise<CommerceOrder[]> {
  const statuses = ["processing", "on-hold", "completed"];
  const results = await Promise.allSettled(
    statuses.map((status) => {
      const p = new URLSearchParams({ status, after });
      return getWooOrders(p);
    })
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const period = (sp.get("period") ?? "month") as Period;
  const { after, label } = getDateRange(period);

  const [ordersResult, invoiceResult] = await Promise.allSettled([
    fetchOrdersForPeriod(after),
    pathaoFetch<{ data: InvoiceSummary }>("/merchant/invoice-summary"),
  ]);

  const orders: CommerceOrder[] = ordersResult.status === "fulfilled" ? ordersResult.value : [];
  const invoice: InvoiceSummary | null =
    invoiceResult.status === "fulfilled" ? invoiceResult.value.data : null;

  const revenueMTD = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const orderCount = orders.length;

  const collected = invoice?.payment_sent ?? 0;
  const pathaoInProcess = invoice?.payment_in_process ?? 0;
  const pathaoInReview = invoice?.payment_in_review ?? 0;
  const pathaoPreparingInvoice = invoice?.payment_preparing_for_invoice ?? 0;
  const codPending = pathaoInProcess + pathaoInReview + pathaoPreparingInvoice;
  const lifetimeEarning = invoice?.lifetime_earning ?? 0;

  // Ledger: last 20 orders as revenue entries
  const ledgerEntries = orders.slice(0, 20).map((o) => ({
    date: (o.dateCreated ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    account: "Revenue",
    memo: `${o.id} — ${(o.items ?? "").slice(0, 50)}`,
    debit: o.total ?? 0,
    credit: 0,
  }));

  const reconciliation = [
    {
      label: "COD — In Review",
      amount: pathaoInReview,
      sub: "Pending review by Pathao",
      color: "#b46a08",
    },
    {
      label: "COD — Preparing Invoice",
      amount: pathaoPreparingInvoice,
      sub: "Invoice being prepared",
      color: "#6d4ed9",
    },
    {
      label: "COD — In Process",
      amount: pathaoInProcess,
      sub: "Payment being processed",
      color: "#2563eb",
    },
    {
      label: "Last Payment Sent",
      amount: collected,
      sub: invoice
        ? `${invoice.last_invoice_date} via ${invoice.payment_method_name}`
        : "No invoice data",
      color: "#16864d",
    },
  ];

  return NextResponse.json({
    label,
    revenueMTD,
    orderCount,
    collected,
    codPending,
    pathaoInProcess,
    pathaoInReview,
    pathaoPreparingInvoice,
    lifetimeEarning,
    ledgerEntries,
    reconciliation,
    isMock: ordersResult.status === "rejected",
    errors: {
      orders: ordersResult.status === "rejected" ? String(ordersResult.reason) : null,
      invoice: invoiceResult.status === "rejected" ? String(invoiceResult.reason) : null,
    },
  });
}
