// Which Approval Rules count as budget coverage and how rule changes alter it. [BCC-APPR-1] [BCC-APPR-3] [BCC-APPR-8]
import { isRecord } from './check';
import type { Settings } from './settings';
// Only a rule whose predicate is exactly the budget flag holds every over-budget order; a rule with further
// conditions lets over-budget orders through when they do not match, so it must not count as coverage.

const EXACT = /^custom\.bccBudgetExceeded\s*=\s*true$/;

export function isBudgetPredicate(predicate: string): boolean {
  let p = predicate.trim();
  while (p.startsWith('(') && p.endsWith(')')) p = p.slice(1, -1).trim();
  return EXACT.test(p);
}

// Coverage follows changes made to the rule anywhere, never growing from a change alone. [BCC-APPR-8]
// https://docs.commercetools.com/api/projects/messages/approval-rule-approval-flow-messages

export type RuleChange =
  | { type: 'ApprovalRuleStatusSet'; ruleId: string; status: string; at: string }
  | { type: 'ApprovalRulePredicateSet'; ruleId: string; predicate: string; at: string }
  | { type: 'ApprovalRuleRequestersSet'; ruleId: string; requesterRoles: string[]; at: string };

export const RULE_CHANGE_TYPES = ['ApprovalRuleStatusSet', 'ApprovalRulePredicateSet', 'ApprovalRuleRequestersSet'] as const;

export function toRuleChange(message: unknown): RuleChange | undefined {
  if (!isRecord(message) || !isRecord(message.resource) || typeof message.resource.id !== 'string') return undefined;
  const ruleId = message.resource.id;
  const at = typeof message.createdAt === 'string' ? message.createdAt : new Date(0).toISOString();
  if (message.type === 'ApprovalRuleStatusSet' && typeof message.status === 'string') {
    return { type: message.type, ruleId, status: message.status, at };
  }
  if (message.type === 'ApprovalRulePredicateSet' && typeof message.predicate === 'string') {
    return { type: message.type, ruleId, predicate: message.predicate, at };
  }
  if (message.type === 'ApprovalRuleRequestersSet' && Array.isArray(message.requesters)) {
    const requesterRoles = message.requesters
      .map((r) => (isRecord(r) && isRecord(r.associateRole) && typeof r.associateRole.key === 'string' ? r.associateRole.key : undefined))
      .filter((k): k is string => k !== undefined);
    return { type: message.type, ruleId, requesterRoles, at };
  }
  return undefined;
}

// The new coverage, or undefined when nothing changes.
export function coverageAfterRuleChange(approval: Settings['approval'], change: RuleChange): Settings['approval'] | undefined {
  if (approval.ruleId !== change.ruleId || approval.requesterRoles.length === 0) return undefined;
  let roles: string[] | undefined;
  if (change.type === 'ApprovalRuleStatusSet' && change.status !== 'Active') roles = [];
  if (change.type === 'ApprovalRulePredicateSet' && !isBudgetPredicate(change.predicate)) roles = [];
  if (change.type === 'ApprovalRuleRequestersSet') roles = change.requesterRoles;
  if (roles === undefined || (roles.length === approval.requesterRoles.length && roles.every((r) => approval.requesterRoles.includes(r)))) return undefined;
  return { ...approval, requesterRoles: roles, checkedAt: change.at };
}
