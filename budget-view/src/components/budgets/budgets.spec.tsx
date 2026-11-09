// Budgets section: consumption bars, add a role limit with defaults, deactivate, conflict, CSV export, view-only.
// [BCC-VIEW-3] [BCC-VIEW-4] [BCC-VIEW-7] [BCC-VIEW-8] [BCC-VIEW-9] [BCC-BUDGET-1] [BCC-BUDGET-5] [BCC-BUDGET-6]
// [BCC-BUDGET-8] [BCC-SPEND-4]
import React from 'react';
import {
  fireEvent,
  renderCustomView,
  screen,
  waitFor,
  within,
} from '@commercetools-frontend/application-shell/test-utils';
import { type Budget, CONTAINERS, DEFAULT_SETTINGS } from '../../core';
import { PanelProviders } from '../budget-panel/budget-panel';
import { PROJECT, startServer } from '../../test-utils/platform-mock';
import { pick, type } from '../../test-utils/ui';
import {
  CUSTOMERS,
  DIVISION_A1,
  MANAGER,
  mockWorld,
  ROLES,
  UNIT_A,
  unitSummary,
  VIEW_ONLY,
  type World,
} from '../../test-utils/world';
import Budgets from './budgets';

const server = startServer();
const NOW = '2026-11-15T10:00:00.000Z';

const budget = (over: Partial<Budget> = {}): Budget => ({
  scope: { kind: 'business-unit', ref: 'unit-a' },
  ownerBusinessUnitKey: 'unit-a',
  amount: { currencyCode: 'EUR', centAmount: 100000 },
  period: { kind: 'month', from: '2026-01-01' },
  mode: 'approval',
  warnAtPercent: 80,
  active: true,
  ...over,
});

const order = (
  id: string,
  cents: number,
  over: Record<string, unknown> = {}
) => ({
  id,
  version: 1,
  createdAt: '2026-11-03T10:00:00.000Z',
  orderState: 'Open',
  customerId: 'c-1',
  businessUnit: { typeId: 'business-unit', key: 'unit-a' },
  totalPrice: {
    type: 'centPrecision',
    currencyCode: 'EUR',
    centAmount: cents,
    fractionDigits: 2,
  },
  lineItems: [],
  ...over,
});

const world = (over: Partial<World> = {}): World => ({
  units: [UNIT_A, DIVISION_A1],
  roles: ROLES,
  customers: CUSTOMERS,
  records: {
    [CONTAINERS.settings]: [
      {
        key: 'unit-a',
        version: 1,
        value: { ...DEFAULT_SETTINGS, defaultMode: 'warn' },
      },
    ],
    [CONTAINERS.budgets]: [
      { key: 'unit-a~monthly', version: 4, value: budget() },
    ],
    [CONTAINERS.costObjects]: [],
  },
  orders: [order('o-1', 50000), order('o-2', 35000)],
  ...over,
});

const render = (permissions = MANAGER) =>
  renderCustomView({
    locale: 'en',
    projectKey: PROJECT,
    projectAllAppliedPermissions: permissions,
    children: (
      <PanelProviders>
        <Budgets unit={unitSummary(UNIT_A)} now={NOW} />
      </PanelProviders>
    ),
  });

const card = async (key: string) =>
  (await screen.findByRole('group', { name: key })) as HTMLElement;

