// Approval Rule check and setup for a unit: the active budget rules, roles that may order but are no requester, the
// coverage record for the settings, its staleness, the rule draft and the associates the view may act for.
// [BCC-APPR-1] [BCC-APPR-2] [BCC-APPR-3] [BCC-APPR-4]
// https://docs.commercetools.com/api/projects/approval-rules
import { isBudgetPredicate, type Settings } from '../core';
import type { ViewFieldError } from './errors';
import messages from './messages';
import type { Person } from './people';
import type { SettingsDraft } from './settings';

export const BUDGET_PREDICATE = 'custom.bccBudgetExceeded = true';

type RoleRef = { associateRole: { key: string } };

export type RuleLike = {
  id: string;
  key?: string;
  version: number;
  name: string;
  status: string;
  predicate: string;
  requesters: RoleRef[];
  approvers: { tiers: Array<{ and: Array<{ or: RoleRef[] }> }> };
  lastModifiedAt: string;
};

export type RoleLike = { key: string; name?: string; permissions: string[] };

// The check lists every active rule that mentions the budget flag [BCC-APPR-3]; only those whose predicate is exactly
// the flag count as coverage, as core decides [BCC-APPR-1].
const mentionsBudgetFlag = (predicate: string) =>
  /\bbccBudgetExceeded\b/.test(predicate);

export const budgetRules = <R extends RuleLike>(rules: R[]): R[] =>
  rules.filter((r) => r.status === 'Active' && mentionsBudgetFlag(r.predicate));

export const countsAsCoverage = (r: RuleLike): boolean =>
  r.status === 'Active' && isBudgetPredicate(r.predicate);

export const coveringRules = <R extends RuleLike>(rules: R[]): R[] =>
  rules.filter(countsAsCoverage);

export const ruleRef = (r: RuleLike) => r.key ?? r.id;

// The permissions that let an associate place an order, own cart or someone else's.
export const ORDER_PERMISSIONS = [
  'CreateMyOrdersFromMyCarts',
  'CreateOrdersFromOthersCarts',
];

// Roles that may place orders; restricted to the roles held in the unit when given.
export function orderingRoles(roles: RoleLike[], inUse?: string[]): string[] {
  return roles
    .filter((r) => !inUse || inUse.includes(r.key))
    .filter((r) => r.permissions.some((p) => ORDER_PERMISSIONS.includes(p)))
    .map((r) => r.key)
    .sort();
}

const requesterRolesOf = (rules: RuleLike[]): string[] =>
  [
    ...new Set(
      coveringRules(rules).flatMap((r) =>
        r.requesters.map((q) => q.associateRole.key)
      )
    ),
  ].sort();

// `inherited`: roles the parent's coverage holds while the unit inherits Approval Rules, as core's coveredRoles() counts
// them [BCC-APPR-2].
export const missingRequesters = (
  ordering: string[],
  rules: RuleLike[],
  inherited: string[] = []
): string[] => {
  const covered = [...requesterRolesOf(rules), ...inherited];
  return ordering.filter((r) => !covered.includes(r));
};

export type Coverage = Settings['approval'];

const latest = (times: string[]): string =>
  times.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));

// `now` is the time of the write. The check is dated no earlier than the newest rule change it saw, so a rule created
// or changed just before (or by a server clock ahead of the browser) does not read as changed after the check.
export function coverageFrom(rules: RuleLike[], now: string): Coverage {
  const first = [...coveringRules(rules)].sort((a, b) =>
    ruleRef(a).localeCompare(ruleRef(b), 'en')
  )[0];
  return {
    ...(first ? { ruleKey: ruleRef(first), ruleId: first.id } : {}),
    requesterRoles: requesterRolesOf(rules),
    checkedAt: latest([now, ...rules.map((r) => r.lastModifiedAt)]),
  };
}

export type StaleReason =
  | 'never-checked'
  | 'rule-missing'
  | 'rule-inactive'
  | 'rule-not-exact'
  | 'rule-changed'
  | 'requesters-changed';

// The coverage record is what the cart check trusts; it goes stale when the rule changes after the check.
export function coverageStatus(
  approval: Coverage,
  rules: RuleLike[]
): { stale: boolean; reasons: StaleReason[] } {
  if (!approval.checkedAt) return { stale: true, reasons: ['never-checked'] };
  const reasons: StaleReason[] = [];
  const checkedAt = Date.parse(approval.checkedAt);
  if (approval.ruleKey || approval.ruleId) {
    const rule = approval.ruleId
      ? rules.find((r) => r.id === approval.ruleId)
      : rules.find((r) => ruleRef(r) === approval.ruleKey);
    if (!rule) reasons.push('rule-missing');
    else {
      if (rule.status !== 'Active') reasons.push('rule-inactive');
      else if (!countsAsCoverage(rule)) reasons.push('rule-not-exact');
      if (Date.parse(rule.lastModifiedAt) > checkedAt)
        reasons.push('rule-changed');
    }
  }
  const now = requesterRolesOf(rules);
  const recorded = [...approval.requesterRoles].sort();
  if (now.join('\n') !== recorded.join('\n'))
    reasons.push('requesters-changed');
  return { stale: reasons.length > 0, reasons };
}

// Associates the view may act for: those holding the permission through a role in the unit.
export function peopleWith(
  permission: string,
  people: Person[],
  roles: RoleLike[]
): Person[] {
  const granting = new Set(
    roles.filter((r) => r.permissions.includes(permission)).map((r) => r.key)
  );
  return people.filter((p) => p.roles.some((r) => granting.has(r)));
}

export type RuleSetup = { requesterRoles: string[]; approverTiers: string[][] };

const roleRef = (key: string) => ({
  associateRole: { typeId: 'associate-role' as const, key },
});

// An ApprovalRuleDraft: one tier per entry, any role of a tier may approve.
export function ruleDraft(unitKey: string, setup: RuleSetup) {
  const errors: ViewFieldError[] = [];
  if (!setup.requesterRoles.length)
    errors.push({ field: 'requesters', message: messages.requesterMissing });
  if (
    !setup.approverTiers.length ||
    setup.approverTiers.length > 5 ||
    setup.approverTiers.some((t) => !t.length)
  )
    errors.push({ field: 'approvers', message: messages.tiersInvalid });
  if (errors.length) return { ok: false as const, errors };
  return {
    ok: true as const,
    value: {
      key: `bcc-budget-${unitKey}`
        .replace(/[^A-Za-z0-9_-]/g, '-')
        .slice(0, 256),
      name: 'Budget approval (Budgets & Cost Centers)',
      status: 'Active' as const,
      predicate: BUDGET_PREDICATE,
      requesters: setup.requesterRoles.map(roleRef),
      approvers: {
        tiers: setup.approverTiers.map((tier) => ({
          and: [{ or: tier.map(roleRef) }],
        })),
      },
    },
  };
}

// The unit's full settings record with the new coverage; a unit without its own record starts from the effective one.
export const settingsWithCoverage = (
  draft: SettingsDraft,
  coverage: Coverage
): Settings => ({ ...draft.value, approval: coverage });

export const ruleSummary = (r: RuleLike) => ({
  ref: ruleRef(r),
  requesters: r.requesters.map((q) => q.associateRole.key),
  tiers: r.approvers.tiers.map((t) =>
    t.and.flatMap((d) => d.or.map((a) => a.associateRole.key))
  ),
});

export const rolesInUse = (people: Person[]): string[] =>
  [...new Set(people.flatMap((p) => p.roles))].sort();
