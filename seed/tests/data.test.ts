// Seed data: fictional and prefixed, covering the e2e flows. [BCC-SEED-1] [BCC-SEED-3]
import type { CartDraft, CompanyDraft, DivisionDraft } from '@commercetools/platform-sdk';
import {
  type Budget,
  CONTAINERS,
  type CostObject,
  type Settings,
  applicableScopes,
  scopeLevel,
  validateBudget,
  validateCostObject,
  validateSettings,
  parseRecordKey,
} from 'budgets-cost-centers-core';
import { DEMO, TYPE_KEYS, seedData } from '../src/data';

const data = seedData();
const AT = '2026-10-30T12:00:00.000Z';

type Visit = (key: string, value: unknown, parent: Record<string, unknown>) => void;
function walk(node: unknown, visit: Visit): void {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      visit(k, v, node as Record<string, unknown>);
      walk(v, visit);
    }
  }
}
const texts = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).filter((x): x is string => typeof x === 'string') : [];

const objects = (container: string) => data.customObjects.filter((o) => o.container === container);
const budgets = () => objects(CONTAINERS.budgets).map((o) => ({ key: o.key, value: o.value as Budget }));
const cartTotal = (draft: Omit<CartDraft, 'customerId'>) =>
  (draft.customLineItems ?? []).reduce((sum, li) => sum + (li.money.centAmount ?? 0) * (li.quantity ?? 1), 0);
const permissionsOf = (roleKey: string) => data.associateRoles.find((r) => r.key === roleKey)?.permissions ?? [];
const hasOrderPermission = (roleKey: string) => permissionsOf(roleKey).some((p) => /Orders/.test(p));

describe('[BCC-SEED-1] fictional and prefixed', () => {
  test('every name, description and last name ends with "(fictional)"', () => {
    const offenders: string[] = [];
    walk(data, (k, v) => {
      if (['name', 'description', 'lastName', 'company'].includes(k)) {
        for (const t of texts(v)) if (!t.endsWith('(fictional)')) offenders.push(`${k}: ${t}`);
      }
    });
    expect(offenders).toEqual([]);
  });

  test('every key starts with bcc-demo-, except references to the package Custom Types', () => {
    const offenders: string[] = [];
    walk(data, (k, v, parent) => {
      if (k === 'key' && typeof v === 'string' && parent.typeId !== 'type' && !v.startsWith('bcc-demo-')) offenders.push(v);
    });
    expect(offenders).toEqual([]);
  });

  test('every email is an example.com address', () => {
    const emails: string[] = [];
    walk(data, (k, v) => {
      if (/email/i.test(k) && typeof v === 'string') emails.push(v);
    });
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.filter((e) => !e.endsWith('@example.com'))).toEqual([]);
  });

  test('customers have no password and authenticate externally', () => {
    for (const c of data.customers) {
      expect(c).not.toHaveProperty('password');
      expect(c.authenticationMode).toBe('ExternalAuth');
    }
  });

  test('the first company is bcc-demo-installer, as in the spec scenario', () => {
    const unit = data.businessUnits.find((u) => u.key === 'bcc-demo-installer');
    expect(unit?.name).toMatch(/\(fictional\)$/);
  });
});

describe('Custom Object values pass core validation', () => {
  test.each(data.customObjects.map((o) => [`${o.container}/${o.key}`, o] as const))('%s', (_label, o) => {
    const r =
      o.container === CONTAINERS.costObjects
        ? validateCostObject(o.value)
        : o.container === CONTAINERS.budgets
          ? validateBudget(o.value)
          : validateSettings(o.value);
    expect(r).toEqual({ ok: true, value: o.value });
  });

  test('cost-object and budget keys follow <owner>~<code>, settings are keyed by unit', () => {
    for (const o of objects(CONTAINERS.costObjects)) {
      const co = o.value as CostObject;
      expect(o.key).toBe(`${co.ownerBusinessUnitKey}~${co.code}`);
    }
    for (const o of objects(CONTAINERS.budgets)) {
      expect(parseRecordKey(o.key)?.ownerBusinessUnitKey).toBe((o.value as Budget).ownerBusinessUnitKey);
    }
    for (const o of objects(CONTAINERS.settings)) expect(data.businessUnits.map((u) => u.key)).toContain(o.key);
  });
});

