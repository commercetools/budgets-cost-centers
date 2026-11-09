// Applying the seed: create by key, upsert Custom Objects only on change, zero writes on a second run. [BCC-APPR-8]
// [BCC-SEED-2] [BCC-SEED-3]
import * as logger from '../../shared/src/logger';
import { CONTAINERS } from 'budgets-cost-centers-core';
import { applySeed } from '../src/apply';
import { DEMO, seedData } from '../src/data';
import { FakePort } from './fake-port';

beforeEach(() => {
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('[BCC-SEED-2] idempotent by key', () => {
  test('the first run creates everything', async () => {
    const port = new FakePort();
    const data = seedData();
    const report = await applySeed(port, data);
    const expected =
      data.associateRoles.length +
      data.customers.length +
      data.businessUnits.length +
      data.customObjects.length +
      data.approvalRules.length +
      data.carts.length +
      data.shoppingLists.length;
    expect(report.created).toHaveLength(expected);
    expect(report.updated).toEqual([]);
    expect(report.unchanged).toEqual([]);
  });

  test('a second run against a project that holds everything writes nothing', async () => {
    const port = new FakePort();
    await applySeed(port, seedData());
    const writesAfterFirst = port.writes.length;
    const report = await applySeed(port, seedData());
    expect(report.created).toEqual([]);
    expect(report.updated).toEqual([]);
    expect(report.unchanged.length).toBe(writesAfterFirst);
    expect(port.writes.length).toBe(writesAfterFirst);
  });

  test('a Custom Object whose value differs is updated with the version it read', async () => {
    const port = new FakePort();
    await applySeed(port, seedData());
    const key = `${CONTAINERS.costObjects}/${DEMO.project}`;
    const stored = port.objects.get(key)!;
    port.objects.set(key, { value: { ...(stored.value as object), name: 'Changed by hand' }, version: 7 });
    port.writes = [];
    const report = await applySeed(port, seedData());
    expect(report.updated).toEqual([`custom-object ${key}`]);
    expect(port.writes).toEqual([{ op: 'putCustomObject', label: key, version: 7 }]);
  });

  test('an existing resource is left as it is (no drift repair)', async () => {
    const port = new FakePort();
    port.resources.set(`associate-role/${DEMO.roles.buyer}`, { id: 'role-1', draft: { key: DEMO.roles.buyer, permissions: [] } });
    const report = await applySeed(port, seedData());
    expect(report.unchanged).toContain(`associate-role ${DEMO.roles.buyer}`);
    expect(port.resources.get(`associate-role/${DEMO.roles.buyer}`)?.draft).toEqual({ key: DEMO.roles.buyer, permissions: [] });
    expect(logger.log).toHaveBeenCalledWith('info', 'exists', { record: `associate-role ${DEMO.roles.buyer}` });
  });
});

describe('order and references', () => {
  test('roles, customers and units come before what references them; the parent before the division', async () => {
    const port = new FakePort();
    await applySeed(port, seedData());
    const at = (label: string) => port.writes.findIndex((w) => w.label === label);
    expect(at(`associate-role/${DEMO.roles.buyer}`)).toBeLessThan(at(`customer/${DEMO.customers.buyer}`));
    expect(at(`customer/${DEMO.customers.buyer}`)).toBeLessThan(at(`business-unit/${DEMO.company}`));
    expect(at(`business-unit/${DEMO.company}`)).toBeLessThan(at(`business-unit/${DEMO.division}`));
    expect(at(`business-unit/${DEMO.company}`)).toBeLessThan(at(`${DEMO.company}/${DEMO.ruleKey}`));
    const firstCart = port.writes.findIndex((w) => w.label.startsWith('cart/'));
    expect(at(`business-unit/${DEMO.company}`)).toBeLessThan(firstCart);
  });

  test('carts get the customer id; the Approval Rule is created as the admin associate', async () => {
    const port = new FakePort();
    const data = seedData();
    await applySeed(port, data);
    const cart = data.carts[0]!;
    const customerId = port.resources.get(`customer/${cart.customerKey}`)!.id;
    expect(port.resources.get(`cart/${cart.draft.key}`)?.draft).toMatchObject({ customerId });
    const adminId = port.resources.get(`customer/${DEMO.customers.admin}`)!.id;
    expect(port.rules.get(`${DEMO.company}/${DEMO.ruleKey}`)?.associateId).toBe(adminId);
  });

  test('an associate that already exists is looked up for its id', async () => {
    const port = new FakePort();
    port.resources.set(`customer/${DEMO.customers.admin}`, { id: 'admin-existing', draft: {} });
    await applySeed(port, seedData());
    expect(port.rules.get(`${DEMO.company}/${DEMO.ruleKey}`)?.associateId).toBe('admin-existing');
  });
});

describe('preconditions stop the seed before any write', () => {
  test('a missing package Custom Type asks for the service postDeploy', async () => {
    const port = new FakePort();
    port.types.delete('bcc-shopping-list');
    await expect(applySeed(port, seedData())).rejects.toThrow(/bcc-shopping-list.*service postDeploy/);
    expect(port.writes).toEqual([]);
  });

  test('a Custom Object value that core rejects', async () => {
    const port = new FakePort();
    const data = seedData();
    const broken = { ...data, customObjects: [...data.customObjects, { container: CONTAINERS.budgets, key: 'bcc-demo-installer~X', value: { mode: 'never' } }] };
    await expect(applySeed(port, broken)).rejects.toThrow(/bcc-demo-installer~X/);
    expect(port.writes).toEqual([]);
  });
});

test('the coverage record names the seeded rule by id, so rule changes reach it (BCC-APPR-8)', async () => {
  const port = new FakePort();
  await applySeed(port, seedData());
  const rule = await port.findApprovalRule('any', DEMO.company, DEMO.ruleKey);
  const settings = await port.getCustomObject(CONTAINERS.settings, DEMO.company);
  expect((settings?.value as { approval: { ruleId?: string } }).approval.ruleId).toBe(rule?.id);
  port.writes.length = 0;
  await applySeed(port, seedData());
  expect(port.writes).toEqual([]);
});
