// Consumption per budget: period in effect, bar percent and level, other-currency hint, order predicate.
// [BCC-VIEW-4] [BCC-SPEND-1] [BCC-SPEND-2] [BCC-BUDGET-6] [BCC-BUDGET-8]
import type { Budget, OrderLike } from '../core';
import {
  applicableHolders,
  budgetConsumption,
  consumptionWhere,
  scopeOrdersWhere,
} from './consumption';

const NOW = '2026-11-15T10:00:00.000Z';
const budget = (over: Partial<Budget> = {}): Budget => ({
  scope: { kind: 'business-unit', ref: 'unit-a' },
  ownerBusinessUnitKey: 'unit-a',
  amount: { currencyCode: 'EUR', centAmount: 100000 },
  period: { kind: 'month', from: '2026-01-01' },
  mode: 'warn',
  warnAtPercent: 80,
  active: true,
  ...over,
});

const order = (
  cents: number,
  over: Partial<OrderLike> = {},
  currencyCode = 'EUR'
): OrderLike => ({
  id: `o-${cents}-${currencyCode}`,
  createdAt: '2026-11-03T10:00:00.000Z',
  orderState: 'Open',
  customerId: 'c-1',
  businessUnit: { key: 'unit-a' },
  totalPrice: { currencyCode, centAmount: cents },
  ...over,
});

describe('budgetConsumption', () => {
  it('shows 850 of 1,000 EUR as 85 % at warning level', () => {
    const c = budgetConsumption(budget(), [order(50000), order(35000)], NOW);
    expect(c.interval).toEqual({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-30T23:59:59.999Z',
    });
    expect(c.lines).toEqual([
      {
        consumed: { currencyCode: 'EUR', centAmount: 85000 },
        remaining: { currencyCode: 'EUR', centAmount: 15000 },
        amount: { currencyCode: 'EUR', centAmount: 100000 },
        percent: 85,
        level: 'warn',
        orderCount: 2,
        otherCurrencyOrders: 0,
      },
    ]);
  });

  it('is ok below the threshold and exceeded above the amount', () => {
    expect(
      budgetConsumption(budget(), [order(10000)], NOW).lines[0]?.level
    ).toBe('ok');
    const over = budgetConsumption(budget(), [order(120000)], NOW).lines[0];
    expect(over).toEqual(
      expect.objectContaining({
        level: 'exceeded',
        percent: 120,
        remaining: { currencyCode: 'EUR', centAmount: -20000 },
      })
    );
  });

  it('counts orders in another currency only as a hint', () => {
    const c = budgetConsumption(
      budget(),
      [
        order(10000),
        order(5000, {}, 'USD'),
        order(5000, { orderState: 'Cancelled' }, 'USD'),
      ],
      NOW
    );
    expect(c.lines[0]).toEqual(
      expect.objectContaining({ orderCount: 1, otherCurrencyOrders: 1 })
    );
  });

  it('excludes cancelled and rejected orders and orders outside the period', () => {
    const c = budgetConsumption(
      budget(),
      [
        order(1, { orderState: 'Cancelled' }),
        order(2, { custom: { fields: { bccApprovalStatus: 'rejected' } } }),
        order(4, { custom: { fields: { bccApprovalStatus: 'pending' } } }),
        order(8, { createdAt: '2026-10-31T23:59:59.000Z' }),
      ],
      NOW
    );
    expect(c.lines[0]?.consumed.centAmount).toBe(4);
  });

  it('has no line outside the period in effect', () => {
    const c = budgetConsumption(
      budget({
        period: { kind: 'range', from: '2026-01-01', to: '2026-06-30' },
      }),
      [],
      NOW
    );
    expect(c).toEqual({ interval: null, lines: [] });
  });

  it('shows a role limit per holder, each on their own orders', () => {
    const c = budgetConsumption(
      budget({ scope: { kind: 'role', ref: 'buyer' } }),
      [
        order(90000, { customerId: 'c-1' }),
        order(10000, { customerId: 'c-2' }),
        order(50000, { customerId: 'c-2', businessUnit: { key: 'unit-b' } }),
      ],
      NOW,
      ['c-1', 'c-2']
    );
    expect(
      c.lines.map((l) => [l.customerId, l.consumed.centAmount, l.level])
    ).toEqual([
      ['c-1', 90000, 'warn'],
      ['c-2', 10000, 'ok'],
    ]);
  });

  it('shows an associate limit for that associate', () => {
    const c = budgetConsumption(
      budget({ scope: { kind: 'associate', ref: 'c-2' } }),
      [order(90000, { customerId: 'c-1' }), order(1000, { customerId: 'c-2' })],
      NOW
    );
    expect(c.lines.map((l) => [l.customerId, l.consumed.centAmount])).toEqual([
      ['c-2', 1000],
    ]);
  });

  it('counts a cost-object budget on orders carrying the key in any unit', () => {
    const c = budgetConsumption(
      budget({ scope: { kind: 'cost-object', ref: 'unit-a~PRJ-1' } }),
      [
        order(100, {
          businessUnit: { key: 'division-a1' },
          custom: { fields: { bccCostObject: 'unit-a~PRJ-1' } },
        }),
        order(200),
      ],
      NOW
    );
    expect(c.lines[0]?.consumed.centAmount).toBe(100);
  });
});

