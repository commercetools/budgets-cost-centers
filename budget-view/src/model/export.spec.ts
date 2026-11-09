// Spend report CSV of a unit for a chosen period. [BCC-VIEW-7] [BCC-SPEND-4]
import type { Budget, CostObject, OrderLike } from '../core';
import {
  csvFileName,
  exportOrdersWhere,
  periodLabel,
  reportInterval,
  spendCsv,
} from './export';

describe('reportInterval and periodLabel', () => {
  it.each([
    [
      'quarter',
      '2026-11-02',
      '2026-10-01T00:00:00.000Z',
      '2026-12-31T23:59:59.999Z',
      '2026-Q4',
    ],
    [
      'month',
      '2026-02-10',
      '2026-02-01T00:00:00.000Z',
      '2026-02-28T23:59:59.999Z',
      '2026-02',
    ],
    [
      'year',
      '2026-07-01',
      '2026-01-01T00:00:00.000Z',
      '2026-12-31T23:59:59.999Z',
      '2026',
    ],
  ] as const)('%s around %s', (kind, at, from, to, label) => {
    const interval = reportInterval(kind, at);
    expect(interval).toEqual({ from, to });
    expect(periodLabel(kind, interval)).toBe(label);
  });

  it('names the download budgets-<unit>-<period>.csv', () => {
    expect(csvFileName('unit-a', '2026-Q4')).toBe('budgets-unit-a-2026-Q4.csv');
  });
});

describe('exportOrdersWhere', () => {
  it('reads the orders of the cost objects in the interval, or nothing without cost objects', () => {
    const interval = reportInterval('quarter', '2026-11-02');
    expect(exportOrdersWhere(['unit-a~A', 'unit-a~B'], interval)).toEqual([
      'custom(fields(bccCostObject in ("unit-a~A", "unit-a~B"))) and createdAt >= "2026-10-01T00:00:00.000Z" and createdAt <= "2026-12-31T23:59:59.999Z"',
    ]);
    expect(exportOrdersWhere([], interval)).toBeUndefined();
  });
});

describe('review findings', () => {
  it('finding 5: splits many cost objects into predicates of at most 50 keys', () => {
    const interval = reportInterval('quarter', '2026-11-02');
    const keys = Array.from({ length: 101 }, (_, i) => `unit-a~CC-${i}`);
    const wheres = exportOrdersWhere(keys, interval)!;
    expect(
      wheres.map(
        (w) => /bccCostObject in \(([^)]*)\)/.exec(w)![1]!.split(', ').length
      )
    ).toEqual([50, 50, 1]);
    expect(wheres.every((w) => w.includes('createdAt >= '))).toBe(true);
  });
});

describe('spendCsv', () => {
  it('builds the nine columns with a header and one row per cost object', () => {
    const co = (
      code: string,
      type: CostObject['type']
    ): { key: string; value: CostObject } => ({
      key: `unit-a~${code}`,
      value: {
        code,
        name: `${code} (fictional)`,
        type,
        ownerBusinessUnitKey: 'unit-a',
        active: true,
        ...(type === 'project'
          ? { project: { status: 'active' as const } }
          : {}),
        ...(code === 'CC-1' ? { externalId: '=SUM(A1)' } : {}),
      },
    });
    const budget: Budget = {
      scope: { kind: 'cost-object', ref: 'unit-a~CC-1' },
      ownerBusinessUnitKey: 'unit-a',
      amount: { currencyCode: 'EUR', centAmount: 100000 },
      period: { kind: 'quarter', from: '2026-01-01' },
      mode: 'warn',
      warnAtPercent: 80,
      active: true,
    };
    const orders: OrderLike[] = [
      {
        id: 'o-1',
        createdAt: '2026-11-03T10:00:00.000Z',
        orderState: 'Open',
        totalPrice: { currencyCode: 'EUR', centAmount: 25000 },
        custom: { fields: { bccCostObject: 'unit-a~CC-1' } },
      },
      {
        id: 'o-2',
        createdAt: '2026-11-03T10:00:00.000Z',
        orderState: 'Open',
        totalPrice: { currencyCode: 'USD', centAmount: 100 },
        custom: { fields: { bccCostObject: 'unit-a~CC-1' } },
      },
    ];
    const r = spendCsv({
      unitKey: 'unit-a',
      interval: reportInterval('quarter', '2026-11-02'),
      costObjects: [co('PRJ-1', 'project'), co('CC-1', 'cost-center')],
      budgets: [{ key: 'unit-a~q4', value: budget }],
      orders,
    });
    expect(r.csv.split('\r\n')).toEqual([
      'unit,cost object,type,externalId,period,budget,consumed,remaining,order count',
      "unit-a,CC-1,cost-center,'=SUM(A1),2026-10-01..2026-12-31,EUR 1000.00,EUR 250.00,EUR 750.00,1",
      'unit-a,PRJ-1,project,,2026-10-01..2026-12-31,,EUR 0.00,,0',
      '',
    ]);
    expect(r.rowCount).toBe(2);
    expect(r.otherCurrencyOrders).toBe(1);
  });
});
