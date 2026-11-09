// Tests for the latency check's statistics. [BCC-CART-10]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderTypeKey, percentile, retry, verdict } from './latency.e2e.mjs';

test('the 95th percentile is the value below which 95 % of the samples fall (nearest rank)', () => {
  const samples = Array.from({ length: 200 }, (_, i) => i + 1);
  assert.equal(percentile(samples, 95), 190);
  assert.equal(percentile(samples, 50), 100);
  assert.equal(percentile([7], 95), 7);
});

test('the check passes only below 300 ms at p95 and with every update answered', () => {
  assert.deepEqual(verdict({ ms: [100, 200, 299], failed: 0 }), { ok: true, p50: 200, p95: 299, max: 299 });
  assert.equal(verdict({ ms: [100, 200, 300], failed: 0 }).ok, false);
  assert.equal(verdict({ ms: [100], failed: 1 }).ok, false);
});

test('the cart uses the configured order type key, bcc-order by default (review finding 6)', () => {
  assert.equal(orderTypeKey({}), 'bcc-order');
  assert.equal(orderTypeKey({ BCC_ORDER_TYPE_KEY: 'shop-order' }), 'shop-order');
});

test('the warm-up retries a call that fails while a sleeping Deployment starts (review finding 6)', async () => {
  let calls = 0;
  const flaky = async () => (++calls < 3 ? { status: 504 } : { status: 201 });
  assert.equal((await retry(flaky, 3, 0)).status, 201);
  calls = 0;
  assert.equal((await retry(flaky, 2, 0)).status, 504);
});
