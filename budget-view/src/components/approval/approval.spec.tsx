// Approval section: check the budget rule as a chosen associate, warn about uncovered roles, show and refresh the
// coverage record, detect stale coverage, set up the rule, view-only. [BCC-APPR-3] [BCC-APPR-4] [BCC-APPR-2]
// [BCC-VIEW-9] [BCC-SET-1]
import React from 'react';
import {
  fireEvent,
  renderCustomView,
  screen,
  waitFor,
} from '@commercetools-frontend/application-shell/test-utils';
import { act } from '@testing-library/react';
import { rest } from 'msw';
import { CONTAINERS, DEFAULT_SETTINGS, type Settings } from '../../core';
import { PanelProviders } from '../budget-panel/budget-panel';
import { API, PROJECT, startServer } from '../../test-utils/platform-mock';
import { pick } from '../../test-utils/ui';
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
import Approval from './approval';

const server = startServer();
const NOW = '2026-11-02T10:00:00.000Z';

const rule = (over: Record<string, unknown> = {}) => ({
  id: 'r-1',
  key: 'bcc-budget-unit-a',
  version: 2,
  name: 'Budget approval',
  status: 'Active',
  predicate: 'custom.bccBudgetExceeded = true',
  requesters: [{ associateRole: { typeId: 'associate-role', key: 'buyer' } }],
  approvers: {
    tiers: [
      {
        and: [
          {
            or: [
              { associateRole: { typeId: 'associate-role', key: 'approver' } },
            ],
          },
        ],
      },
    ],
  },
  businessUnit: { typeId: 'business-unit', key: 'unit-a' },
  createdAt: '2026-10-01T00:00:00.000Z',
  lastModifiedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  costObjectRequired: true,
  approval: {
    ruleKey: 'bcc-budget-unit-a',
    requesterRoles: ['buyer'],
    checkedAt: '2026-10-15T00:00:00.000Z',
  },
};

const world = (over: Partial<World> = {}): World => ({
  units: [UNIT_A],
  roles: ROLES,
  customers: CUSTOMERS,
  records: {
    [CONTAINERS.settings]: [{ key: 'unit-a', version: 7, value: settings }],
    [CONTAINERS.costObjects]: [],
  },
  rules: [rule()],
  ...over,
});

// A fixed clock by default; `clock: null` uses the real time.
const render = (
  permissions = MANAGER,
  {
    clock = () => NOW,
    unit = unitSummary(UNIT_A),
  }: {
    clock?: (() => string) | null;
    unit?: ReturnType<typeof unitSummary>;
  } = {}
) =>
  renderCustomView({
    locale: 'en',
    projectKey: PROJECT,
    projectAllAppliedPermissions: permissions,
    children: (
      <PanelProviders>
        <Approval unit={unit} {...(clock ? { clock } : {})} />
      </PanelProviders>
    ),
  });

const actAs = async (label: string) => {
  await screen.findByText(/Coverage last checked/);
  await pick('Act as associate', label);
};

describe('Approval', () => {
  it('shows when the coverage was last checked before any associate is picked', async () => {
    mockWorld(server, world());
    render();
    expect(
      await screen.findByText('Coverage last checked: 2026-10-15T00:00:00.000Z')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Covered requester roles: buyer')
    ).toBeInTheDocument();
  });

  it('offers only associates holding CreateApprovalRules and names the associate it acts for [BCC-APPR-4]', async () => {
    mockWorld(server, world());
    render();
    await screen.findByText(/Coverage last checked/);
    fireEvent.click(screen.getByRole('button', { name: /Act as associate$/ }));
    expect(
      (await screen.findAllByRole('option')).map((o) => o.textContent)
    ).toEqual(['Cy Moss (cy@example.com)']);
    fireEvent.click(
      screen.getByRole('option', { name: 'Cy Moss (cy@example.com)' })
    );
    expect(
      await screen.findByText(
        /acts as Cy Moss \(cy@example.com\), an associate of unit-a/
      )
    ).toBeInTheDocument();
  });

  it('lists the budget rule read as the associate and warns about a role that may order but is no requester [BCC-APPR-3]', async () => {
    const calls = mockWorld(
      server,
      world({
        rules: [
          rule(),
          rule({ id: 'r-2', key: 'other', predicate: 'totalPrice > "1 EUR"' }),
        ],
      })
    );
    render();
    await actAs('Cy Moss (cy@example.com)');
    expect(await screen.findByText('bcc-budget-unit-a')).toBeInTheDocument();
    expect(screen.queryByText('other')).not.toBeInTheDocument();
    expect(calls.ruleReads).toEqual([
      { associateId: 'c-3', unitKey: 'unit-a' },
    ]);
    expect(
      screen.getByText(
        /site-buyer may place orders but no active budget rule lists/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('The coverage record matches the rules.')
    ).toBeInTheDocument();
  });

  it('flags a rule deactivated after the check as stale and refreshes the coverage in the full settings record (Review Focus 2)', async () => {
    const calls = mockWorld(
      server,
      world({
        rules: [
          rule({
            status: 'Inactive',
            lastModifiedAt: '2026-10-20T00:00:00.000Z',
          }),
        ],
      })
    );
    render();
    await actAs('Cy Moss (cy@example.com)');
    expect(
      await screen.findByText('The coverage record is out of date.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The recorded rule is no longer an active budget rule/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The rule changed after the last check/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save check result' }));
    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.writes[0]).toEqual({
      container: CONTAINERS.settings,
      key: 'unit-a',
      version: 7,
      // Dated no earlier than the rule's last change.
      value: { ...settings, approval: { requesterRoles: [], checkedAt: NOW } },
    });
  });

  it('sets up the budget rule as the associate and writes the coverage [BCC-APPR-4] (finding 1: checked at write time)', async () => {
    const w = world({ rules: [] });
    const calls = mockWorld(server, w);
    render(MANAGER, { clock: null });
    await actAs('Cy Moss (cy@example.com)');
    expect(
      await screen.findByRole('heading', { name: 'Set up budget approval' })
    ).toBeInTheDocument();
    // Roles that may order are preselected as requesters.
    expect(
      screen.getByRole('checkbox', { name: 'Requester Buyer' })
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Requester Site buyer' })
    ).toBeChecked();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Requester Site buyer' })
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tier 1 Approver' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Create rule as Cy Moss (cy@example.com)',
      })
    );

    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.ruleCreates).toEqual([
      {
        associateId: 'c-3',
        unitKey: 'unit-a',
        body: {
          key: 'bcc-budget-unit-a',
          name: 'Budget approval (Budgets & Cost Centers)',
          status: 'Active',
          predicate: 'custom.bccBudgetExceeded = true',
          requesters: [
            { associateRole: { typeId: 'associate-role', key: 'buyer' } },
          ],
          approvers: {
            tiers: [
              {
                and: [
                  {
                    or: [
                      {
                        associateRole: {
                          typeId: 'associate-role',
                          key: 'approver',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    ]);
    const created = w.rules![0] as { id: string; lastModifiedAt: string };
    const written = calls.writes[0]!.value as Settings;
    expect(calls.writes[0]).toEqual(
      expect.objectContaining({
        key: 'unit-a',
        version: 7,
        value: {
          ...settings,
          approval: {
            ruleKey: 'bcc-budget-unit-a',
            ruleId: created.id,
            requesterRoles: ['buyer'],
            checkedAt: expect.any(String),
          },
        },
      })
    );
    // The rule was created after the panel opened; the check must not be dated before it.
    expect(Date.parse(written.approval.checkedAt!)).toBeGreaterThanOrEqual(
      Date.parse(created.lastModifiedAt)
    );
    expect(await screen.findByText('bcc-budget-unit-a')).toBeInTheDocument();
  });

  it('refuses a setup without an approver tier', async () => {
    const calls = mockWorld(server, world({ rules: [] }));
    render();
    await actAs('Cy Moss (cy@example.com)');
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Create rule as Cy Moss (cy@example.com)',
      })
    );
    expect(
      await screen.findByText(/Approver tiers: Use one to five approver tiers/)
    ).toBeInTheDocument();
    expect(calls.ruleCreates).toEqual([]);
  });

  it('says so when no associate of the unit may create Approval Rules', async () => {
    mockWorld(
      server,
      world({
        roles: ROLES.map((r) => ({
          ...r,
          permissions: r.permissions.filter((p) => p !== 'CreateApprovalRules'),
        })),
      })
    );
    render();
    expect(
      await screen.findByText(
        /No associate of unit-a holds CreateApprovalRules/
      )
    ).toBeInTheDocument();
  });

  it('lets a view-only user check but shows no setup or save control [BCC-VIEW-9]', async () => {
    mockWorld(server, world({ rules: [] }));
    render(VIEW_ONLY);
    await actAs('Cy Moss (cy@example.com)');
    expect(
      await screen.findByText('No active budget rule exists in this unit.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Set up budget approval' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Create rule|Save check result/ })
    ).not.toBeInTheDocument();
  });

  describe('review findings', () => {
    it('finding 3: lists a conditional budget rule as not counting for coverage and records no coverage from it [BCC-APPR-1]', async () => {
      const calls = mockWorld(
        server,
        world({
          rules: [
            rule({
              predicate:
                'custom.bccBudgetExceeded = true and totalPrice.centAmount > 1000000',
            }),
          ],
        })
      );
      render();
      await actAs('Cy Moss (cy@example.com)');
      expect(await screen.findByText('bcc-budget-unit-a')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Does not count for coverage: the predicate has further conditions.'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(/buyer, site-buyer may place orders/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/has further conditions, so it no longer covers/)
      ).toBeInTheDocument();
      // A rule that counts can be set up next to it.
      expect(
        screen.getByRole('heading', { name: 'Set up budget approval' })
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: 'Save check result' })
      );
      await waitFor(() => expect(calls.writes).toHaveLength(1));
      expect((calls.writes[0]!.value as Settings).approval).toEqual({
        requesterRoles: [],
        checkedAt: NOW,
      });
    });

    it('finding 3: marks an exact rule as counting and records its id', async () => {
      const calls = mockWorld(
        server,
        world({
          records: {
            [CONTAINERS.settings]: [
              {
                key: 'unit-a',
                version: 7,
                value: { ...settings, approval: { requesterRoles: [] } },
              },
            ],
            [CONTAINERS.costObjects]: [],
          },
        })
      );
      render();
      await screen.findByText(/Coverage has never been checked/);
      await pick('Act as associate', 'Cy Moss (cy@example.com)');
      expect(
        await screen.findByText('Counts for coverage.')
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: 'Save check result' })
      );
      await waitFor(() => expect(calls.writes).toHaveLength(1));
      expect((calls.writes[0]!.value as Settings).approval).toEqual({
        ruleKey: 'bcc-budget-unit-a',
        ruleId: 'r-1',
        requesterRoles: ['buyer'],
        checkedAt: NOW,
      });
    });

    it('finding 8: treats a settings record created meanwhile like a conflict and offers a reload', async () => {
      const w = world({
        units: [UNIT_A, { ...DIVISION_A1, associates: UNIT_A.associates }],
        records: {
          [CONTAINERS.settings]: [
            { key: 'unit-a', version: 7, value: settings },
          ],
          [CONTAINERS.costObjects]: [],
        },
        rules: [
          rule({
            businessUnit: { typeId: 'business-unit', key: 'division-a1' },
          }),
        ],
      });
      const calls = mockWorld(server, w);
      render(MANAGER, { unit: unitSummary(DIVISION_A1) });
      await screen.findByText(/no own settings record/);
      await pick('Act as associate', 'Cy Moss (cy@example.com)');
      await screen.findByText('bcc-budget-unit-a');
      w.records![CONTAINERS.settings]!.push({
        key: 'division-a1',
        version: 1,
        value: { ...settings, approval: { requesterRoles: [] } },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Save check result' })
      );
      expect(
        await screen.findByText('Someone else changed this record.')
      ).toBeInTheDocument();
      expect(calls.writes).toEqual([]);
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
      expect(
        await screen.findByText(/Coverage has never been checked/)
      ).toBeInTheDocument();
    });

    it('finding 10: shows the rules of the associate picked last when an earlier read answers later', async () => {
      const u = {
        ...UNIT_A,
        associates: UNIT_A.associates.map((a) =>
          a.customer.id === 'c-2'
            ? {
                ...a,
                associateRoleAssignments: [
                  ...a.associateRoleAssignments,
                  {
                    associateRole: { typeId: 'associate-role', key: 'admin' },
                    inheritance: 'Enabled',
                  },
                ],
              }
            : a
        ),
      };
      mockWorld(server, world({ units: [u] }));
      server.use(
        rest.get(
          `${API}/as-associate/:associateId/in-business-unit/key=:unitKey/approval-rules`,
          (req, res, ctx) =>
            req.params.associateId === 'c-3'
              ? res(
                  ctx.delay(150),
                  ctx.json({ results: [rule({ key: 'slow-rule' })] })
                )
              : res(ctx.json({ results: [rule({ key: 'fast-rule' })] }))
        )
      );
      render();
      await actAs('Cy Moss (cy@example.com)');
      await pick('Act as associate', 'Bo Reed (bo@example.com)');
      expect(await screen.findByText('fast-rule')).toBeInTheDocument();
      await act(() => new Promise((r) => setTimeout(r, 300)));
      expect(screen.queryByText('slow-rule')).not.toBeInTheDocument();
      expect(screen.getByText('fast-rule')).toBeInTheDocument();
    });

    it('finding 11: does not warn about roles the parent covers in a division that inherits rules [BCC-APPR-2]', async () => {
      const division = {
        ...DIVISION_A1,
        approvalRuleMode: 'ExplicitAndFromParent',
        associates: UNIT_A.associates,
      };
      mockWorld(
        server,
        world({
          units: [UNIT_A, division],
          records: {
            [CONTAINERS.settings]: [
              {
                key: 'unit-a',
                version: 7,
                value: {
                  ...settings,
                  approval: {
                    ruleKey: 'parent-rule',
                    requesterRoles: ['site-buyer'],
                    checkedAt: '2026-10-15T00:00:00.000Z',
                  },
                },
              },
            ],
            [CONTAINERS.costObjects]: [],
          },
        })
      );
      render(MANAGER, {
        unit: {
          ...unitSummary(DIVISION_A1),
          approvalRuleMode: 'ExplicitAndFromParent' as 'Explicit',
        },
      });
      await screen.findByText(/no own settings record/);
      await pick('Act as associate', 'Cy Moss (cy@example.com)');
      expect(await screen.findByText('bcc-budget-unit-a')).toBeInTheDocument();
      expect(
        screen.queryByText(/may place orders but no active budget rule/)
      ).not.toBeInTheDocument();
    });
  });
});
