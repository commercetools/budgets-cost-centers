// Consumption computed live from orders. [BCC-SPEND-1] [BCC-SPEND-2] [BCC-SPEND-3]
import type { Money } from './money';
import type { Interval } from './period';
import type { ApplicableScope, CheckContext } from './scopes';

export type PricedLike = { totalPrice: Money; taxedPrice?: { totalNet: Money } };

export type OrderLike = PricedLike & {
  id: string;
  createdAt: string;
  orderState: string;
  customerId?: string;
  businessUnit?: { key: string };
  custom?: { fields: Record<string, unknown> };
};

// Net amount: taxedPrice.totalNet when the platform has calculated tax, else totalPrice.
export const amountOf = (x: PricedLike): Money => x.taxedPrice?.totalNet ?? x.totalPrice;

// Created in the interval, not cancelled, approval not rejected. Currency and scope are checked separately.
export function isCountableOrder(order: OrderLike, interval: Interval): boolean {
  const t = Date.parse(order.createdAt);
  if (Number.isNaN(t) || t < Date.parse(interval.from) || t > Date.parse(interval.to)) return false;
  return order.orderState !== 'Cancelled' && order.custom?.fields.bccApprovalStatus !== 'rejected';
}

export function countsToward(order: OrderLike, scope: ApplicableScope, ctx: CheckContext): boolean {
  const { budget, interval } = scope;
  if (!isCountableOrder(order, interval)) return false;
  if (amountOf(order).currencyCode !== budget.amount.currencyCode) return false;

  const unitKey = order.businessUnit?.key;
  switch (budget.scope.kind) {
    case 'cost-object':
      return order.custom?.fields.bccCostObject === budget.scope.ref;
    case 'business-unit':
      return unitKey === budget.scope.ref;
    case 'role':
    case 'associate':
      return unitKey === budget.ownerBusinessUnitKey && order.customerId === ctx.customerId;
  }
}

export function consumed(orders: OrderLike[], scope: ApplicableScope, ctx: CheckContext): { amount: Money; orderCount: number } {
  let centAmount = 0;
  let orderCount = 0;
  for (const o of orders) {
    if (!countsToward(o, scope, ctx)) continue;
    centAmount += amountOf(o).centAmount;
    orderCount += 1;
  }
  return { amount: { currencyCode: scope.budget.amount.currencyCode, centAmount }, orderCount };
}

// Carts never count as consumption; only the cart under check is added.
export const projected = (consumedAmount: Money, cart: PricedLike): Money => ({
  currencyCode: consumedAmount.currencyCode,
  centAmount: consumedAmount.centAmount + amountOf(cart).centAmount,
});