describe('Budgets', () => {
  it('shows 850 of 1,000 EUR as 85 % in the warn state with the period in effect', async () => {
    mockWorld(server, world());
    render();
    const c = await card('unit-a~monthly');
    const bar = await within(c).findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '85');
    expect(bar).toHaveAttribute('data-level', 'warn');
    expect(within(c).getByText('Warning level')).toBeInTheDocument();
    expect(within(c).getByText(/2026-11-01 to 2026-11-30/)).toBeInTheDocument();
    expect(
      within(c).getByText(/Consumed €850.00 of €1,000.00, remaining €150.00/)
    ).toBeInTheDocument();
  });

  // Found in the sandbox run: a raw record key as title, "0" instead of "0%", "(1 orders)".
  it('titles the card with the budget code and counts one order in the singular', async () => {
    mockWorld(server, world({ orders: [order('o-1', 10000)] }));
    render();
    const c = await card('unit-a~monthly');
    expect(within(c).getByText('monthly')).toBeInTheDocument();
    expect(within(c).queryByText('unit-a~monthly')).not.toBeInTheDocument();
    expect(within(c).getByText(/\(1 order\)/)).toBeInTheDocument();
  });

  it('shows 0% for a budget without orders', async () => {
    mockWorld(server, world({ orders: [] }));
    render();
    const c = await card('unit-a~monthly');
    const bar = await within(c).findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuetext', '0%');
    // Nimbus renders `value && valueText`, which shows a bare "0"; the view renders the value text itself.
    expect(within(c).getByText('0%')).toBeInTheDocument();
    expect(within(c).queryByText(/^0$/)).not.toBeInTheDocument();
    expect(within(c).getByText(/\(0 orders\)/)).toBeInTheDocument();
  });

  it('hints at orders in another currency', async () => {
    mockWorld(
      server,
      world({
        orders: [
          order('o-1', 10000),
          order('o-2', 5000, {
            totalPrice: {
              type: 'centPrecision',
              currencyCode: 'USD',
              centAmount: 5000,
              fractionDigits: 2,
            },
          }),
        ],
      })
    );
    render();
    const c = await card('unit-a~monthly');
    expect(
      await within(c).findByText('1 order in another currency is not counted.')
    ).toBeInTheDocument();
  });

  it('shows a role limit per holder', async () => {
    mockWorld(
      server,
      world({
        records: {
          [CONTAINERS.budgets]: [
            {
              key: 'unit-a~buyer',
              version: 1,
              value: budget({ scope: { kind: 'role', ref: 'buyer' } }),
            },
          ],
        },
        orders: [order('o-1', 120000)],
      })
    );
    render();
    const c = await card('unit-a~buyer');
    const bar = await within(c).findByRole('progressbar', { name: /Ada Lane/ });
    expect(bar).toHaveAttribute('data-level', 'exceeded');
  });

  it('adds a monthly limit of 2,000 EUR for role buyer with the default mode and threshold', async () => {
    const calls = mockWorld(server, world());
    render();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add budget or limit' })
    );
    await pick('Applies to', 'Associate Role');
    await pick('Associate Role', 'Buyer');
    type('Amount', '2,000');
    type('Budget ID', 'buyer-monthly');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.writes[0]).toEqual({
      container: CONTAINERS.budgets,
      key: 'unit-a~buyer-monthly',
      value: {
        scope: { kind: 'role', ref: 'buyer' },
        ownerBusinessUnitKey: 'unit-a',
        amount: { currencyCode: 'EUR', centAmount: 200000 },
        period: { kind: 'month', from: '2026-11-01' },
        mode: 'warn',
        warnAtPercent: 80,
        active: true,
      },
    });
    expect(await card('unit-a~buyer-monthly')).toBeInTheDocument();
  });

  it('shows core period errors and writes nothing', async () => {
    const calls = mockWorld(server, world());
    render();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add budget or limit' })
    );
    await pick('Applies to', 'Business Unit');
    type('Amount', '100');
    await pick('Period', 'Year');
    type('From', '2026-03-01');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        /Period: A year budget must start on the first day of a year/
      )
    ).toBeInTheDocument();
    expect(calls.writes).toEqual([]);
  });

  it('refuses a budget ID that exists', async () => {
    const calls = mockWorld(server, world());
    render();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add budget or limit' })
    );
    await pick('Applies to', 'Business Unit');
    type('Amount', '100');
    type('Budget ID', 'monthly');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        /A record with the key unit-a~monthly exists already/
      )
    ).toBeInTheDocument();
    expect(calls.writes).toEqual([]);
  });

  it('deactivates with the version it read', async () => {
    const calls = mockWorld(server, world());
    render();
    const c = await card('unit-a~monthly');
    fireEvent.click(
      within(c).getByRole('button', { name: 'Deactivate unit-a~monthly' })
    );
    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.writes[0]).toEqual(
      expect.objectContaining({
        key: 'unit-a~monthly',
        version: 4,
        value: budget({ active: false }),
      })
    );
  });

  it('keeps the input on a conflict', async () => {
    mockWorld(server, world({ conflictOn: ['unit-a~monthly'] }));
    render();
    fireEvent.click(
      within(await card('unit-a~monthly')).getByRole('button', {
        name: 'Edit unit-a~monthly',
      })
    );
    type('Amount', '1500');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Someone else changed this record.')
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('1500');
  });

  it('exports the spend report as budgets-unit-a-2026-Q4.csv', async () => {
    const calls = mockWorld(
      server,
      world({
        records: {
          [CONTAINERS.budgets]: [],
          [CONTAINERS.costObjects]: [
            {
              key: 'unit-a~CC-1',
              version: 1,
              value: {
                code: 'CC-1',
                name: 'Main (fictional)',
                type: 'cost-center',
                ownerBusinessUnitKey: 'unit-a',
                active: true,
              },
            },
          ],
        },
        orders: [
          order('o-1', 25000, {
            custom: {
              type: { typeId: 'type', id: 't' },
              fields: { bccCostObject: 'unit-a~CC-1' },
            },
          }),
        ],
      })
    );
    const blobs: Blob[] = [];
    const names: string[] = [];
    const createObjectURL = jest.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:x';
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
      });
    render();
    const exportButton = await screen.findByRole('button', {
      name: 'Export CSV',
    });
    await pick('Report period', 'Quarter');
    fireEvent.click(exportButton);

    await waitFor(() => expect(names).toEqual(['budgets-unit-a-2026-Q4.csv']));
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blobs[0]!);
    });
    expect(text.split('\r\n')[0]).toBe(
      'unit,cost object,type,externalId,period,budget,consumed,remaining,order count'
    );
    expect(text).toContain(
      'unit-a,CC-1,cost-center,,2026-10-01..2026-12-31,,EUR 250.00,,1'
    );
    expect(calls.orderWhere.at(-1)).toContain(
      'bccCostObject in ("unit-a~CC-1")'
    );
    expect(await screen.findByText('Exported 1 rows.')).toBeInTheDocument();
    click.mockRestore();
  });

  it('shows a view-only user budgets and consumption without add, edit or deactivate controls [BCC-VIEW-9]', async () => {
    mockWorld(server, world());
    render(VIEW_ONLY);
    const c = await card('unit-a~monthly');
    expect(await within(c).findByRole('progressbar')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Add|Edit|Deactivate/ })
    ).not.toBeInTheDocument();
  });

  describe('review findings', () => {
    it('finding 2: leaves a holder out of a role limit when their associate limit replaces it [BCC-BUDGET-8]', async () => {
      const calls = mockWorld(
        server,
        world({
          records: {
            [CONTAINERS.budgets]: [
              {
                key: 'unit-a~buyer',
                version: 1,
                value: budget({ scope: { kind: 'role', ref: 'buyer' } }),
              },
              {
                key: 'unit-a~ada',
                version: 1,
                value: budget({ scope: { kind: 'associate', ref: 'c-1' } }),
              },
            ],
          },
          orders: [order('o-1', 120000)],
        })
      );
      render();
      const c = await card('unit-a~buyer');
      expect(
        await within(c).findByText(
          'Every holder of this role has an own associate limit, which replaces this role limit.'
        )
      ).toBeInTheDocument();
      expect(within(c).queryByRole('progressbar')).not.toBeInTheDocument();
      const ada = await card('unit-a~ada');
      expect(
        await within(ada).findByRole('progressbar', { name: /Ada Lane/ })
      ).toBeInTheDocument();
      expect(calls.orderWhere.some((w) => w.includes('customerId in'))).toBe(
        false
      );
    });

    it('finding 6: shows and saves a JPY budget in yen, without a minor unit [BCC-BUDGET-1]', async () => {
      const yen = (cents: number) => ({
        type: 'centPrecision',
        currencyCode: 'JPY',
        centAmount: cents,
        fractionDigits: 0,
      });
      const calls = mockWorld(
        server,
        world({
          records: {
            [CONTAINERS.budgets]: [
              {
                key: 'unit-a~yen',
                version: 1,
                value: budget({
                  amount: { currencyCode: 'JPY', centAmount: 100000 },
                }),
              },
            ],
          },
          orders: [order('o-1', 0, { totalPrice: yen(85000) })],
        })
      );
      render();
      const c = await card('unit-a~yen');
      expect(
        await within(c).findByText(
          /Consumed ¥85,000 of ¥100,000, remaining ¥15,000/
        )
      ).toBeInTheDocument();
      fireEvent.click(
        await screen.findByRole('button', { name: 'Add budget or limit' })
      );
      await pick('Applies to', 'Business Unit');
      type('Currency', 'JPY');
      type('Amount', '100000');
      type('Budget ID', 'yen-2');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(calls.writes).toHaveLength(1));
      expect((calls.writes[0]!.value as Budget).amount).toEqual({
        currencyCode: 'JPY',
        centAmount: 100000,
      });
    });

    it('finding 9: after a conflict reload shows the fresh budget, names the changed fields and can re-apply the input', async () => {
      const w = world({ conflictOn: ['unit-a~monthly'] });
      const calls = mockWorld(server, w);
      render();
      fireEvent.click(
        within(await card('unit-a~monthly')).getByRole('button', {
          name: 'Edit unit-a~monthly',
        })
      );
      type('Amount', '1500');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(
        await screen.findByText('Someone else changed this record.')
      ).toBeInTheDocument();
      const stored = w.records![CONTAINERS.budgets]![0]!;
      Object.assign(stored, {
        version: 5,
        value: budget({ amount: { currencyCode: 'EUR', centAmount: 120000 } }),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
      expect(
        await screen.findByText('Changed by someone else: Amount.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Your unsaved values were replaced: Amount.')
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue(
        '1200.00'
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Re-apply my values' })
      );
      expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue(
        '1500'
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(calls.writes).toHaveLength(2));
      expect(calls.writes[1]).toEqual(
        expect.objectContaining({
          version: 5,
          value: budget({
            amount: { currencyCode: 'EUR', centAmount: 150000 },
          }),
        })
      );
    });

    it('finding 4: reads the orders of one predicate once for all budget rows', async () => {
      const calls = mockWorld(
        server,
        world({
          records: {
            [CONTAINERS.budgets]: [
              { key: 'unit-a~monthly', version: 4, value: budget() },
              {
                key: 'unit-a~monthly-block',
                version: 1,
                value: budget({ mode: 'block' }),
              },
            ],
          },
        })
      );
      render();
      for (const key of ['unit-a~monthly', 'unit-a~monthly-block'])
        expect(
          await within(await card(key)).findByRole('progressbar')
        ).toHaveAttribute('aria-valuenow', '85');
      expect(calls.orderWhere).toEqual([
        'businessUnit(key="unit-a") and createdAt >= "2026-11-01T00:00:00.000Z" and createdAt <= "2026-11-30T23:59:59.999Z"',
      ]);
    });
  });
});
