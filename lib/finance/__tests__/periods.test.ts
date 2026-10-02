import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths, allowedGranularities, autoGranularity, bucketsInRange, comparisonRange, daysBetween, endOf,
  periodLabel, rangeFor, shiftAnchor, startOf, startOfWeek,
} from '../periods';

test('addMonths clamps to the end of shorter months', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29'); // leap year
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2026-05-31', -12), '2025-05-31');
});

test('weeks run Saturday to Friday', () => {
  assert.equal(startOfWeek('2026-10-02'), '2026-09-26'); // Fri → previous Sat
  assert.equal(startOfWeek('2026-10-03'), '2026-10-03'); // Sat is the start
  assert.equal(endOf('2026-10-01', 'week'), '2026-10-02');
});

test('startOf / endOf for every unit', () => {
  assert.equal(startOf('2026-08-17', 'quarter'), '2026-07-01');
  assert.equal(endOf('2026-08-17', 'quarter'), '2026-09-30');
  assert.equal(endOf('2026-02-10', 'month'), '2026-02-28');
  assert.equal(endOf('2026-06-01', 'year'), '2026-12-31');
});

test('daysBetween is inclusive', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-01'), 1);
  assert.equal(daysBetween('2026-01-01', '2026-12-31'), 365);
});

test('buckets are clipped to the range and labelled from the clipped start', () => {
  const b = bucketsInRange('2026-09-01', '2026-09-30', 'week');
  assert.equal(b.length, 5);
  assert.equal(b[0].from, '2026-09-01');
  assert.equal(b[0].label, '1 Sep');
  assert.equal(b.at(-1)!.to, '2026-09-30');
  // Contiguous: each bucket starts the day after the previous ends
  for (let i = 1; i < b.length; i++) assert.equal(daysBetween(b[i - 1].to, b[i].from), 2);
});

test('month buckets add the year when a range spans years', () => {
  const b = bucketsInRange('2025-11-01', '2026-02-28', 'month');
  assert.deepEqual(b.map(x => x.label), ['Nov ’25', 'Dec ’25', 'Jan ’26', 'Feb ’26']);
});

test('granularity defaults scale with range length', () => {
  assert.equal(autoGranularity('2026-09-01', '2026-09-30'), 'day');
  assert.equal(autoGranularity('2026-01-01', '2026-03-31'), 'week');
  assert.equal(autoGranularity('2026-01-01', '2026-12-31'), 'month');
  assert.ok(!allowedGranularities('2025-01-01', '2026-10-01').includes('day'));
});

test('an in-progress month compares like-for-like with the same days last month', () => {
  const r = rangeFor('month', '2026-10-15');
  assert.deepEqual(r, { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(comparisonRange('month', r, 'previous', '2026-10-15'), { from: '2026-09-01', to: '2026-09-15' });
  assert.deepEqual(comparisonRange('month', r, 'yoy', '2026-10-15'), { from: '2025-10-01', to: '2025-10-15' });
});

test('completed periods compare with the whole previous period', () => {
  const r = rangeFor('month', '2026-03-10');
  assert.deepEqual(comparisonRange('month', r, 'previous', '2026-10-01'), { from: '2026-02-01', to: '2026-02-28' });
  const custom = { from: '2026-09-01', to: '2026-09-10' };
  assert.deepEqual(comparisonRange('custom', custom, 'previous', '2026-10-01'), { from: '2026-08-22', to: '2026-08-31' });
});

test('no comparison for future periods or when turned off', () => {
  assert.equal(comparisonRange('month', rangeFor('month', '2026-12-01'), 'previous', '2026-10-01'), null);
  assert.equal(comparisonRange('month', rangeFor('month', '2026-09-01'), 'none', '2026-10-01'), null);
});

test('stepping a custom range moves it by its own length', () => {
  const s = shiftAnchor('custom', '2026-10-01', -1, { from: '2026-09-21', to: '2026-09-30' });
  assert.deepEqual(s.custom, { from: '2026-09-11', to: '2026-09-20' });
  assert.equal(shiftAnchor('quarter', '2026-08-15', 1).anchor, '2026-11-15');
});

test('period labels', () => {
  assert.equal(periodLabel('month', rangeFor('month', '2026-09-03')), 'September 2026');
  assert.equal(periodLabel('quarter', rangeFor('quarter', '2026-09-03')), 'Q3 2026');
  assert.equal(periodLabel('custom', { from: '2025-12-20', to: '2026-01-05' }), '20 Dec 2025 – 5 Jan 2026');
});
