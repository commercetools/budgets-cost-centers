// Fictional reference data for a sandbox project, as plain drafts. [BCC-SEED-1] [BCC-SEED-3]
// Every name ends with "(fictional)", every key starts with "bcc-demo-", every email is an example.com address.
import type {
  ApprovalRuleDraft,
  AssociateRoleDraft,
  BaseAddress,
  CartDraft,
  CompanyDraft,
  CustomerDraft,
  CustomLineItemDraft,
  DivisionDraft,
  Permission,
  ShoppingListDraft,
} from '@commercetools/platform-sdk';
import { type Budget, CONTAINERS, type CostObject, DEFAULT_SETTINGS, type Settings } from 'budgets-cost-centers-core';

// Created by the service postDeploy ([BCC-DEPLOY-1]); the seed only references them.
export const TYPE_KEYS = { order: 'bcc-order', shoppingList: 'bcc-shopping-list' } as const;

const company = 'bcc-demo-installer';
const codes = { costCenter: 'CC-4100', project: 'PRJ-1001', site: 'SITE-NORTH' } as const;

export const DEMO = {
  company,
  secondCompany: 'bcc-demo-facility',
  division: 'bcc-demo-installer-south',
  roles: {
    buyer: 'bcc-demo-buyer',
    siteBuyer: 'bcc-demo-site-buyer',
    approver: 'bcc-demo-approver',
    admin: 'bcc-demo-admin',
    viewer: 'bcc-demo-viewer',
  },
  customers: {
    buyer: 'bcc-demo-anna-buyer',
    siteBuyer: 'bcc-demo-ben-site-buyer',
    approver: 'bcc-demo-clara-approver',
    admin: 'bcc-demo-david-admin',
    viewer: 'bcc-demo-eva-viewer',
    otherBuyer: 'bcc-demo-farid-buyer',
  },
  costCenter: `${company}~${codes.costCenter}`,
  project: `${company}~${codes.project}`,
  site: `${company}~${codes.site}`,
  ruleKey: 'bcc-demo-budget-approval',
} as const;

export type SeedCustomObject = { container: string; key: string; value: unknown };
// The customer id is known only after the customer exists, so carts name the customer by key.
export type SeedCart = { customerKey: string; draft: Omit<CartDraft, 'customerId'> & { key: string } };
// Approval Rules exist only in a unit and are created as an associate who holds CreateApprovalRules.
export type SeedApprovalRule = { businessUnitKey: string; associateKey: string; draft: ApprovalRuleDraft & { key: string } };

export type SeedData = {
  requiredTypes: string[];
  associateRoles: Array<AssociateRoleDraft>;
  customers: Array<CustomerDraft & { key: string }>;
  businessUnits: Array<CompanyDraft | DivisionDraft>;
  customObjects: SeedCustomObject[];
  approvalRules: SeedApprovalRule[];
  carts: SeedCart[];
  shoppingLists: Array<ShoppingListDraft & { key: string }>;
};

const BUYER_PERMISSIONS: Permission[] = [
  'ViewMyCarts',
  'CreateMyCarts',
  'UpdateMyCarts',
  'DeleteMyCarts',
  'CreateMyOrdersFromMyCarts',
  'ViewMyOrders',
  'CreateMyQuoteRequestsFromMyCarts',
  'ViewMyQuoteRequests',
  'UpdateMyQuoteRequests',
  'ViewMyQuotes',
  'AcceptMyQuotes',
  'DeclineMyQuotes',
  'CreateMyOrdersFromMyQuotes',
  'ViewMyShoppingLists',
  'CreateMyShoppingLists',
  'UpdateMyShoppingLists',
  'DeleteMyShoppingLists',
];

const role = (key: string, name: string, permissions: Permission[], buyerAssignable = false): AssociateRoleDraft => ({
  key,
  name: `${name} (fictional)`,
  buyerAssignable,
  permissions,
});

const associateRoles = (): AssociateRoleDraft[] => [
  role(DEMO.roles.buyer, 'Budget demo buyer', BUYER_PERMISSIONS, true),
  // Same permissions as the buyer, but no requester of the budget rule: its approval budgets fall back to block.
  role(DEMO.roles.siteBuyer, 'Budget demo site buyer', BUYER_PERMISSIONS, true),
  role(DEMO.roles.approver, 'Budget demo approver', ['UpdateApprovalFlows', 'ViewOthersOrders', 'ViewOthersCarts']),
  role(DEMO.roles.admin, 'Budget demo administrator', [
    'CreateApprovalRules',
    'UpdateApprovalRules',
    'ViewOthersCarts',
    'ViewOthersOrders',
    'ViewOthersQuoteRequests',
    'ViewOthersQuotes',
    'ViewOthersShoppingLists',
  ]),
  role(DEMO.roles.viewer, 'Budget demo viewer', ['ViewMyCarts', 'ViewOthersCarts', 'ViewMyShoppingLists', 'ViewOthersShoppingLists'], true),
];

