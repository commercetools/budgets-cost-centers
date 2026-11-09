// Business Unit hierarchy: cost-object visibility, settings resolution and Approval Rule coverage.
// [BCC-COST-5] [BCC-SET-2] [BCC-APPR-2]
import type { CostObject } from './cost-object';
import { DEFAULT_SETTINGS, type Settings } from './settings';

export type UnitNode = { key: string; parentKey?: string; approvalRuleMode?: 'Explicit' | 'ExplicitAndFromParent' };

export function unitChain(unitKey: string, units: UnitNode[]): UnitNode[] {
  const byKey = new Map(units.map((u) => [u.key, u]));
  const chain: UnitNode[] = [];
  const seen = new Set<string>();
  for (let u = byKey.get(unitKey); u && !seen.has(u.key); u = u.parentKey ? byKey.get(u.parentKey) : undefined) {
    seen.add(u.key);
    chain.push(u);
  }
  return chain;
}

export function visibleCostObjects(unitKey: string, units: UnitNode[], costObjects: CostObject[]): CostObject[] {
  const owners = new Set(unitChain(unitKey, units).map((u) => u.key));
  return costObjects.filter(
    (co) => owners.has(co.ownerBusinessUnitKey) && (co.linkedBusinessUnitKey === undefined || co.linkedBusinessUnitKey === unitKey),
  );
}

export function effectiveSettings(unitKey: string, units: UnitNode[], records: Record<string, Settings>): Settings {
  for (const u of unitChain(unitKey, units)) {
    const s = records[u.key];
    if (s) return s;
  }
  return DEFAULT_SETTINGS;
}

// Coverage follows the platform's rule inheritance, not settings inheritance: a unit's own coverage record counts,
// and its parent's coverage only while the unit inherits Approval Rules (`ExplicitAndFromParent`).
export function coveredRoles(unitKey: string, units: UnitNode[], records: Record<string, Settings>): string[] {
  const roles: string[] = [];
  for (const u of unitChain(unitKey, units)) {
    for (const r of records[u.key]?.approval.requesterRoles ?? []) if (!roles.includes(r)) roles.push(r);
    if (u.approvalRuleMode !== 'ExplicitAndFromParent') break;
  }
  return roles;
}
