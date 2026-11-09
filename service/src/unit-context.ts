// The cart unit's chain, settings, Approval Rule coverage and the buyer's roles. [BCC-SET-2] [BCC-APPR-2] [BCC-CART-4]
import { CONTAINERS, coveredRoles, effectiveSettings, type Settings, type UnitNode, validateSettings } from 'budgets-cost-centers-core';
import type { AssociateLike, BusinessUnitLike, ServicePlatform } from './platform';

// Business Units nest at most 5 levels (https://docs.commercetools.com/api/limits); one more guards against cycles.
const MAX_LEVELS = 6;

export type UnitContext = {
  unitKey: string;
  units: UnitNode[];
  settings: Record<string, Settings>;
  effective: Settings;
  covered: string[];
  rolesOf(customerId?: string): string[];
};

const rolesIn = (associates: AssociateLike[] | undefined, customerId: string) =>
  (associates ?? []).filter((a) => a.customer.id === customerId).flatMap((a) => a.associateRoleAssignments.map((r) => r.associateRole.key));

export async function loadUnitContext(platform: ServicePlatform, unitKey: string): Promise<UnitContext> {
  const first = await platform.getBusinessUnit(unitKey);
  if (!first) throw new Error(`Business Unit ${unitKey} not found`);

  const units: UnitNode[] = [];
  const seen = new Set<string>();
  for (let u: BusinessUnitLike | undefined = first; u && !seen.has(u.key) && units.length < MAX_LEVELS; ) {
    seen.add(u.key);
    units.push({
      key: u.key,
      ...(u.parentUnit ? { parentKey: u.parentUnit.key } : {}),
      ...(u.approvalRuleMode ? { approvalRuleMode: u.approvalRuleMode } : {}),
    });
    const parentKey: string | undefined = u.parentUnit?.key;
    u = parentKey && !seen.has(parentKey) ? await platform.getBusinessUnit(parentKey) : undefined;
  }

  const settings: Record<string, Settings> = {};
  for (const r of await platform.getCustomObjects(CONTAINERS.settings, units.map((u) => u.key))) {
    const parsed = validateSettings(r.value);
    if (!parsed.ok) throw new Error(`Invalid settings record ${r.key}`);
    settings[r.key] = parsed.value;
  }

  return {
    unitKey,
    units,
    settings,
    effective: effectiveSettings(unitKey, units, settings),
    covered: coveredRoles(unitKey, units, settings),
    rolesOf: (customerId) =>
      customerId ? [...new Set([...rolesIn(first.associates, customerId), ...rolesIn(first.inheritedAssociates, customerId)])] : [],
  };
}