describe('scopeOrdersWhere', () => {
  const interval = {
    from: '2026-11-01T00:00:00.000Z',
    to: '2026-11-30T23:59:59.999Z',
  };
  const period =
    'createdAt >= "2026-11-01T00:00:00.000Z" and createdAt <= "2026-11-30T23:59:59.999Z"';

  it('matches the service predicates', () => {
    expect(
      scopeOrdersWhere(
        budget({ scope: { kind: 'cost-object', ref: 'unit-a~PRJ-1' } }),
        interval
      )
    ).toEqual([`custom(fields(bccCostObject="unit-a~PRJ-1")) and ${period}`]);
    expect(scopeOrdersWhere(budget(), interval)).toEqual([
      `businessUnit(key="unit-a") and ${period}`,
    ]);
    expect(
      scopeOrdersWhere(
        budget({ scope: { kind: 'associate', ref: 'c-1' } }),
        interval
      )
    ).toEqual([
      `businessUnit(key="unit-a") and customerId="c-1" and ${period}`,
    ]);
    expect(
      scopeOrdersWhere(
        budget({ scope: { kind: 'role', ref: 'buyer' } }),
        interval,
        ['c-1', 'c-2']
      )
    ).toEqual([
      `businessUnit(key="unit-a") and customerId in ("c-1", "c-2") and ${period}`,
    ]);
  });

  it('reads nothing for a role nobody holds', () => {
    expect(
      scopeOrdersWhere(
        budget({ scope: { kind: 'role', ref: 'buyer' } }),
        interval,
        []
      )
    ).toBeUndefined();
  });
});

describe('consumptionWhere', () => {
  it('reads the orders of the period in effect, and nothing outside it', () => {
    expect(consumptionWhere(budget(), NOW)).toEqual([
      'businessUnit(key="unit-a") and createdAt >= "2026-11-01T00:00:00.000Z" and createdAt <= "2026-11-30T23:59:59.999Z"',
    ]);
    expect(
      consumptionWhere(
        budget({
          period: { kind: 'range', from: '2026-01-01', to: '2026-06-30' },
        }),
        NOW
      )
    ).toBeUndefined();
  });
});

describe('review findings', () => {
  const interval = {
    from: '2026-11-01T00:00:00.000Z',
    to: '2026-11-30T23:59:59.999Z',
  };

  it('finding 5: splits a long holder list into predicates of at most 50 customer IDs', () => {
    const holders = Array.from({ length: 120 }, (_, i) => `c-${i}`);
    const wheres = scopeOrdersWhere(
      budget({ scope: { kind: 'role', ref: 'buyer' } }),
      interval,
      holders
    )!;
    expect(wheres).toHaveLength(3);
    const ids = wheres.map(
      (w) => /customerId in \(([^)]*)\)/.exec(w)![1]!.split(', ').length
    );
    expect(ids).toEqual([50, 50, 20]);
    expect(wheres[2]).toContain('"c-119"');
  });

  it('finding 2: a role limit shows only holders whose own associate limit does not replace it [BCC-BUDGET-8]', () => {
    const role = budget({ scope: { kind: 'role', ref: 'buyer' } });
    const people = [
      { customerId: 'c-1', label: 'Ada', roles: ['buyer'] },
      { customerId: 'c-2', label: 'Bo', roles: ['buyer'] },
      { customerId: 'c-3', label: 'Cy', roles: ['admin'] },
    ];
    const budgets = [
      { key: 'unit-a~role', value: role },
      {
        key: 'unit-a~ada',
        value: budget({ scope: { kind: 'associate', ref: 'c-1' } }),
      },
      // An associate limit in another currency cannot be checked, so it does not replace the role limit.
      {
        key: 'unit-a~bo-usd',
        value: budget({
          scope: { kind: 'associate', ref: 'c-2' },
          amount: { currencyCode: 'USD', centAmount: 100 },
        }),
      },
    ];
    expect(
      applicableHolders('unit-a~role', role, people, budgets, NOW)
    ).toEqual(['c-2']);
    // An inactive associate limit does not replace it either.
    expect(
      applicableHolders(
        'unit-a~role',
        role,
        people,
        [
          budgets[0]!,
          { key: 'unit-a~ada', value: { ...budgets[1]!.value, active: false } },
        ],
        NOW
      )
    ).toEqual(['c-1', 'c-2']);
  });
});
