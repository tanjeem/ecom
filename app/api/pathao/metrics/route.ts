import { NextRequest, NextResponse } from 'next/server';
import { pathaoFetch, getPathaoPortalOrders, type PathaoPortalOrder } from '@/lib/integrations/pathao';
import { dashboardCache } from '@/lib/cache';

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

const STATUS_MAP: Record<string, string> = {
  'Delivered':           'Delivered',
  'Partial Delivery':    'Partial Delivery',
  'Return':              'Return',
  'Return pending':      'Return',
  'Returned To Merchant':'Returned to Merchant',
  'Return In Transit':   'Return In Transit',
  'Paid Return':         'Paid Return',
  'In Transit':          'In Transit',
  'At Sorting Hub':      'At the Sorting HUB',
  'On hold':             'On Hold',
  'Pickup Cancel':       'Pickup Cancelled',
  'Pickup Failed':       'Pickup Failed',
  'Assigned for Pickup': 'Assigned for Pickup',
  'Pickup':              'Pickup',
  'Ready':               'Ready',
  'Exchange':            'Exchange',
  'Payment Invoice':     'Payment Invoice',
};

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const fromDate = sp.get('from') || undefined;
  const toDate   = sp.get('to')   || undefined;
  const forceRefresh = sp.get('refresh') === 'true' || sp.get('force') === 'true';

  if (forceRefresh) {
    console.log('[Cache] Pathao metrics force refresh requested, clearing cache.');
    dashboardCache.clear();
  }

  const cacheKey = `pathao_metrics_${fromDate || ''}_${toDate || ''}`;
  if (!forceRefresh) {
    const cached = dashboardCache.get<any>(cacheKey);
    if (cached) {
      console.log(`[Cache] Serving pathao metrics from cache for key: ${cacheKey}`);
      return NextResponse.json(cached);
    }
  }

  try {
    // Fetch ALL orders once (no date filter) + invoice summary in parallel.
    // Then filter in-memory for the date-scoped summary — avoids double API calls & rate limits.
    const [allOrdersResult, invoiceSummary] = await Promise.allSettled([
      getPathaoPortalOrders(), // all-time, no date params
      pathaoFetch<InvoiceSummaryResponse>('/merchant/invoice-summary'),
    ]);

    const allOrders: PathaoPortalOrder[] =
      allOrdersResult.status === 'fulfilled' ? allOrdersResult.value : [];

    // Filter to date range in memory (order_created_at is YYYY-MM-DD HH:MM:SS)
    const filteredOrders = (fromDate || toDate)
      ? allOrders.filter(o => {
          const d = o.order_created_at?.slice(0, 10); // 'YYYY-MM-DD'
          if (fromDate && d < fromDate) return false;
          if (toDate   && d > toDate)   return false;
          return true;
        })
      : allOrders;

    const buildGroups = (orders: PathaoPortalOrder[]) => {
      const groups: Record<string, { count: number; amount: number }> = {};
      for (const o of orders) {
        const normalised = STATUS_MAP[o.order_status] ?? o.order_status;
        if (!groups[normalised]) groups[normalised] = { count: 0, amount: 0 };
        groups[normalised].count++;
        groups[normalised].amount += o.order_amount || 0;
      }
      return groups;
    };

    const groups    = buildGroups(filteredOrders);
    const allGroups = buildGroups(allOrders);

    const total = Object.values(groups).reduce((s, g) => s + g.count, 0);
    const pct   = (n: number) => total > 0 ? Math.round((n / total) * 10000) / 100 : 0;

    const delivered  = (groups['Delivered']?.count  ?? 0) + (groups['Partial Delivery']?.count ?? 0);
    const returned   = (groups['Return']?.count     ?? 0) + (groups['Returned to Merchant']?.count ?? 0);
    const paidReturn = groups['Paid Return']?.count  ?? 0;
    const processing = total - delivered - returned - paidReturn;

    const invoice = invoiceSummary.status === 'fulfilled' ? invoiceSummary.value.data : null;

    const responseData = {
      fromDate, toDate,
      totalOrders: total,
      orderSummary: {
        delivered:  { count: delivered,  amount: (groups['Delivered']?.amount ?? 0) + (groups['Partial Delivery']?.amount ?? 0), pct: pct(delivered)  },
        processing: { count: processing, amount: 0,                                                                               pct: pct(processing) },
        returned:   { count: returned,   amount: (groups['Return']?.amount ?? 0) + (groups['Returned to Merchant']?.amount ?? 0), pct: pct(returned)   },
        paidReturn: { count: paidReturn, amount: groups['Paid Return']?.amount ?? 0,                                              pct: pct(paidReturn) },
        total:      { count: total,      amount: Object.values(groups).reduce((s, g) => s + g.amount, 0) },
      },
      statusBreakdown: groups,
      allTimeStatusBreakdown: allGroups,
      invoiceSummary: invoice ? {
        lastInvoiceDate:             invoice.last_invoice_date,
        paymentSent:                 invoice.payment_sent,
        paymentMethod:               invoice.payment_method_name,
        lifetimeEarning:             invoice.lifetime_earning,
        paymentInProcess:            invoice.payment_in_process,
        paymentInReview:             invoice.payment_in_review,
        paymentPreparingForInvoice:  invoice.payment_preparing_for_invoice,
      } : null,
      errors: {
        portalOrders:  allOrdersResult.status === 'rejected' ? String(allOrdersResult.reason) : null,
        invoiceSummary: invoiceSummary.status === 'rejected' ? String(invoiceSummary.reason) : null,
      },
    };

    // Cache the Pathao metrics response for 10 minutes
    dashboardCache.set(cacheKey, responseData, 10 * 60 * 1000);

    return NextResponse.json(responseData);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}


