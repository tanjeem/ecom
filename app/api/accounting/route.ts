import { NextRequest, NextResponse } from "next/server";
import { getAllWooOrders } from "@/lib/integrations/woocommerce";
import { pathaoFetch, getPathaoInvoices } from "@/lib/integrations/pathao";
import { dashboardCache } from "@/lib/cache";
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

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Every status that represents a real sale (custom "packed"/"dispatched" included)
const REVENUE_STATUSES = "processing,on-hold,completed,packed,dispatched";
// Woo's server is slow (~2-5s per page of orders), so lean on the cache;
// a year's totals barely move within 10 minutes.
const CACHE_TTL: Record<Period, number> = { week: 2 * 60 * 1000, month: 2 * 60 * 1000, year: 10 * 60 * 1000 };

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const period = (sp.get("period") ?? "month") as Period;
  const { after, label } = getDateRange(period);

  const cacheKey = `accounting_${period}_${after}`;
  if (sp.get("refresh") !== "true") {
    const cached = dashboardCache.get<any>(cacheKey);
    if (cached) return NextResponse.json(cached);
  }

  const [ordersResult, invoiceResult, invoicesResult] = await Promise.allSettled([
    getAllWooOrders(new URLSearchParams({
      status: REVENUE_STATUSES, after, orderby: "date", order: "desc",
      _fields: "id,number,status,total,date_created,line_items,fee_lines",
    })),
    pathaoFetch<{ data: InvoiceSummary }>("/merchant/invoice-summary"),
    // Invoices are paid a day or two after they're raised; look back a week and filter by payout date
    getPathaoInvoices(shiftDate(after.slice(0, 10), -7)),
  ]);

  const orders: CommerceOrder[] = ordersResult.status === "fulfilled" ? ordersResult.value : [];
  const invoice: InvoiceSummary | null =
    invoiceResult.status === "fulfilled" ? invoiceResult.value.data : null;

  // Cash Pathao actually paid out during the period
  const paidInvoices = invoicesResult.status === "fulfilled"
    ? invoicesResult.value.filter((i) => i.payment_status === "paid" && (i.paid_at ?? "").slice(0, 10) >= after.slice(0, 10))
    : [];
  const collectedInPeriod = paidInvoices.reduce((sum, i) => sum + (i.payable_amount || 0), 0);

  const revenueMTD = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const orderCount = orders.length;

  const collected = invoicesResult.status === "fulfilled" ? collectedInPeriod : invoice?.payment_sent ?? 0;
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
      amount: invoice?.payment_sent ?? 0,
      sub: invoice
        ? `${invoice.last_invoice_date} via ${invoice.payment_method_name}`
        : "No invoice data",
      color: "#16864d",
    },
  ];

  const body = {
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
    paidInvoiceCount: paidInvoices.length,
    errors: {
      orders: ordersResult.status === "rejected" ? String(ordersResult.reason) : null,
      invoice: invoiceResult.status === "rejected" ? String(invoiceResult.reason) : null,
    },
  };

  // Don't cache a response that's missing data
  if ([ordersResult, invoiceResult, invoicesResult].every((r) => r.status === "fulfilled")) {
    dashboardCache.set(cacheKey, body, CACHE_TTL[period] ?? CACHE_TTL.month);
  }
  return NextResponse.json(body);
}
