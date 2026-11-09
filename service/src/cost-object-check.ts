// Resolve and validate the cost object of a cart, order or quote request.
// [BCC-CART-2] [BCC-CART-3] [BCC-COST-5] [BCC-COST-6] [BCC-COST-7]
import {
  type CostObject,
  isAllowedFor,
  isUsableAt,
  parseRecordKey,
  type Settings,
  type UnitNode,
  validateCostObject,
  visibleCostObjects,
} from 'budgets-cost-centers-core';

export type CostObjectInput = {
  key: string;
  record: unknown | undefined;
  unitKey: string;
  units: UnitNode[];
  customerId?: string;
  at: string;
};

export type CostObjectCheck = { ok: true; costObject: CostObject } | { ok: false; message: string };

const startOf = (date: string) => Date.parse(`${date}T00:00:00.000Z`);
const endOf = (date: string) => Date.parse(`${date}T23:59:59.999Z`);

// The first reason a buyer cannot order against the cost object, as a buyer-readable message.
function usabilityMessage(co: CostObject, at: string): string | null {
  const t = Date.parse(at);
  if (!co.active) return `Cost object ${co.code} is inactive.`;
  if (co.validFrom && t < startOf(co.validFrom)) return `Cost object ${co.code} is valid from ${co.validFrom}.`;
  if (co.validTo && t > endOf(co.validTo)) return `Cost object ${co.code} expired on ${co.validTo}.`;
  if (co.type === 'project' && co.project?.status === 'closed') return `Project ${co.code} is closed and cannot be ordered against.`;
  if (co.type === 'project' && co.project?.status === 'planned') return `Project ${co.code} is planned and not open for orders yet.`;
  return isUsableAt(co, at) ? null : `Cost object ${co.code} cannot be ordered against now.`;
}

export function costObjectProblem(input: CostObjectInput): CostObjectCheck {
  const code = parseRecordKey(input.key)?.code ?? input.key;
  const parsed = input.record === undefined ? null : validateCostObject(input.record);
  if (!parsed?.ok || `${parsed.value.ownerBusinessUnitKey}~${parsed.value.code}` !== input.key) {
    return { ok: false, message: `Cost object ${code} does not exist.` };
  }
  const co = parsed.value;
  if (visibleCostObjects(input.unitKey, input.units, [co]).length === 0) {
    return { ok: false, message: `Cost object ${code} cannot be used in this business unit.` };
  }
  if (!input.customerId || !isAllowedFor(co, input.customerId)) {
    if (co.buyers?.length) return { ok: false, message: `You are not allowed to order against cost object ${code}.` };
  }
  const unusable = usabilityMessage(co, input.at);
  return unusable ? { ok: false, message: unusable } : { ok: true, costObject: co };
}

// The cart's own value wins; otherwise the unit's default applies only when this buyer could order against it.
export function resolveCostObjectKey(input: {
  cartValue?: string;
  settings: Settings;
  defaultRecord: unknown | undefined;
  unitKey: string;
  units: UnitNode[];
  customerId?: string;
  at: string;
}): { key?: string; defaulted: boolean } {
  if (input.cartValue) return { key: input.cartValue, defaulted: false };
  const key = input.settings.defaultCostObject;
  if (!key) return { defaulted: false };
  const check = costObjectProblem({ ...input, key, record: input.defaultRecord });
  return check.ok ? { key, defaulted: true } : { defaulted: false };
}
