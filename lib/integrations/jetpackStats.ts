// Product page views from Jetpack Stats, which the shop already runs. Jetpack
// keeps the numbers on WordPress.com; the site's own REST API proxies them for
// a logged-in admin, so we sign in with a WordPress Application Password
// (WP_USERNAME + WP_APP_PASSWORD; create one under Users → Profile).

const BLOG_ID = () => process.env.JETPACK_BLOG_ID || '171686528';

export const jetpackConfigured = () => !!process.env.WP_USERNAME && !!process.env.WP_APP_PASSWORD && !!process.env.WOOCOMMERCE_URL;

type PostView = { id: number; views: number; type?: string; title?: string; href?: string };
type TopPosts = {
  days?: Record<string, { postviews?: PostView[] }>;
  summary?: { postviews?: PostView[] };
};

/** Pure: total views per product page from a top-posts response, whether it came summarised or day by day. */
export function viewsFromTopPosts(res: TopPosts): Map<number, number> {
  const out = new Map<number, number>();
  const lists = res.summary?.postviews
    ? [res.summary.postviews]
    : Object.values(res.days || {}).map(d => d.postviews || []);
  for (const list of lists) {
    for (const p of list) {
      const id = Number(p.id);
      if (!id || (p.type && p.type !== 'product')) continue; // product pages only (0 is the home page)
      out.set(id, (out.get(id) || 0) + (Number(p.views) || 0));
    }
  }
  return out;
}

/** Store-local date (Asia/Dhaka) as YYYY-MM-DD. */
const dhakaDate = (d = new Date()) => new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10);

/** Views per product page over the last `days` days, today included. */
export async function getProductViews(days: number): Promise<Map<number, number>> {
  if (!jetpackConfigured()) throw new Error('Jetpack views are not connected');
  const base = process.env.WOOCOMMERCE_URL!.replace(/\/$/, '');
  const params = new URLSearchParams({ period: 'day', num: String(days), date: dhakaDate(), max: '0', summarize: '1' });
  const auth = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD!.replace(/\s+/g, '')}`).toString('base64');
  const res = await fetch(`${base}/wp-json/jetpack/v4/stats-app/sites/${BLOG_ID()}/stats/top-posts?${params}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; ShopAdmin/1.0)' },
    cache: 'no-store',
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const msg = data?.message ? String(data.message).replace(/<[^>]+>/g, '') : `Jetpack stats request failed (${res.status})`;
    throw new Error(res.status === 401 || res.status === 403 ? `WordPress refused the login: ${msg}` : msg);
  }
  if (!data || typeof data !== 'object') throw new Error('Jetpack stats sent an unexpected reply');
  return viewsFromTopPosts(data);
}
