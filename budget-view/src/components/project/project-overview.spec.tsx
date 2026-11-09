// Project overview: lists, carts, quotes and orders with totals, budget consumption, project status and fields.
// [BCC-VIEW-6] [BCC-PROJ-1] [BCC-PROJ-2] [BCC-PROJ-4] [BCC-VIEW-9]
import React from 'react';
import {
  fireEvent,
  renderCustomView,
  screen,
  waitFor,
  within,
} from '@commercetools-frontend/application-shell/test-utils';
import { CONTAINERS, type CostObject } from '../../core';
import { PanelProviders } from '../budget-panel/budget-panel';
import { PROJECT, startServer } from '../../test-utils/platform-mock';
import { pick } from '../../test-utils/ui';
import {
  MANAGER,
  mockWorld,
  UNIT_A,
  VIEW_ONLY,
  type World,
} from '../../test-utils/world';
import ProjectOverview from './project-overview';

const server = startServer();
const NOW = '2026-11-15T10:00:00.000Z';
const KEY = 'unit-a~PRJ-1001';
const eur = (centAmount: number) => ({
  type: 'centPrecision',
  currencyCode: 'EUR',
  centAmount,
  fractionDigits: 2,
});
const custom = {
  type: { typeId: 'type', id: 't' },
  fields: { bccCostObject: KEY },
};

const project: CostObject = {
  code: 'PRJ-1001',
  name: 'Harbour Hall (fictional)',
  type: 'project',
  ownerBusinessUnitKey: 'unit-a',
  active: true,
  project: { status: 'active', siteAddress: '1 Quay Street' },
};

const setup = (over: Partial<World> = {}) =>
  mockWorld(server, {
    units: [UNIT_A],
    records: {
      [CONTAINERS.costObjects]: [{ key: KEY, version: 6, value: project }],
      [CONTAINERS.budgets]: [
        {
          key: 'unit-a~prj-q',
          version: 1,
          value: {
            scope: { kind: 'cost-object', ref: KEY },
            ownerBusinessUnitKey: 'unit-a',
            amount: { currencyCode: 'EUR', centAmount: 1000000 },
            period: { kind: 'quarter', from: '2026-10-01' },
            mode: 'approval',
            warnAtPercent: 80,
            active: true,
          },
        },
      ],
    },
    shoppingLists: [
      {
        id: 'sl-1',
        name: { en: 'Material list (fictional)' },
        lineItems: [{}, {}],
        custom,
      },
    ],
    carts: [
      {
        id: 'cart-1',
        key: 'phase-1',
        cartState: 'Active',
        totalPrice: eur(20000),
        lineItems: [],
        custom,
      },
      {
        id: 'cart-2',
        key: 'phase-2',
        cartState: 'Active',
        totalPrice: eur(30000),
        lineItems: [],
        custom,
      },
    ],
    quoteRequests: [],
    quotes: [
      {
        id: 'q-1',
        key: 'Q-1',
        quoteState: 'Pending',
        totalPrice: eur(40000),
        lineItems: [],
        custom,
      },
    ],
    orders: [
      {
        id: 'o-1',
        orderNumber: 'N-1',
        orderState: 'Open',
        createdAt: '2026-11-03T10:00:00.000Z',
        businessUnit: { key: 'unit-a' },
        totalPrice: eur(100000),
        lineItems: [],
        custom,
      },
      {
        id: 'o-2',
        orderNumber: 'N-2',
        orderState: 'Open',
        createdAt: '2026-11-04T10:00:00.000Z',
        businessUnit: { key: 'unit-a' },
        totalPrice: eur(150000),
        lineItems: [],
        custom,
      },
      {
        id: 'o-3',
        orderNumber: 'N-3',
        orderState: 'Cancelled',
        createdAt: '2026-11-05T10:00:00.000Z',
        businessUnit: { key: 'unit-a' },
        totalPrice: eur(5000),
        lineItems: [],
        custom,
      },
    ],
    ...over,
  });

const render = (permissions = MANAGER, onChanged = jest.fn()) =>
  renderCustomView({
    locale: 'en',
    projectKey: PROJECT,
    projectAllAppliedPermissions: permissions,
    children: (
      <PanelProviders>
        <ProjectOverview
          project={{
            key: KEY,
            version: 6,
            value: project,
            owner: 'unit-a',
            editable: true,
          }}
          now={NOW}
          onClose={jest.fn()}
          onChanged={onChanged}
        />
      </PanelProviders>
    ),
  });

describe('ProjectOverview', () => {
  it('lists the shopping list, carts, quote and orders with their totals and the project budget', async () => {
    setup();
    render();
    const table = await screen.findByRole('table', {
      name: 'Everything bought for PRJ-1001',
    });
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.textContent);
    expect(rows).toEqual([
      'Shopping listMaterial list (fictional)2',
      'Cartphase-10€200.00',
      'Cartphase-20€300.00',
      'QuoteQ-1Pending0€400.00',
      'OrderN-1Open0€1,000.00',
      'OrderN-2Open0€1,500.00',
      'OrderN-3Cancelled0€50.00',
    ]);
    const budget = await screen.findByRole('group', { name: 'unit-a~prj-q' });
    expect(
      await within(budget).findByText(
        /Consumed €2,500.00 of €10,000.00, remaining €7,500.00/
      )
    ).toBeInTheDocument();
  });

  it('closes the project with the version it read [BCC-PROJ-4]', async () => {
    const calls = setup();
    const onChanged = jest.fn();
    render(MANAGER, onChanged);
    await screen.findByRole('table', {
      name: 'Everything bought for PRJ-1001',
    });
    await pick('Project status', 'Closed');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.writes[0]).toEqual({
      container: CONTAINERS.costObjects,
      key: KEY,
      value: {
        ...project,
        project: { status: 'closed', siteAddress: '1 Quay Street' },
      },
      version: 6,
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('shows a view-only user the project fields without a save control [BCC-VIEW-9]', async () => {
    setup();
    render(VIEW_ONLY);
    await screen.findByRole('table', {
      name: 'Everything bought for PRJ-1001',
    });
    expect(screen.getByText('1 Quay Street')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save project' })
    ).not.toBeInTheDocument();
  });

  it('finding 7: shows platform states through messages and frames unknown ones', async () => {
    setup({
      quotes: [
        {
          id: 'q-1',
          key: 'Q-1',
          quoteState: 'DeclinedForRenegotiation',
          totalPrice: eur(40000),
          lineItems: [],
          custom,
        },
        {
          id: 'q-2',
          key: 'Q-2',
          quoteState: 'SomethingNew',
          totalPrice: eur(100),
          lineItems: [],
          custom,
        },
      ],
      orders: [],
    });
    render();
    const table = await screen.findByRole('table', {
      name: 'Everything bought for PRJ-1001',
    });
    expect(
      within(table).getByText('Declined, renegotiation requested')
    ).toBeInTheDocument();
    expect(
      within(table).getByText('Other state: SomethingNew')
    ).toBeInTheDocument();
  });
});
