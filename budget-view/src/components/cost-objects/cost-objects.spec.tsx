// Cost objects section: own editable, inherited read-only, add with a free key, deactivate, conflict, view-only.
// [BCC-VIEW-2] [BCC-VIEW-6] [BCC-VIEW-8] [BCC-VIEW-9] [BCC-COST-2] [BCC-COST-5]
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
import { pick, type } from '../../test-utils/ui';
import CostObjects from './cost-objects';

const server = startServer();
const NOW = '2026-11-02T10:00:00.000Z';

const co = (over: Partial<CostObject>): CostObject => ({
  code: 'CC-100',
  name: 'Head office (fictional)',
  type: 'cost-center',
  ownerBusinessUnitKey: 'unit-a',
  active: true,
  ...over,
});
const rec = (value: CostObject, version = 3) => ({
  key: `${value.ownerBusinessUnitKey}~${value.code}`,
  version,
  value,
});

const world = (over: Partial<World> = {}): World => ({
  units: [UNIT_A, DIVISION_A1],
  roles: ROLES,
  customers: CUSTOMERS,
  records: {
    [CONTAINERS.costObjects]: [
      rec(co({})),
      rec(
        co({
          code: 'SITE-1',
          name: 'North Yard (fictional)',
          type: 'site',
          ownerBusinessUnitKey: 'division-a1',
        })
      ),
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
        <CostObjects unit={unitSummary(unit)} now={NOW} />
      </PanelProviders>
    ),
  });

const rowOf = async (code: string) =>
  (await screen.findByText(code)).closest('tr') as HTMLElement;

describe('CostObjects', () => {
  it('shows a division its own cost objects editable and the parent ones read-only with the owner', async () => {
    mockWorld(server, world());
    render(DIVISION_A1);

    const own = await rowOf('SITE-1');
    expect(
      within(own).getByRole('button', { name: 'Edit SITE-1' })
    ).toBeInTheDocument();
    const inherited = await rowOf('CC-100');
    expect(within(inherited).getByText('unit-a')).toBeInTheDocument();
    expect(
      within(inherited).getByText('Inherited, read-only')
    ).toBeInTheDocument();
    expect(within(inherited).queryByRole('button')).not.toBeInTheDocument();
  });

  it('adds a site SITE-7 as unit-a~SITE-7 after checking that the key is free', async () => {
    const calls = mockWorld(server, world());
    render(UNIT_A);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add cost object' })
    );
    type('Code', 'SITE-7');
    type('Name', 'Riverside Depot (fictional)');
    await pick('Type', 'Site');
    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Ada Lane (ada@example.com)',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await rowOf('SITE-7')).toBeInTheDocument();
    expect(calls.writes).toEqual([
      {
        container: CONTAINERS.costObjects,
        key: 'unit-a~SITE-7',
        value: {
          code: 'SITE-7',
          name: 'Riverside Depot (fictional)',
          type: 'site',
          ownerBusinessUnitKey: 'unit-a',
          active: true,
          buyers: ['c-1'],
        },
      },
    ]);
  });

  it('refuses to create a cost object whose key exists', async () => {
    const calls = mockWorld(server, world());
    render(UNIT_A);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add cost object' })
    );
    type('Code', 'CC-100');
    type('Name', 'Duplicate (fictional)');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        /A record with the key unit-a~CC-100 exists already/
      )
    ).toBeInTheDocument();
    expect(calls.writes).toEqual([]);
  });

  it('shows core field errors before any request', async () => {
    const calls = mockWorld(server, world());
    render(UNIT_A);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add cost object' })
    );
    type('Code', 'bad code');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(/^Name: Name is required/)
    ).toBeInTheDocument();
    expect(calls.writes).toEqual([]);
  });

  it('deactivates with active false and the version it read', async () => {
    const calls = mockWorld(server, world());
    render(UNIT_A);
    fireEvent.click(
      within(await rowOf('CC-100')).getByRole('button', {
        name: 'Deactivate CC-100',
      })
    );
    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.writes[0]).toEqual({
      container: CONTAINERS.costObjects,
      key: 'unit-a~CC-100',
      value: co({ active: false }),
      version: 3,
    });
    expect(
      await within(await rowOf('CC-100')).findByText('Inactive')
    ).toBeInTheDocument();
  });

  it('keeps the input on a version conflict and offers a reload', async () => {
    const calls = mockWorld(server, world({ conflictOn: ['unit-a~CC-100'] }));
    render(UNIT_A);
    fireEvent.click(
      within(await rowOf('CC-100')).getByRole('button', { name: 'Edit CC-100' })
    );
    type('Name', 'Renamed (fictional)');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Someone else changed this record.')
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Renamed (fictional)'
    );
    expect(calls.writes[0]).toEqual(expect.objectContaining({ version: 3 }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Someone else changed this record.')
      ).not.toBeInTheDocument()
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Renamed (fictional)'
    );
  });

  it('edits project fields of a project', async () => {
    const calls = mockWorld(
      server,
      world({
        records: {
          [CONTAINERS.costObjects]: [
            rec(
              co({
                code: 'PRJ-1001',
                name: 'Harbour Hall (fictional)',
                type: 'project',
                project: { status: 'active' },
              })
            ),
          ],
        },
      })
    );
    render(UNIT_A);
    fireEvent.click(
      within(await rowOf('PRJ-1001')).getByRole('button', {
        name: 'Edit PRJ-1001',
      })
    );
    type('ERP project number', 'ERP-77');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.writes).toHaveLength(1));
    expect(calls.writes[0]?.value).toEqual(
      expect.objectContaining({
        project: { status: 'active', erpProjectNumber: 'ERP-77' },
      })
    );
  });

  it('opens the project overview of a project [BCC-VIEW-6]', async () => {
    mockWorld(
      server,
      world({
        records: {
          [CONTAINERS.costObjects]: [
            rec(
              co({
                code: 'PRJ-1001',
                name: 'Harbour Hall (fictional)',
                type: 'project',
                project: { status: 'active' },
              })
            ),
          ],
        },
      })
    );
    render(UNIT_A, VIEW_ONLY);
    fireEvent.click(
      within(await rowOf('PRJ-1001')).getByRole('button', {
        name: 'Open project PRJ-1001',
      })
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Project PRJ-1001: Harbour Hall (fictional)',
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /No shopping list, cart, quote or order carries this project yet/
      )
    ).toBeInTheDocument();
  });

  it('shows a view-only user all cost objects without add, edit or deactivate controls [BCC-VIEW-9]', async () => {
    mockWorld(server, world());
    render(DIVISION_A1, VIEW_ONLY);
    expect(await rowOf('SITE-1')).toBeInTheDocument();
    expect(await rowOf('CC-100')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Add|Edit|Deactivate/ })
    ).not.toBeInTheDocument();
  });

  describe('review findings', () => {
    const project = (owner = 'unit-a') =>
      rec(
        co({
          code: 'PRJ-1001',
          name: 'Harbour Hall (fictional)',
          type: 'project',
          ownerBusinessUnitKey: owner,
          project: { status: 'active', siteAddress: 'Pier 1' },
        })
      );

    it('finding 9: after a conflict reload the project fields show the fresh record and name the changed fields', async () => {
      const w = world({
        records: { [CONTAINERS.costObjects]: [project()] },
        conflictOn: ['unit-a~PRJ-1001'],
      });
      const calls = mockWorld(server, w);
      render(UNIT_A);
      fireEvent.click(
        within(await rowOf('PRJ-1001')).getByRole('button', {
          name: 'Open project PRJ-1001',
        })
      );
      await screen.findByRole('heading', {
        name: 'Project PRJ-1001: Harbour Hall (fictional)',
      });
      type('ERP project number', 'ERP-77');
      fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
      expect(
        await screen.findByText('Someone else changed this record.')
      ).toBeInTheDocument();
      Object.assign(w.records![CONTAINERS.costObjects]![0]!, {
        version: 4,
        value: co({
          code: 'PRJ-1001',
          name: 'Harbour Hall (fictional)',
          type: 'project',
          project: { status: 'active', siteAddress: 'Pier 9' },
        }),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
      expect(
        await screen.findByText('Changed by someone else: Site address.')
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your unsaved values were replaced: ERP project number.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Site address' })).toHaveValue(
        'Pier 9'
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Re-apply my values' })
      );
      expect(
        screen.getByRole('textbox', { name: 'ERP project number' })
      ).toHaveValue('ERP-77');
      expect(screen.getByRole('textbox', { name: 'Site address' })).toHaveValue(
        'Pier 9'
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
      await waitFor(() => expect(calls.writes).toHaveLength(2));
      expect(calls.writes[1]).toEqual(
        expect.objectContaining({
          version: 4,
          value: expect.objectContaining({
            project: {
              status: 'active',
              siteAddress: 'Pier 9',
              erpProjectNumber: 'ERP-77',
            },
          }),
        })
      );
    });

    it('finding 12: opens an inherited project read-only from a division', async () => {
      mockWorld(
        server,
        world({ records: { [CONTAINERS.costObjects]: [project()] } })
      );
      render(DIVISION_A1);
      fireEvent.click(
        within(await rowOf('PRJ-1001')).getByRole('button', {
          name: 'Open project PRJ-1001',
        })
      );
      expect(
        await screen.findByRole('heading', {
          name: 'Project PRJ-1001: Harbour Hall (fictional)',
        })
      ).toBeInTheDocument();
      expect(await screen.findByText('Pier 1')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Save/ })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('finding 13: lists a former associate among the buyers so they can be removed', async () => {
      const calls = mockWorld(
        server,
        world({
          records: {
            [CONTAINERS.costObjects]: [rec(co({ buyers: ['c-1', 'c-gone'] }))],
          },
        })
      );
      render(UNIT_A);
      fireEvent.click(
        within(await rowOf('CC-100')).getByRole('button', {
          name: 'Edit CC-100',
        })
      );
      const former = await screen.findByRole('checkbox', {
        name: 'c-gone (no longer an associate)',
      });
      expect(former).toBeChecked();
      fireEvent.click(former);
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(calls.writes).toHaveLength(1));
      expect(calls.writes[0]?.value).toEqual(
        expect.objectContaining({ buyers: ['c-1'] })
      );
    });

    it('finding 13: offers the associates of the divisions for a cost object of the parent', async () => {
      const calls = mockWorld(
        server,
        world({
          units: [
            UNIT_A,
            {
              ...DIVISION_A1,
              associates: [
                {
                  customer: { typeId: 'customer', id: 'c-9' },
                  associateRoleAssignments: [
                    {
                      associateRole: { typeId: 'associate-role', key: 'buyer' },
                      inheritance: 'Enabled',
                    },
                  ],
                },
              ],
            },
          ],
          customers: [
            ...CUSTOMERS,
            {
              id: 'c-9',
              email: 'di@example.com',
              firstName: 'Di',
              lastName: 'Vale',
            },
          ],
        })
      );
      render(UNIT_A);
      fireEvent.click(
        within(await rowOf('CC-100')).getByRole('button', {
          name: 'Edit CC-100',
        })
      );
      fireEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Di Vale (di@example.com), division-a1',
        })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(calls.writes).toHaveLength(1));
      expect(calls.writes[0]?.value).toEqual(
        expect.objectContaining({ buyers: ['c-9'] })
      );
    });
  });
});
