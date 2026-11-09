// Project overview: what carries the project key, with totals; project fields. [BCC-PROJ-1] [BCC-PROJ-2]
// [BCC-PROJ-4] [BCC-VIEW-6]
import type { Budget, CostObject } from '../core';
import {
  applyProjectFields,
  projectBudgets,
  projectItems,
  projectWhere,
} from './project';

const money = (centAmount: number) => ({ currencyCode: 'EUR', centAmount });

describe('projectWhere', () => {
  it('matches the project key, and only active carts', () => {
    expect(projectWhere('unit-a~PRJ-1001', 'order')).toBe(
      'custom(fields(bccCostObject="unit-a~PRJ-1001"))'
    );
    expect(projectWhere('unit-a~PRJ-1001', 'cart')).toBe(
      'custom(fields(bccCostObject="unit-a~PRJ-1001")) and cartState="Active"'
    );
  });
});

describe('projectItems', () => {
  it('lists one shopping list, two carts, one quote request, one quote and an order with their totals', () => {
    const items = projectItems({
      shoppingLists: [
        {
          id: 'sl-1',
          name: { en: 'Material list (fictional)' },
          lineItems: [{}, {}],
        },
      ],
      carts: [
        {
          id: 'cart-2',
          key: 'phase-2',
          totalPrice: money(2000),
          lineItems: [{}],
        },
        {
          id: 'cart-1',
          totalPrice: money(1190),
          taxedPrice: { totalNet: money(1000) },
          lineItems: [],
        },
      ],
      quoteRequests: [
        {
          id: 'qr-1',
          quoteRequestState: 'Submitted',
          totalPrice: money(500),
          lineItems: [],
        },
      ],
      quotes: [
        {
          id: 'q-1',
          key: 'Q-1',
          quoteState: 'Pending',
          totalPrice: money(400),
          lineItems: [],
        },
      ],
      orders: [
        {
          id: 'o-1',
          orderNumber: 'N-1',
          orderState: 'Open',
          totalPrice: money(300),
          lineItems: [{}],
        },
      ],
    });
    expect(items).toEqual([
      {
        kind: 'shopping-list',
        id: 'sl-1',
        label: 'Material list (fictional)',
        lineItemCount: 2,
      },
      {
        kind: 'cart',
        id: 'cart-1',
        label: 'cart-1',
        lineItemCount: 0,
        total: money(1000),
      },
      {
        kind: 'cart',
        id: 'cart-2',
        label: 'phase-2',
        lineItemCount: 1,
        total: money(2000),
      },
      {
        kind: 'quote-request',
        id: 'qr-1',
        label: 'qr-1',
        state: 'Submitted',
        lineItemCount: 0,
        total: money(500),
      },
      {
        kind: 'quote',
        id: 'q-1',
        label: 'Q-1',
        state: 'Pending',
        lineItemCount: 0,
        total: money(400),
      },
      {
        kind: 'order',
        id: 'o-1',
        label: 'N-1',
        state: 'Open',
        lineItemCount: 1,
        total: money(300),
      },
    ]);
  });
});

describe('projectBudgets', () => {
  it('keeps the active cost-object budgets of the project', () => {
    const b = (ref: string, active = true): Budget => ({
      scope: { kind: 'cost-object', ref },
      ownerBusinessUnitKey: 'unit-a',
      amount: money(100),
      period: { kind: 'year', from: '2026-01-01' },
      mode: 'warn',
      warnAtPercent: 80,
      active,
    });
    const records = [
      { key: 'unit-a~p', version: 1, value: b('unit-a~PRJ-1') },
      { key: 'unit-a~q', version: 1, value: b('unit-a~PRJ-2') },
      { key: 'unit-a~r', version: 1, value: b('unit-a~PRJ-1', false) },
    ];
    expect(projectBudgets('unit-a~PRJ-1', records).map((r) => r.key)).toEqual([
      'unit-a~p',
    ]);
  });
});

describe('applyProjectFields', () => {
  it('sets status, site address and ERP number, and removes empty ones', () => {
    const co: CostObject = {
      code: 'PRJ-1',
      name: 'Harbour Hall (fictional)',
      type: 'project',
      ownerBusinessUnitKey: 'unit-a',
      active: true,
      project: { status: 'active', siteAddress: 'Old Road 1' },
    };
    expect(
      applyProjectFields(co, {
        status: 'closed',
        siteAddress: ' ',
        erpProjectNumber: 'ERP-9',
      })
    ).toEqual({
      ...co,
      project: { status: 'closed', erpProjectNumber: 'ERP-9' },
    });
  });
});
