// Custom Object reads and writes: version on every write, conflicts, core validation both ways, free keys. [BCC-VIEW-8]
// [BCC-COST-3] [BCC-BUDGET-1] [BCC-SET-1]
import { rest } from 'msw';
import {
  act,
  hooks,
  waitFor,
} from '@commercetools-frontend/application-shell/test-utils';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import { CONTAINERS, type CostObject } from '../core';
import {
  API,
  PROJECT,
  startServer,
  whereOf,
} from '../test-utils/platform-mock';
import type { Dispatch } from './client';
import { recordExists, saveRecord, useRecords, validatorFor } from './records';

const server = startServer();

const site: CostObject = {
  code: 'SITE-7',
  name: 'Riverside Depot (fictional)',
  type: 'site',
  ownerBusinessUnitKey: 'unit-a',
  active: true,
};

const renderDispatch = () =>
  hooks.renderHook(() => useAsyncDispatch() as unknown as Dispatch, {
    project: { key: PROJECT },
  }).result.current;

describe('saveRecord', () => {
  it('sends container, key, value and the version it read', async () => {
    let body: unknown;
    server.use(
      rest.post(`${API}/custom-objects`, async (req, res, ctx) => {
        body = await req.json();
        return res(
          ctx.json({
            id: 'co-1',
            container: CONTAINERS.costObjects,
            key: 'unit-a~SITE-7',
            value: site,
            version: 4,
          })
        );
      })
    );
    const result = await saveRecord(
      renderDispatch(),
      PROJECT,
      CONTAINERS.costObjects,
      'unit-a~SITE-7',
      site,
      3
    );
    expect(body).toEqual({
      container: CONTAINERS.costObjects,
      key: 'unit-a~SITE-7',
      value: site,
      version: 3,
    });
    expect(result).toEqual({ ok: true, version: 4 });
  });

  it('creates without a version when there is none yet', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      rest.post(`${API}/custom-objects`, async (req, res, ctx) => {
        body = await req.json();
        return res(
          ctx.status(201),
          ctx.json({
            id: 'co-1',
            container: CONTAINERS.costObjects,
            key: 'unit-a~SITE-7',
            value: site,
            version: 1,
          })
        );
      })
    );
    const result = await saveRecord(
      renderDispatch(),
      PROJECT,
      CONTAINERS.costObjects,
      'unit-a~SITE-7',
      site
    );
    expect(body).not.toHaveProperty('version');
    expect(result).toEqual({ ok: true, version: 1 });
  });

  it('reports a version conflict as conflict, so the form can keep the input', async () => {
    server.use(
      rest.post(`${API}/custom-objects`, (_req, res, ctx) =>
        res(
          ctx.status(409),
          ctx.json({
            statusCode: 409,
            message: 'Object has a different version than expected.',
            errors: [
              {
                code: 'ConcurrentModification',
                message: 'Object has a different version than expected.',
                currentVersion: 5,
              },
            ],
          })
        )
      )
    );
    const result = await saveRecord(
      renderDispatch(),
      PROJECT,
      CONTAINERS.costObjects,
      'unit-a~SITE-7',
      site,
      3
    );
    expect(result).toEqual({ ok: false, conflict: true });
  });

  it('reports other failures with the platform message', async () => {
    server.use(
      rest.post(`${API}/custom-objects`, (_req, res, ctx) =>
        res(
          ctx.status(403),
          ctx.json({
            statusCode: 403,
            message: 'Insufficient scope.',
            errors: [],
          })
        )
      )
    );
    const result = await saveRecord(
      renderDispatch(),
      PROJECT,
      CONTAINERS.costObjects,
      'unit-a~SITE-7',
      site,
      3
    );
    expect(result).toEqual({ ok: false, message: 'Insufficient scope.' });
  });

  it.each([
    [
      'a value core rejects',
      CONTAINERS.costObjects,
      'unit-a~SITE-7',
      { ...site, name: '' },
    ],
    [
      'a key that does not match owner and code',
      CONTAINERS.costObjects,
      'unit-b~SITE-7',
      site,
    ],
    [
      'a budget key of another owner',
      CONTAINERS.budgets,
      'unit-b~monthly',
      {
        scope: { kind: 'business-unit', ref: 'unit-a' },
        ownerBusinessUnitKey: 'unit-a',
        amount: { currencyCode: 'EUR', centAmount: 100000 },
        period: { kind: 'month', from: '2026-11-01' },
        mode: 'warn',
        warnAtPercent: 80,
        active: true,
      },
    ],
    [
      'a settings default cost object the unit cannot use',
      CONTAINERS.settings,
      'unit-a',
      {
        defaultMode: 'approval',
        costObjectRequired: true,
        defaultCostObject: 'unit-z~CC-1',
        costObjectLevel: 'order',
        features: { projects: true },
        approval: { requesterRoles: [] },
      },
    ],
    ['an unknown container', 'other-container', 'unit-a', {}],
  ])('rejects %s before any request', async (_name, container, key, value) => {
    const seen: string[] = [];
    server.events.on('request:start', (req) => seen.push(req.url.href));
    const result = await saveRecord(
      renderDispatch(),
      PROJECT,
      container,
      key,
      value,
      1
    );
    server.events.removeAllListeners();
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ field: expect.any(String) }),
      ]),
    });
    expect(seen).toEqual([]);
  });

  it('finding 7: returns its own key and container errors as message descriptors, not English text', async () => {
    for (const [container, key, value] of [
      [CONTAINERS.costObjects, 'unit-b~SITE-7', site],
      ['other-container', 'unit-a', {}],
    ] as const) {
      const result = await saveRecord(
        renderDispatch(),
        PROJECT,
        container,
        key,
        value,
        1
      );
      expect(result.ok).toBe(false);
      const errors = (result as { errors: Array<{ message: unknown }> }).errors;
      expect(errors[0]!.message).toEqual(
        expect.objectContaining({ id: expect.any(String) })
      );
    }
  });

  it('accepts a settings default cost object the unit can use', async () => {
    server.use(
      rest.post(`${API}/custom-objects`, (_req, res, ctx) =>
        res(
          ctx.json({
            id: 's-1',
            container: CONTAINERS.settings,
            key: 'unit-a',
            value: {},
            version: 2,
          })
        )
      )
    );
    const settings = {
      defaultMode: 'approval',
      costObjectRequired: true,
      defaultCostObject: 'unit-a~CC-1',
      costObjectLevel: 'order',
      features: { projects: true },
      approval: { requesterRoles: [] },
    };
    const result = await saveRecord(
      renderDispatch(),
      PROJECT,
      CONTAINERS.settings,
      'unit-a',
      settings,
      1,
      {
        visibleCostObjectKeys: ['unit-a~CC-1'],
      }
    );
    expect(result).toEqual({ ok: true, version: 2 });
  });
});

