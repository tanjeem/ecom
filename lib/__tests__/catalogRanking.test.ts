import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankIds, shopConversion, smoothedConversion, type ProductStat } from '../catalogRanking';
import { viewsFromTopPosts } from '../integrations/jetpackStats';

const st = (views: number, orders: number): ProductStat => ({ views, orders, units: orders, revenue: 0 });

test('a product with a handful of views does not beat a proven seller on conversion', () => {
  const stats = new Map([[1, st(2000, 40)], [2, st(4, 1)], [3, st(1500, 10)]]);
  assert.deepEqual(rankIds([3, 2, 1], stats, 'conversion', () => true), [1, 2, 3]);
  const avg = shopConversion(stats);
  assert.ok(smoothedConversion(stats.get(2), avg) < 40 / 2000);
});

test('views and orders sorts; ties keep the current order; sold out goes last', () => {
  const stats = new Map([[1, st(100, 1)], [2, st(300, 1)], [3, st(300, 5)], [4, st(900, 9)]]);
  const inStock = (id: number) => id !== 4;
  assert.deepEqual(rankIds([1, 2, 3, 4], stats, 'views', inStock), [3, 2, 1, 4]);
  assert.deepEqual(rankIds([1, 2, 3, 4], stats, 'orders', inStock), [3, 2, 1, 4]);
  assert.deepEqual(rankIds([5, 6, 1], new Map([[1, st(10, 0)]]), 'orders', () => true), [1, 5, 6]);
});

test('Jetpack top-posts: summary or per-day lists, product pages only', () => {
  assert.deepEqual([...viewsFromTopPosts({ summary: { postviews: [{ id: 6298, views: 12, type: 'product' }, { id: 0, views: 99 }, { id: 60, views: 500, type: 'page' }] } })], [[6298, 12]]);
  const byDay = viewsFromTopPosts({ days: { '2026-11-15': { postviews: [{ id: 1, views: 2 }] }, '2026-11-16': { postviews: [{ id: 1, views: 3 }, { id: 2, views: 1 }] } } });
  assert.deepEqual([...byDay], [[1, 5], [2, 1]]);
});