const customer = (key: string, firstName: string, lastName: string, email: string): CustomerDraft & { key: string } => ({
  key,
  email,
  firstName,
  lastName: `${lastName} (fictional)`,
  authenticationMode: 'ExternalAuth',
});

const customers = () => [
  customer(DEMO.customers.buyer, 'Anna', 'Brook', 'anna.brook@example.com'),
  customer(DEMO.customers.siteBuyer, 'Ben', 'Carter', 'ben.carter@example.com'),
  customer(DEMO.customers.approver, 'Clara', 'Dunmore', 'clara.dunmore@example.com'),
  customer(DEMO.customers.admin, 'David', 'Ellison', 'david.ellison@example.com'),
  customer(DEMO.customers.viewer, 'Eva', 'Fairfax', 'eva.fairfax@example.com'),
  customer(DEMO.customers.otherBuyer, 'Farid', 'Galloway', 'farid.galloway@example.com'),
];

const address = (key: string, companyName: string, streetName: string, postalCode: string, city: string): BaseAddress => ({
  key,
  country: 'DE',
  company: `${companyName} (fictional)`,
  streetName,
  streetNumber: '1',
  postalCode,
  city,
});

const associate = (customerKey: string, roleKey: string, inheritance: 'Enabled' | 'Disabled' = 'Disabled') => ({
  customer: { typeId: 'customer' as const, key: customerKey },
  associateRoleAssignments: [{ associateRole: { typeId: 'associate-role' as const, key: roleKey }, inheritance }],
});

const businessUnits = (): Array<CompanyDraft | DivisionDraft> => [
  {
    unitType: 'Company',
    key: DEMO.company,
    name: 'Brightwell Installers (fictional)',
    contactEmail: 'procurement.brightwell@example.com',
    addresses: [address('bcc-demo-installer-hq', 'Brightwell Installers', 'Sample Street', '99001', 'Exampleton')],
    defaultBillingAddress: 0,
    defaultShippingAddress: 0,
    associates: [
      // Inherited by the division, so the buyer can order there and the approver approves there too.
      associate(DEMO.customers.buyer, DEMO.roles.buyer, 'Enabled'),
      associate(DEMO.customers.approver, DEMO.roles.approver, 'Enabled'),
      associate(DEMO.customers.admin, DEMO.roles.admin),
      associate(DEMO.customers.viewer, DEMO.roles.viewer),
    ],
  },
  {
    unitType: 'Division',
    key: DEMO.division,
    name: 'Brightwell Installers South (fictional)',
    parentUnit: { typeId: 'business-unit', key: DEMO.company },
    associateMode: 'ExplicitAndFromParent',
    approvalRuleMode: 'ExplicitAndFromParent',
    addresses: [address('bcc-demo-installer-south-depot', 'Brightwell Installers South', 'Demo Road', '99002', 'Sampleford')],
    associates: [associate(DEMO.customers.siteBuyer, DEMO.roles.siteBuyer)],
  },
  {
    unitType: 'Company',
    key: DEMO.secondCompany,
    name: 'Kestrel Facility Services (fictional)',
    contactEmail: 'purchasing.kestrel@example.com',
    addresses: [address('bcc-demo-facility-office', 'Kestrel Facility Services', 'Placeholder Avenue', '99003', 'Mockingham')],
    associates: [associate(DEMO.customers.otherBuyer, DEMO.roles.buyer)],
  },
];

const costObjects = (): CostObject[] => [
  {
    code: codes.costCenter,
    name: 'Service vans (fictional)',
    type: 'cost-center',
    ownerBusinessUnitKey: DEMO.company,
    active: true,
    externalId: 'bcc-demo-erp-cc-4100',
  },
  {
    code: codes.project,
    name: 'Riverside school refit (fictional)',
    type: 'project',
    ownerBusinessUnitKey: DEMO.company,
    active: true,
    // No end date, so the seed keeps working in later years.
    validFrom: '2026-01-01',
    project: { status: 'active', siteAddress: '12 Riverside Lane, 99004 Exampleton (fictional)', erpProjectNumber: 'P-77001' },
  },
  {
    code: codes.site,
    name: 'North depot (fictional)',
    type: 'site',
    ownerBusinessUnitKey: DEMO.company,
    active: true,
  },
];

const eur = (euros: number) => ({ currencyCode: 'EUR', centAmount: Math.round(euros * 100) });

// Calendar periods from 2026-01-01 without an end, so the data stays valid in later years.
const budget = (scope: Budget['scope'], euros: number, kind: 'month' | 'quarter' | 'year', mode: Budget['mode']): Budget => ({
  scope,
  ownerBusinessUnitKey: DEMO.company,
  amount: eur(euros),
  period: { kind, from: '2026-01-01' },
  mode,
  warnAtPercent: 80,
  active: true,
});