describe('validatorFor', () => {
  it('picks the core validator by container', () => {
    expect(validatorFor(CONTAINERS.costObjects)?.(site).ok).toBe(true);
    expect(validatorFor(CONTAINERS.budgets)?.(site).ok).toBe(false);
    expect(validatorFor('other')).toBeUndefined();
  });
});

describe('useRecords', () => {
  it('reads the container with its version and the given predicate', async () => {
    let url: URL | undefined;
    server.use(
      rest.get(
        `${API}/custom-objects/${CONTAINERS.costObjects}`,
        (req, res, ctx) => {
          url = req.url;
          return res(
            ctx.json({
              results: [
                {
                  id: '1',
                  container: CONTAINERS.costObjects,
                  key: 'unit-a~SITE-7',
                  value: site,
                  version: 7,
                },
              ],
            })
          );
        }
      )
    );
    const { result } = hooks.renderHook(
      () =>
        useRecords(
          CONTAINERS.costObjects,
          'value(ownerBusinessUnitKey = "unit-a")'
        ),
      {
        project: { key: PROJECT },
      }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeUndefined();
    expect(result.current.records).toEqual([
      { key: 'unit-a~SITE-7', version: 7, value: site },
    ]);
    expect(whereOf(url!)).toEqual(['value(ownerBusinessUnitKey = "unit-a")']);
    expect(url!.searchParams.get('sort')).toBe('id asc');
  });

  it('surfaces a corrupt record as an error and keeps the valid ones', async () => {
    server.use(
      rest.get(
        `${API}/custom-objects/${CONTAINERS.costObjects}`,
        (_req, res, ctx) =>
          res(
            ctx.json({
              results: [
                {
                  id: '1',
                  container: CONTAINERS.costObjects,
                  key: 'unit-a~SITE-7',
                  value: site,
                  version: 7,
                },
                {
                  id: '2',
                  container: CONTAINERS.costObjects,
                  key: 'unit-a~BROKEN',
                  value: { code: 'BROKEN' },
                  version: 1,
                },
              ],
            })
          )
      )
    );
    const { result } = hooks.renderHook(
      () => useRecords(CONTAINERS.costObjects),
      { project: { key: PROJECT } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.records.map((r) => r.key)).toEqual(['unit-a~SITE-7']);
    expect(result.current.error).toEqual({
      kind: 'invalid',
      records: [
        {
          key: 'unit-a~BROKEN',
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
          ]),
        },
      ],
    });
  });

  it('reports a failed read and reloads on demand', async () => {
    let calls = 0;
    server.use(
      rest.get(
        `${API}/custom-objects/${CONTAINERS.settings}`,
        (_req, res, ctx) => {
          calls += 1;
          return calls === 1
            ? res(
                ctx.status(500),
                ctx.json({ statusCode: 500, message: 'Boom.' })
              )
            : res(ctx.json({ results: [] }));
        }
      )
    );
    const { result } = hooks.renderHook(() => useRecords(CONTAINERS.settings), {
      project: { key: PROJECT },
    });
    await waitFor(() =>
      expect(result.current.error).toEqual(
        expect.objectContaining({ kind: 'request', statusCode: 500 })
      )
    );
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBeUndefined());
    expect(result.current.records).toEqual([]);
    expect(calls).toBe(2);
  });
});

