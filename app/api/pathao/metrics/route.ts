import { NextResponse } from 'next/server';
import { pathaoFetch } from '@/lib/integrations/pathao';

interface OrderSummaryResponse {
  message: string;
  code: number;
  data: {
    delivered?: { count: number; total_amount: number; yet_to_process_amount?: number; percentage: number };
    processing?: { count: number; total_amount: number; percentage: number };
    returned?:   { count: number; total_amount: number; under_processing_count?: number; percentage: number };
    paid_return?: { count: number; total_amount: number; percentage: number };
    total?:      { count: number; total_amount: number; percentage: number };
  };
}

interface InvoiceSummaryResponse {
  message: string;
  code: number;
  data: {
    last_invoice_date: string;
    payment_sent: number;
    payment_method: string;
    payment_method_name: string;
    lifetime_earning: number;
    payment_in_process: number;
    payment_in_review: number;
    payment_preparing_for_invoice: number;
  };
}

export async function GET() {
  try {
    const [orderSummary, invoiceSummary] = await Promise.allSettled([
      pathaoFetch<OrderSummaryResponse>('/merchant/order-summary'),
      pathaoFetch<InvoiceSummaryResponse>('/merchant/invoice-summary'),
    ]);

    const orders = orderSummary.status === 'fulfilled' ? orderSummary.value.data : null;
    const invoice = invoiceSummary.status === 'fulfilled' ? invoiceSummary.value.data : null;

    return NextResponse.json({
      orderSummary: orders
        ? {
            delivered:   { count: orders.delivered?.count ?? 0,   amount: orders.delivered?.total_amount ?? 0,   pct: orders.delivered?.percentage ?? 0 },
            processing:  { count: orders.processing?.count ?? 0,  amount: orders.processing?.total_amount ?? 0,  pct: orders.processing?.percentage ?? 0 },
            returned:    { count: orders.returned?.count ?? 0,     amount: orders.returned?.total_amount ?? 0,    pct: orders.returned?.percentage ?? 0,   underProcessing: orders.returned?.under_processing_count ?? 0 },
            paidReturn:  { count: orders.paid_return?.count ?? 0,  amount: orders.paid_return?.total_amount ?? 0, pct: orders.paid_return?.percentage ?? 0 },
            total:       { count: orders.total?.count ?? 0,        amount: orders.total?.total_amount ?? 0 },
          }
        : null,
      invoiceSummary: invoice
        ? {
            lastInvoiceDate:              invoice.last_invoice_date,
            paymentSent:                  invoice.payment_sent,
            paymentMethod:                invoice.payment_method_name,
            lifetimeEarning:              invoice.lifetime_earning,
            paymentInProcess:             invoice.payment_in_process,
            paymentInReview:              invoice.payment_in_review,
            paymentPreparingForInvoice:   invoice.payment_preparing_for_invoice,
          }
        : null,
      errors: {
        orderSummary:  orderSummary.status  === 'rejected' ? orderSummary.reason?.message  : null,
        invoiceSummary: invoiceSummary.status === 'rejected' ? invoiceSummary.reason?.message : null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
