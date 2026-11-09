// Associates of a unit with the roles they hold there, own and inherited. [BCC-VIEW-2] [BCC-VIEW-3] [BCC-BUDGET-8]
// [BCC-APPR-4]
// https://docs.commercetools.com/api/projects/business-units#associate
export type Person = { customerId: string; label: string; roles: string[] };

type Assignment = { associateRole: { key: string } };
export type UnitAssociates = {
  associates?: Array<{
    customer: { id: string };
    associateRoleAssignments: Assignment[];
  }>;
  inheritedAssociates?: Array<{
    customer: { id: string };
    associateRoleAssignments: Assignment[];
  }>;
};

export type CustomerLike = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

function labelOf(c: CustomerLike | undefined, id: string): string {
  if (!c) return id;
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  if (name && c.email) return `${name} (${c.email})`;
  return name || c.email || id;
}

// Role keys per customer, the inherited ones included, as core expects for buyerRoles.
export function peopleOf(
  unit: UnitAssociates,
  customers: CustomerLike[]
): Person[] {
  const roles = new Map<string, Set<string>>();
  for (const a of [
    ...(unit.associates ?? []),
    ...(unit.inheritedAssociates ?? []),
  ]) {
    const set = roles.get(a.customer.id) ?? new Set<string>();
    for (const r of a.associateRoleAssignments) set.add(r.associateRole.key);
    roles.set(a.customer.id, set);
  }
  const byId = new Map(customers.map((c) => [c.id, c]));
  return [...roles.entries()]
    .map(([customerId, set]) => ({
      customerId,
      label: labelOf(byId.get(customerId), customerId),
      roles: [...set].sort(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

export const holdersOf = (roleKey: string, people: Person[]): string[] =>
  people.filter((p) => p.roles.includes(roleKey)).map((p) => p.customerId);