describe('recordExists', () => {
  it('is false on 404 and true when the record is there, so a create never replaces a record', async () => {
    server.use(
      rest.get(
        `${API}/custom-objects/${CONTAINERS.costObjects}/:key`,
        (req, res, ctx) =>
          req.params.key === 'unit-a~SITE-7'
            ? res(
                ctx.json({
                  id: '1',
                  container: CONTAINERS.costObjects,
                  key: 'unit-a~SITE-7',
                  value: site,
                  version: 1,
                })
              )
            : res(
                ctx.status(404),
                ctx.json({ statusCode: 404, message: 'Not found' })
              )
      )
    );
    const dispatch = renderDispatch();
    await expect(
      recordExists(dispatch, PROJECT, CONTAINERS.costObjects, 'unit-a~SITE-7')
    ).resolves.toBe(true);
    await expect(
      recordExists(dispatch, PROJECT, CONTAINERS.costObjects, 'unit-a~SITE-8')
    ).resolves.toBe(false);
  });

  it('throws on other failures', async () => {
    server.use(
      rest.get(
        `${API}/custom-objects/${CONTAINERS.costObjects}/:key`,
        (_req, res, ctx) =>
          res(ctx.status(500), ctx.json({ statusCode: 500, message: 'Boom.' }))
      )
    );
    await expect(
      recordExists(
        renderDispatch(),
        PROJECT,
        CONTAINERS.costObjects,
        'unit-a~SITE-7'
      )
    ).rejects.toBeTruthy();
  });
});
