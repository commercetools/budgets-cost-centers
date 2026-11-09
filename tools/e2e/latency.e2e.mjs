// Latency check against the sandbox with the seed data and a deployed Extension. [BCC-CART-10]
//
// Creates one cart for the seeded buyer on the seeded cost center and sends 200 cart updates through the platform,
// each of which calls the Extension. The time of a whole update call is measured, so the Extension's own share is
// lower. Passes when the 95th percentile is below 300 ms and every update was answered. The cart create doubles as
// warm-up and is retried, because a sleeping sandbox or preview Deployment needs longer than the Extension timeout
// for its first call. The order type key comes from BCC_ORDER_TYPE_KEY in the secrets file (default bcc-order).
//
// Usage: node tools/e2e/latency.e2e.mjs [count]   (credentials from the secrets file, see tools/run-local.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMIT_MS = 300;

// Nearest-rank percentile of a list of numbers.
export function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

export const orderTypeKey = (fileEnv) => fileEnv.BCC_ORDER_TYPE_KEY?.trim() || 'bcc-order';

// Repeats a call until it answers below 300, up to `times` attempts.
export async function retry(call, times, waitMs = 5000) {
  let r;
  for (let i = 0; i < times; i++) {
    r = await call();
    if (r.status < 300) return r;
    await new Promise((res) => setTimeout(res, waitMs));
  }
  return r;
}

export function verdict({ ms, failed }) {
  const p95 = percentile(ms, 95);
  return { ok: failed === 0 && p95 < LIMIT_MS, p50: percentile(ms, 50), p95, max: Math.max(...ms) };
}

async function main(count) {
  const { envFor, parseEnvFile, secretsFile } = await import('../run-local.mjs');
  const fileEnv = parseEnvFile(fs.readFileSync(secretsFile(), 'utf8'));
  const env = envFor('seed', fileEnv);
  const basic = Buffer.from(`${env.CTP_CLIENT_ID}:${env.CTP_CLIENT_SECRET}`).toString('base64');
  const auth = await fetch(`${env.CTP_AUTH_URL}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: env.CTP_SCOPE }),
  }).then((r) => r.json());
  if (!auth.access_token) throw new Error(`Token request failed: ${auth.error_description ?? auth.error}`);
  const api = async (method, p, body) => {
    const r = await fetch(`${env.CTP_API_URL}/${env.CTP_PROJECT_KEY}${p}`, {
      method,
      headers: { Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  };

  const unit = 'bcc-demo-installer';
  const buyer = (await api('GET', '/customers/key=bcc-demo-anna-buyer')).body.id;
  const base = `/as-associate/${buyer}/in-business-unit/key=${unit}/carts`;
  const created = await retry(() => api('POST', base, {
    key: `bcc-latency-${Date.now()}`,
    customerId: buyer,
    currency: 'EUR',
    country: 'DE',
    taxMode: 'Disabled',
    deleteDaysAfterLastModification: 1,
    custom: { type: { typeId: 'type', key: orderTypeKey(fileEnv) }, fields: { bccCostObject: `${unit}~CC-4100` } },
  }), 4);
  if (created.status !== 201) throw new Error(`Cart create failed: ${created.status} ${JSON.stringify(created.body)}`);

  let { id, version } = created.body;
  const ms = [];
  let failed = 0;
  for (let i = 0; i < count; i++) {
    const t0 = performance.now();
    const r = await api('POST', `${base}/${id}`, {
      version,
      actions: [{ action: 'setCustomField', name: 'bccCostObject', value: `${unit}~CC-4100` }],
    });
    ms.push(Math.round(performance.now() - t0));
    if (r.status === 200) version = r.body.version;
    else failed += 1;
  }
  const v = verdict({ ms, failed });
  console.log(`cart updates with the Extension: n=${count}, failed ${failed}, p50 ${v.p50} ms, p95 ${v.p95} ms, max ${v.max} ms`);
  console.log(v.ok ? `PASS: p95 below ${LIMIT_MS} ms` : `FAIL: p95 must be below ${LIMIT_MS} ms with no failed update`);
  return v.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(Number(process.argv[2] ?? 200)).then(
    (code) => (process.exitCode = code),
    (e) => {
      console.error(e.message);
      process.exitCode = 1;
    }
  );
}
