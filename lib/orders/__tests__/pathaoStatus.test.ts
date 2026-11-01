import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMoveTo, pathaoLabel, pathaoStage, wooStatusForStage } from '../pathaoStatus';

test('list statuses and webhook slugs map to the same stage', () => {
  assert.equal(pathaoStage('Paid Return'), 'returned');
  assert.equal(pathaoStage('order.paid-return'), 'returned');
  assert.equal(pathaoStage('Assigned For Delivery'), 'in_transit');
  assert.equal(pathaoStage('order.at-the-sorting-hub'), 'in_transit');
  assert.equal(pathaoStage('At Sorting Hub'), 'in_transit');
  assert.equal(pathaoStage('Delivered'), 'delivered');
  assert.equal(pathaoStage('Pending'), 'pre_pickup');
  assert.equal(pathaoStage('Pickup Cancel'), 'pickup_cancelled');
  assert.equal(pathaoStage('Something New'), 'unknown');
});

test('labels are readable whichever form arrived', () => {
  assert.equal(pathaoLabel('order.assigned-for-delivery'), 'Assigned For Delivery');
  assert.equal(pathaoLabel('Paid Return'), 'Paid Return');
});

test('courier stages imply WooCommerce statuses; pickup cancellations are left alone', () => {
  assert.equal(wooStatusForStage('in_transit'), 'dispatched');
  assert.equal(wooStatusForStage('delivered'), 'completed');
  assert.equal(wooStatusForStage('returned'), 'cancelled');
  assert.equal(wooStatusForStage('pickup_cancelled'), null);
  assert.equal(wooStatusForStage('pre_pickup'), null);
});

test('orders only move forward and finished orders are never touched', () => {
  assert.ok(canMoveTo('processing', 'dispatched'));
  assert.ok(canMoveTo('packed', 'completed'));
  assert.ok(canMoveTo('dispatched', 'cancelled'));
  assert.ok(!canMoveTo('dispatched', 'dispatched'));
  assert.ok(!canMoveTo('completed', 'cancelled'));
  assert.ok(!canMoveTo('refunded', 'completed'));
  assert.ok(!canMoveTo('cancelled', 'completed'));
});
