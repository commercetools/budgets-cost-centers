// Settings section: full record merged from the effective settings, visible and usable defaults, conflict,
// view-only. [BCC-VIEW-5] [BCC-VIEW-8] [BCC-VIEW-9] [BCC-SET-1] [BCC-SET-2] [BCC-SET-4]
import React from 'react';
import {
  fireEvent,
  renderCustomView,
  screen,
  waitFor,
} from '@commercetools-frontend/application-shell/test-utils';
import { CONTAINERS, type CostObject, type Settings } from '../../core';
import { PanelProviders } from '../budget-panel/budget-panel';
import { PROJECT, startServer } from '../../test-utils/platform-mock';
import { pick } from '../../test-utils/ui';
import {
  DIVISION_A1,
  MANAGER,
  mockWorld,
  UNIT_A,
  unitSummary,
  VIEW_ONLY,
  type World,
} from '../../test-utils/world';
import UnitSettings from './settings';

const server = startServer();
const NOW = '2026-11-02T10:00:00.000Z';

const parent: Settings = {
  defaultMode: 'block',
  costObjectRequired: true,
  defaultCostObject: 'unit-a~CC-100',
  costObjectLevel: 'order',
  features: { projects: true },
  approval: {
    ruleKey: 'bcc-budget-unit-a',
    requesterRoles: ['buyer'],
    checkedAt: '2026-10-01T00:00:00.000Z',
  },
};
const co = (code: string, over: Partial<CostObject> = {}) => ({
  key: `${over.ownerBusinessUnitKey ?? 'unit-a'}~${code}`,
  version: 1,
  value: {
    code,
    name: `${code} (fictional)`,
    type: 'cost-center' as const,
    ownerBusinessUnitKey: 'unit-a',
    active: true,
    ...over,
  },
});

const world = (over: Partial<World> = {}): World => ({
  units: [UNIT_A, DIVISION_A1],
  records: {
    [CONTAINERS.settings]: [{ key: 'unit-a', version: 5, value: parent }],
    [CONTAINERS.costObjects]: [
      co('CC-100'),
      co('CC-OLD', { active: false }),
      co('SITE-1', { ownerBusinessUnitKey: 'division-a1', type: 'site' }),
    ],
  },
  ...over,
});

const render = (
  unit: typeof UNIT_A | typeof DIVISION_A1,
  permissions = MANAGER
) =>
  renderCustomView({
    locale: 'en',
    projectKey: PROJECT,
    projectAllAppliedPermissions: permissions,
    children: (
      <PanelProviders>
        <UnitSettings unit={unitSummary(unit)} now={NOW} />
      </PanelProviders>
    ),
  });

describe('UnitSettings', () => {
  it('pre-fills a division from its parent and writes a full record, keeping costObjectRequired (Review Focus 1)', async () => {
    const calls = mockWorld(server, world());
    render(DIVISION_A1);
    expect(
      await screen.findByText(/inherited from unit-a/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Cost object required' })
    ).toBeChecked();
    await pick('Default mode', 'Warn');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.writes[0]).toEqual({
      container: CONTAINERS.settings,
      key: 'division-a1',
      value: {
        defaultMode: 'warn',
        costObjectRequired: true,
        defaultCostObject: 'unit-a~CC-100',
        costObjectLevel: 'order',
        features: { projects: true },
        approval: { requesterRoles: [] },
      },
    });
    expect(await screen.findByText(/own settings/)).toBeInTheDocument();
  });

  it('switches on cost object required for a unit with its own record, sending the version', async () => {
    const calls = mockWorld(
      server,
      world({
        records: {
          [CONTAINERS.settings]: [
            {
              key: 'unit-a',
              version: 5,
              value: { ...parent, costObjectRequired: false },
            },
          ],
          [CONTAINERS.costObjects]: [co('CC-100')],
        },
      })
    );
    render(UNIT_A);
    fireEvent.click(
      await screen.findByRole('switch', { name: 'Cost object required' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.writes[0]).toEqual(
      expect.objectContaining({
        key: 'unit-a',
        version: 5,
        value: expect.objectContaining({
          costObjectRequired: true,
          approval: parent.approval,
        }),
      })
    );
  });

  it('offers only visible and usable cost objects as default [BCC-SET-4]', async () => {
    mockWorld(server, world());
    render(DIVISION_A1);
    fireEvent.click(
      await screen.findByRole('button', { name: /Default cost object$/ })
    );
    const options = (await screen.findAllByRole('option')).map(
      (o) => o.textContent
    );
    expect(options).toEqual([
      'No default',
      'SITE-1 SITE-1 (fictional)',
      'CC-100 CC-100 (fictional)',
    ]);
  });

  it('keeps the input on a conflict and offers a reload', async () => {
    const calls = mockWorld(server, world({ conflictOn: ['unit-a'] }));
    render(UNIT_A);
    await screen.findByText(/own settings/);
    await pick('Default mode', 'Approval');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Someone else changed this record.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Approval Default mode$/ })
    ).toBeInTheDocument();
    expect(calls.writes[0]).toEqual(expect.objectContaining({ version: 5 }));
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('finding 8: treats a record someone else created meanwhile like a conflict and offers a reload', async () => {
    const w = world({ records: { [CONTAINERS.costObjects]: [co('CC-100')] } });
    const calls = mockWorld(server, w);
    render(UNIT_A);
    await screen.findByText(/default settings/);
    w.records![CONTAINERS.settings] = [
      { key: 'unit-a', version: 1, value: parent },
    ];
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Someone else changed this record.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/exists already/)).not.toBeInTheDocument();
    expect(calls.writes).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(await screen.findByText(/own settings/)).toBeInTheDocument();
  });

  it('finding 9: after a conflict reload shows the fresh values, names the changed fields and can re-apply the input', async () => {
    const w = world();
    const calls = mockWorld(server, w);
    render(DIVISION_A1);
    await screen.findByText(/inherited from unit-a/);
    await pick('Default mode', 'Approval');
    // Someone else creates the division's record with mode warn.
    w.records![CONTAINERS.settings]!.push({
      key: 'division-a1',
      version: 1,
      value: {
        ...parent,
        defaultMode: 'warn',
        approval: { requesterRoles: [] },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reload' }));

    expect(
      await screen.findByText('The latest version was loaded.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Changed by someone else: Default mode.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your unsaved values were replaced: Default mode.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Warn Default mode$/ })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Re-apply my values' }));
    expect(
      screen.getByRole('button', { name: /Approval Default mode$/ })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.writes[0]).toEqual(
      expect.objectContaining({
        key: 'division-a1',
        version: 1,
        value: expect.objectContaining({ defaultMode: 'approval' }),
      })
    );
  });

  it('shows a view-only user the settings without a save control [BCC-VIEW-9]', async () => {
    mockWorld(server, world());
    render(UNIT_A, VIEW_ONLY);
    expect(await screen.findByText('Block')).toBeInTheDocument();
    expect(screen.getByText('unit-a~CC-100')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
