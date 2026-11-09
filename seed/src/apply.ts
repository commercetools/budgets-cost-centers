// Applies the seed by key: creates what is absent, upserts Custom Objects only when the value differs, and leaves
// existing resources as they are. A second run writes nothing. [BCC-SEED-2] [BCC-SEED-3] [BCC-APPR-8]
import { isDeepStrictEqual } from 'node:util';
import { CONTAINERS, type Result, validateBudget, validateCostObject, validateSettings } from 'budgets-cost-centers-core';
import { log } from 'budgets-cost-centers-shared';
import type { SeedData } from './data';

export type ResourceKind = 'associate-role' | 'customer' | 'business-unit' | 'cart' | 'shopping-list';
export type StoredObject = { value: unknown; version: number };

export interface SeedPort {
  typeExists(key: string): Promise<boolean>;
  findByKey(kind: ResourceKind, key: string): Promise<{ id: string } | undefined>;
  create(kind: ResourceKind, draft: { key: string }): Promise<{ id: string }>;
  getCustomObject(container: string, key: string): Promise<StoredObject | undefined>;
  putCustomObject(container: string, key: string, value: unknown, version?: number): Promise<void>;
  findApprovalRule(associateId: string, businessUnitKey: string, key: string): Promise<{ id: string } | undefined>;
  createApprovalRule(associateId: string, businessUnitKey: string, draft: { key: string }): Promise<{ id: string }>;
}

export type SeedReport = { created: string[]; updated: string[]; unchanged: string[] };

const VALIDATORS: Record<string, (value: unknown) => Result<unknown>> = {
  [CONTAINERS.costObjects]: validateCostObject,
  [CONTAINERS.budgets]: validateBudget,
  [CONTAINERS.settings]: validateSettings,
};

// Everything that can fail without a write is checked first, so a broken run leaves the project untouched.
async function preflight(port: SeedPort, data: SeedData): Promise<void> {
  const problems: string[] = [];
  for (const o of data.customObjects) {
    const validate = VALIDATORS[o.container];
    const r = validate ? validate(o.value) : null;
    if (!r) problems.push(`${o.container}/${o.key}: unknown container`);
    else if (!r.ok) problems.push(`${o.container}/${o.key}: ${r.errors.map((e) => `${e.field} ${e.message}`).join(' ')}`);
  }
  if (problems.length) throw new Error(`Seed data is invalid: ${problems.join('; ')}`);

  const missing: string[] = [];
  for (const key of data.requiredTypes) if (!(await port.typeExists(key))) missing.push(key);
  if (missing.length) {
    throw new Error(`Custom Types missing: ${missing.join(', ')}. Run the service postDeploy first, then the seed again.`);
  }
}

// A settings record whose coverage names a seeded rule by key also gets the rule's id.
function withRuleId(container: string, key: string, value: unknown, ruleIds: Map<string, string>): unknown {
  if (container !== CONTAINERS.settings || typeof value !== 'object' || value === null) return value;
  const approval = (value as { approval?: { ruleKey?: string } }).approval;
  const id = approval?.ruleKey ? ruleIds.get(`${key}/${approval.ruleKey}`) : undefined;
  return id ? { ...value, approval: { ...approval, ruleId: id } } : value;
}

export async function applySeed(port: SeedPort, data: SeedData): Promise<SeedReport> {
  await preflight(port, data);
  const report: SeedReport = { created: [], updated: [], unchanged: [] };
  const note = (bucket: keyof SeedReport, record: string) => {
    report[bucket].push(record);
    log('info', bucket === 'unchanged' ? 'exists' : bucket, { record });
  };

  const customerIds = new Map<string, string>();
  const ensure = async (kind: ResourceKind, draft: { key: string }): Promise<string> => {
    const label = `${kind} ${draft.key}`;
    const existing = await port.findByKey(kind, draft.key);
    if (existing) {
      note('unchanged', label);
      return existing.id;
    }
    const { id } = await port.create(kind, draft);
    note('created', label);
    return id;
  };
  const customerId = async (key: string): Promise<string> => {
    const known = customerIds.get(key);
    if (known) return known;
    const found = await port.findByKey('customer', key);
    if (!found) throw new Error(`Customer ${key} does not exist.`);
    customerIds.set(key, found.id);
    return found.id;
  };

  for (const r of data.associateRoles) await ensure('associate-role', r);
  for (const c of data.customers) customerIds.set(c.key, await ensure('customer', c));
  // In data order: a parent unit precedes its divisions.
  for (const u of data.businessUnits) await ensure('business-unit', u);

  // Rules come before the settings, so the coverage record can name its rule by id. [BCC-APPR-8]
  const ruleIds = new Map<string, string>();
  for (const rule of data.approvalRules) {
    const label = `approval-rule ${rule.businessUnitKey}/${rule.draft.key}`;
    const asAssociate = await customerId(rule.associateKey);
    const existing = await port.findApprovalRule(asAssociate, rule.businessUnitKey, rule.draft.key);
    if (existing) {
      ruleIds.set(`${rule.businessUnitKey}/${rule.draft.key}`, existing.id);
      note('unchanged', label);
    } else {
      const created = await port.createApprovalRule(asAssociate, rule.businessUnitKey, rule.draft);
      ruleIds.set(`${rule.businessUnitKey}/${rule.draft.key}`, created.id);
      note('created', label);
    }
  }

  for (const o of data.customObjects) {
    const label = `custom-object ${o.container}/${o.key}`;
    const value = withRuleId(o.container, o.key, o.value, ruleIds);
    const stored = await port.getCustomObject(o.container, o.key);
    if (!stored) {
      await port.putCustomObject(o.container, o.key, value);
      note('created', label);
    } else if (!isDeepStrictEqual(stored.value, value)) {
      await port.putCustomObject(o.container, o.key, value, stored.version);
      note('updated', label);
    } else note('unchanged', label);
  }

  for (const cart of data.carts) {
    const label = `cart ${cart.draft.key}`;
    if (await port.findByKey('cart', cart.draft.key)) note('unchanged', label);
    else {
      const draft = { ...cart.draft, customerId: await customerId(cart.customerKey) };
      await port.create('cart', draft);
      note('created', label);
    }
  }
  for (const list of data.shoppingLists) await ensure('shopping-list', list);

  return report;
}
