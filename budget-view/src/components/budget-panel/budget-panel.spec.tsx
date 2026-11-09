// The panel opens for the Business Unit shown on the host page with its four sections. [BCC-VIEW-1] [BCC-VIEW-2]
// [BCC-VIEW-9] [BCC-VIEW-10]
import React from 'react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import {
  fireEvent,
  renderCustomView,
  screen,
} from '@commercetools-frontend/application-shell/test-utils';
import { CONTAINERS } from '../../core';
import {
  mockWorld,
  ROLES,
  CUSTOMERS,
  UNIT_A,
  VIEW_ONLY,
} from '../../test-utils/world';
import BudgetPanel from './budget-panel';

const API = 'http://localhost:8080/proxy/ctp/demo';
const UNIT_ID = '6b1c4d7e-0000-4000-8000-000000000001';
const UNIT_PAGE = `https://mc.europe-west1.gcp.commercetools.com/demo/customers/business-units/${UNIT_ID}/general`;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const render = (
  hostUrl: string,
  permissions?: Array<{ name: string; value: boolean }>
) =>
  renderCustomView({
    locale: 'en',
    projectKey: 'demo',
    customViewHostUrl: hostUrl,
    ...(permissions ? { projectAllAppliedPermissions: permissions } : {}),
    children: <BudgetPanel />,
  });

const unitWorld = () =>
  mockWorld(server, {
    units: [{ ...UNIT_A, id: UNIT_ID }],
    roles: ROLES,
    customers: CUSTOMERS,
    records: {
      [CONTAINERS.costObjects]: [
        {
          key: 'unit-a~SITE-7',
          version: 1,
          value: {
            code: 'SITE-7',
            name: 'Riverside Depot (fictional)',
            type: 'site',
            ownerBusinessUnitKey: 'unit-a',
            active: true,
          },
        },
      ],
    },
  });

describe('BudgetPanel', () => {
  it('shows the name and key of the unit on the host page, the four sections, and its cost objects first', async () => {
    unitWorld();
    render(UNIT_PAGE);

    expect(
      await screen.findByRole('heading', { name: /Unit A \(fictional\)/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText('unit-a', { selector: 'span' })
    ).toBeInTheDocument();
    for (const name of ['Cost objects', 'Budgets', 'Settings', 'Approval']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(await screen.findByText('SITE-7')).toBeInTheDocument();
  });

  it('opens each section for a view-only user without edit or setup controls [BCC-VIEW-9]', async () => {
    unitWorld();
    render(UNIT_PAGE, VIEW_ONLY);
    expect(await screen.findByText('SITE-7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Budgets' }));
    expect(
      await screen.findByText('No budgets or limits yet.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(
      await screen.findByText(/default settings apply/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Approval' }));
    expect(
      await screen.findByText(
        /Coverage has never been checked|no own settings record/
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /Add|Edit|Deactivate|Save|Create rule/,
      })
    ).not.toBeInTheDocument();
  });

  it('finding 14: loads the unit chain and the people once per panel, not once per tab', async () => {
    const calls = unitWorld();
    render(UNIT_PAGE);
    expect(await screen.findByText('SITE-7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Budgets' }));
    expect(
      await screen.findByText('No budgets or limits yet.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(
      await screen.findByText(/default settings apply/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Approval' }));
    expect(
      await screen.findByText(/no own settings record/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Budgets' }));
    expect(
      await screen.findByText('No budgets or limits yet.')
    ).toBeInTheDocument();
    const count = (path: string) =>
      calls.reads.filter((r) => r === path).length;
    // Once for the unit chain, once for the unit's associates.
    expect(count('/business-units/key=unit-a')).toBe(2);
    expect(count('/associate-roles')).toBe(1);
    expect(count('/customers')).toBe(1);
  });

  it('says so when the host page is not a Business Unit', async () => {
    render(
      'https://mc.europe-west1.gcp.commercetools.com/demo/orders/abc/general'
    );
    expect(
      await screen.findByText(/Open this panel on a Business Unit page/)
    ).toBeInTheDocument();
  });

  it('shows an error when the unit cannot be loaded', async () => {
    server.use(
      rest.get(`${API}/business-units/${UNIT_ID}`, (_req, res, ctx) =>
        res(
          ctx.status(404),
          ctx.json({ statusCode: 404, message: 'Not found' })
        )
      )
    );
    render(UNIT_PAGE);
    expect(
      await screen.findByText(/The Business Unit could not be loaded/)
    ).toBeInTheDocument();
  });
});
