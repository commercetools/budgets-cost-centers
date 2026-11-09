// The platform calls the service needs, as a port so domain flows are tested without a project.
// [BCC-CART-4] [BCC-CART-9] [BCC-QUOTE-1] [BCC-QUOTE-2]
import type { OrderLike, PricedLike } from 'budgets-cost-centers-core';

export type RoleAssignment = { associateRole: { key: string } };
export type AssociateLike = { customer: { id: string }; associateRoleAssignments: RoleAssignment[] };
export type BusinessUnitLike = {
  key: string;
  parentUnit?: { key: string };
  approvalRuleMode?: 'Explicit' | 'ExplicitAndFromParent';
  associates: AssociateLike[];
  inheritedAssociates?: AssociateLike[];
};
export type StoredRecord = { key: string; value: unknown };
export type CustomLike = { type: { id: string }; fields: Record<string, unknown> };
export type CartLike = PricedLike & {
  id: string;
  customerId?: string;
  businessUnit?: { key: string };
  custom?: CustomLike;
  deleteDaysAfterLastModification?: number;
};
export type QuoteLike = { custom?: CustomLike };

export interface ServicePlatform {
  getBusinessUnit(key: string): Promise<BusinessUnitLike | undefined>;
  getCustomObjects(container: string, keys: string[]): Promise<StoredRecord[]>;
  queryBudgets(ownerKeys: string[]): Promise<StoredRecord[]>;
  // All pages.
  queryOrders(where: string): Promise<OrderLike[]>;
  getCart(id: string): Promise<CartLike | undefined>;
  getQuote(id: string): Promise<QuoteLike | undefined>;
  typeIdByKey(key: string): Promise<string | undefined>;
}
