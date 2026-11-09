// [BCC-DEPLOY-6] [BCC-DEPLOY-8]
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

type Entry = { key: string; required?: boolean; default?: string };
type App = {
  name: string;
  applicationType: string;
  endpoint?: string;
  configuration: { standardConfiguration?: Entry[]; securedConfiguration?: Entry[] };
};
const doc = parse(fs.readFileSync(path.join(__dirname, '../../connect.yaml'), 'utf8')) as { deployAs: App[]; inheritAs?: { apiClient?: unknown } };
const app = (name: string) => doc.deployAs.find((a) => a.name === name)!;
const keys = (list?: Entry[]) => (list ?? []).map((e) => e.key);

test('no connector-wide API Client', () => expect(doc.inheritAs?.apiClient).toBeUndefined());
test('apps and endpoints', () => {
  expect(doc.deployAs.map((a) => a.name)).toEqual(['service', 'ledger', 'budget-view']);
  expect(app('service').endpoint).toBe('/service');
  expect(app('ledger').endpoint).toBe('/ledger');
});
// The view runs in the user's Merchant Center session: no endpoint, no client, no secrets.
// https://docs.commercetools.com/merchant-center-customizations/deployment/commercetools-connect
test('budget-view is a Custom View without endpoint or secrets', () => {
  const view = app('budget-view');
  expect(view.applicationType).toBe('merchant-center-custom-view');
  expect(view.endpoint).toBeUndefined();
  expect(view.configuration.securedConfiguration).toBeUndefined();
  expect(view.configuration.standardConfiguration).toEqual([
    expect.objectContaining({ key: 'CUSTOM_VIEW_ID', required: true }),
    expect.objectContaining({ key: 'CLOUD_IDENTIFIER', default: 'gcp-eu' }),
  ]);
});
test.each(['service', 'ledger'])('%s brings its own client as secrets', (name) =>
  expect(keys(app(name).configuration.securedConfiguration)).toEqual(expect.arrayContaining(['CTP_CLIENT_ID', 'CTP_CLIENT_SECRET', 'CTP_SCOPE'])));
test('the Extension secret is secured and service-only', () => {
  expect(keys(app('service').configuration.securedConfiguration)).toContain('BCC_EXTENSION_SECRET');
  expect(keys(app('ledger').configuration.securedConfiguration)).not.toContain('BCC_EXTENSION_SECRET');
});
test('no secret in standard configuration', () => {
  for (const a of doc.deployAs) expect(keys(a.configuration.standardConfiguration).filter((k) => /SECRET|CLIENT_ID|SCOPE/.test(k))).toEqual([]);
});