// The phase carts total EUR 1,200 and EUR 3,400 on PRJ-1001. Each mode has a budget a seeded buyer can exceed with a
// cart of that size on the budget's own cost object; the e2e flows move a cart to the cost object they test.
const budgets = (): Array<{ code: string; value: Budget }> => [
  { code: 'BUD-CC-4100', value: budget({ kind: 'cost-object', ref: DEMO.costCenter }, 1000, 'quarter', 'approval') },
  { code: 'BUD-SITE-NORTH', value: budget({ kind: 'cost-object', ref: DEMO.site }, 1000, 'month', 'warn') },
  { code: 'BUD-PRJ-1001', value: budget({ kind: 'cost-object', ref: DEMO.project }, 3000, 'year', 'block') },
  { code: 'BUD-UNIT', value: budget({ kind: 'business-unit', ref: DEMO.company }, 100000, 'year', 'approval') },
  { code: 'LIMIT-BUYER', value: budget({ kind: 'role', ref: DEMO.roles.buyer }, 2500, 'month', 'approval') },
];

const settings = (): Settings => ({
  ...DEFAULT_SETTINGS,
  defaultMode: 'approval',
  costObjectRequired: true,
  defaultCostObject: DEMO.costCenter,
  features: { projects: true },
  // No checkedAt: a fixed time would change the record on every run; the view's rule check sets it.
  approval: { ruleKey: DEMO.ruleKey, requesterRoles: [DEMO.roles.buyer] },
});

const customObjects = (): SeedCustomObject[] => [
  ...costObjects().map((value) => ({ container: CONTAINERS.costObjects, key: `${value.ownerBusinessUnitKey}~${value.code}`, value })),
  ...budgets().map(({ code, value }) => ({ container: CONTAINERS.budgets, key: `${value.ownerBusinessUnitKey}~${code}`, value })),
  { container: CONTAINERS.settings, key: DEMO.company, value: settings() },
];

const roleRef = (key: string) => ({ associateRole: { typeId: 'associate-role' as const, key } });

const approvalRules = (): SeedApprovalRule[] => [
  {
    businessUnitKey: DEMO.company,
    associateKey: DEMO.customers.admin,
    draft: {
      key: DEMO.ruleKey,
      name: 'Budget exceeded (fictional)',
      description: 'Orders over a budget or spend limit need approval (fictional)',
      status: 'Active',
      predicate: 'custom.bccBudgetExceeded = true',
      requesters: [roleRef(DEMO.roles.buyer)],
      approvers: { tiers: [{ and: [{ or: [roleRef(DEMO.roles.approver)] }] }] },
    },
  },
];

const item = (key: string, name: string, euros: number, quantity: number): CustomLineItemDraft => ({
  key,
  name: { en: `${name} (fictional)` },
  slug: key,
  quantity,
  money: eur(euros),
});

const projectFields = (typeKey: string) => ({ type: { typeId: 'type' as const, key: typeKey }, fields: { bccCostObject: DEMO.project } });

const phaseCart = (key: string, customLineItems: CustomLineItemDraft[]): SeedCart => ({
  customerKey: DEMO.customers.buyer,
  draft: {
    key,
    currency: 'EUR',
    country: 'DE',
    taxMode: 'Disabled',
    businessUnit: { typeId: 'business-unit', key: DEMO.company },
    customLineItems,
    // The project retention, so the Extension does not need to raise it ([BCC-PROJ-3]).
    deleteDaysAfterLastModification: 365,
    custom: projectFields(TYPE_KEYS.order),
  },
});

const carts = (): SeedCart[] => [
  // EUR 1,200
  phaseCart('bcc-demo-prj-1001-phase-1', [
    item('bcc-demo-cable-trays', 'Cable trays, phase 1', 250, 3),
    item('bcc-demo-junction-boxes', 'Junction boxes, phase 1', 45, 10),
  ]),
  // EUR 3,400
  phaseCart('bcc-demo-prj-1001-phase-2', [
    item('bcc-demo-distribution-boards', 'Distribution boards, phase 2', 1200, 2),
    item('bcc-demo-installation-cable', 'Installation cable 500 m, phase 2', 250, 4),
  ]),
];

const shoppingLists = (): Array<ShoppingListDraft & { key: string }> => [
  {
    key: 'bcc-demo-prj-1001-material',
    name: { en: 'Riverside school refit material (fictional)' },
    description: { en: 'Material list for all phases of the project (fictional)' },
    customer: { typeId: 'customer', key: DEMO.customers.buyer },
    businessUnit: { typeId: 'business-unit', key: DEMO.company },
    textLineItems: [
      { key: 'bcc-demo-emergency-lights', name: { en: 'Emergency lights (fictional)' }, quantity: 24 },
      { key: 'bcc-demo-cable-ties', name: { en: 'Cable ties, 1000 pieces (fictional)' }, quantity: 5 },
    ],
    custom: projectFields(TYPE_KEYS.shoppingList),
  },
];

export function seedData(): SeedData {
  return {
    requiredTypes: [TYPE_KEYS.order, TYPE_KEYS.shoppingList],
    associateRoles: associateRoles(),
    customers: customers(),
    businessUnits: businessUnits(),
    customObjects: customObjects(),
    approvalRules: approvalRules(),
    carts: carts(),
    shoppingLists: shoppingLists(),
  };
}