describe('[BCC-SEED-3] content', () => {
  test('two companies and one division that inherits associates and Approval Rules', () => {
    const companies = data.businessUnits.filter((u): u is CompanyDraft => u.unitType === 'Company');
    const divisions = data.businessUnits.filter((u): u is DivisionDraft => u.unitType === 'Division');
    expect(companies).toHaveLength(2);
    expect(divisions).toHaveLength(1);
    expect(divisions[0]).toMatchObject({
      associateMode: 'ExplicitAndFromParent',
      approvalRuleMode: 'ExplicitAndFromParent',
      parentUnit: { typeId: 'business-unit', key: DEMO.company },
    });
    // A parent must be created before its division.
    expect(data.businessUnits.findIndex((u) => u.key === DEMO.company)).toBeLessThan(data.businessUnits.indexOf(divisions[0]!));
  });

  test('roles with and without order permissions; the site buyer may order but is no requester', () => {
    expect(hasOrderPermission(DEMO.roles.buyer)).toBe(true);
    expect(hasOrderPermission(DEMO.roles.siteBuyer)).toBe(true);
    expect(hasOrderPermission(DEMO.roles.viewer)).toBe(false);
    expect(permissionsOf(DEMO.roles.approver)).toContain('UpdateApprovalFlows');
    expect(permissionsOf(DEMO.roles.admin)).toEqual(expect.arrayContaining(['CreateApprovalRules', 'UpdateApprovalRules']));
    expect(permissionsOf(DEMO.roles.buyer)).toEqual(
      expect.arrayContaining(['CreateMyCarts', 'CreateMyOrdersFromMyCarts', 'CreateMyQuoteRequestsFromMyCarts', 'CreateMyShoppingLists']),
    );
    expect(permissionsOf(DEMO.roles.siteBuyer).sort()).toEqual(permissionsOf(DEMO.roles.buyer).sort());
  });

  test('associates with role assignments reference seeded customers and roles', () => {
    const customerKeys = data.customers.map((c) => c.key);
    const roleKeys = data.associateRoles.map((r) => r.key);
    const assignments = data.businessUnits.flatMap((u) => u.associates ?? []);
    expect(assignments.length).toBeGreaterThanOrEqual(5);
    for (const a of assignments) {
      expect(customerKeys).toContain(a.customer.key);
      for (const r of a.associateRoleAssignments) expect(roleKeys).toContain(r.associateRole.key);
    }
    const heldRoles = new Set(assignments.flatMap((a) => a.associateRoleAssignments.map((r) => r.associateRole.key)));
    expect([...heldRoles].sort()).toEqual([...roleKeys].sort());
  });

  test('cost objects of all three types, the project active with a site address', () => {
    const cos = objects(CONTAINERS.costObjects).map((o) => o.value as CostObject);
    expect(cos.map((c) => c.type).sort()).toEqual(['cost-center', 'project', 'site']);
    const project = cos.find((c) => c.type === 'project');
    expect(project?.project).toMatchObject({ status: 'active', siteAddress: expect.stringMatching(/\(fictional\)$/) });
    expect(`${project?.ownerBusinessUnitKey}~${project?.code}`).toBe(DEMO.project);
  });

  test('two phase carts and a shopping list carry the project', () => {
    const projectCarts = data.carts.filter((c) => c.draft.custom?.fields?.bccCostObject === DEMO.project);
    expect(projectCarts).toHaveLength(2);
    for (const c of projectCarts) {
      expect(c.draft).toMatchObject({
        currency: 'EUR',
        taxMode: 'Disabled',
        businessUnit: { typeId: 'business-unit', key: DEMO.company },
        custom: { type: { typeId: 'type', key: TYPE_KEYS.order } },
      });
      expect(c.draft.lineItems ?? []).toEqual([]);
      expect(data.customers.map((x) => x.key)).toContain(c.customerKey);
    }
    const lists = data.shoppingLists.filter((l) => l.custom?.fields?.bccCostObject === DEMO.project);
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({ custom: { type: { typeId: 'type', key: TYPE_KEYS.shoppingList } } });
    expect(lists[0]?.textLineItems?.length).toBeGreaterThan(0);
    expect(data.requiredTypes.sort()).toEqual([TYPE_KEYS.order, TYPE_KEYS.shoppingList].sort());
  });

  test.each(['approval', 'warn', 'block'] as const)('mode %s has a budget a seeded buyer can exceed with a cart of a seeded size', (mode) => {
    const amounts = data.carts.map((c) => cartTotal(c.draft));
    const hits = budgets().filter(({ key, value }) => {
      if (value.mode !== mode) return false;
      const { scopes } = applicableScopes(
        {
          unitKey: DEMO.company,
          costObjectKey: value.scope.kind === 'cost-object' ? value.scope.ref : undefined,
          customerId: 'buyer-id',
          buyerRoles: [DEMO.roles.buyer],
          currencyCode: 'EUR',
          at: AT,
        },
        budgets(),
      );
      const applies = scopes.some((s) => s.key === key);
      return applies && amounts.some((a) => scopeLevel(value.amount.centAmount, a, value.warnAtPercent) === 'exceeded');
    });
    expect(hits.length).toBeGreaterThan(0);
  });

  test('budget periods are calendar periods from 2026-01-01', () => {
    for (const { value } of budgets()) {
      expect(value.period.from).toBe('2026-01-01');
      expect(value.period.kind).not.toBe('range');
    }
  });

  test('exactly one monthly role limit on the buyer role', () => {
    const limits = budgets().filter(({ value }) => value.scope.kind === 'role');
    expect(limits).toHaveLength(1);
    expect(limits[0]?.value).toMatchObject({ scope: { ref: DEMO.roles.buyer }, period: { kind: 'month' } });
  });

  test('settings of the first company: cost object required, a default, buyer role covered by the rule', () => {
    const s = objects(CONTAINERS.settings).find((o) => o.key === DEMO.company)?.value as Settings;
    expect(s.costObjectRequired).toBe(true);
    expect(objects(CONTAINERS.costObjects).map((o) => o.key)).toContain(s.defaultCostObject);
    expect(s.approval).toEqual({ ruleKey: DEMO.ruleKey, requesterRoles: [DEMO.roles.buyer] });
    expect(s.approval.requesterRoles).not.toContain(DEMO.roles.siteBuyer);
  });

  test('a budget Approval Rule created by the admin associate in the first company', () => {
    expect(data.approvalRules).toHaveLength(1);
    const rule = data.approvalRules[0]!;
    expect(rule.businessUnitKey).toBe(DEMO.company);
    expect(rule.draft).toMatchObject({
      key: DEMO.ruleKey,
      status: 'Active',
      predicate: 'custom.bccBudgetExceeded = true',
      requesters: [{ associateRole: { typeId: 'associate-role', key: DEMO.roles.buyer } }],
      approvers: { tiers: [{ and: [{ or: [{ associateRole: { typeId: 'associate-role', key: DEMO.roles.approver } }] }] }] },
    });
    const admin = data.businessUnits
      .find((u) => u.key === DEMO.company)
      ?.associates?.find((a) => a.customer.key === rule.associateKey);
    expect(admin?.associateRoleAssignments.map((r) => r.associateRole.key)).toContain(DEMO.roles.admin);
  });
});
