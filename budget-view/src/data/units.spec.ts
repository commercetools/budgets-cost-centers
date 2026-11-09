// The unit of the host page and its ancestors, as core's UnitNode chain. [BCC-VIEW-1] [BCC-COST-5] [BCC-SET-2]
import { rest } from 'msw';
import {
  hooks,
  waitFor,
} from '@commercetools-frontend/application-shell/test-utils';
import { API, PROJECT, startServer } from '../test-utils/platform-mock';
import { unitIdFromHostUrl, useUnitChain } from './units';

const server = startServer();

describe('unitIdFromHostUrl', () => {
  it('reads the unit ID from the Business Unit detail page', () => {
    expect(
      unitIdFromHostUrl(
        'https://mc.europe-west1.gcp.commercetools.com/demo/customers/business-units/abc-1/general'
      )
    ).toBe('abc-1');
    expect(
      unitIdFromHostUrl(
        'https://mc.europe-west1.gcp.commercetools.com/demo/customers/business-units/abc-1'
      )
    ).toBe('abc-1');
  });

  it('returns nothing for other pages', () => {
    expect(
      unitIdFromHostUrl(
        'https://mc.europe-west1.gcp.commercetools.com/demo/orders/abc-1/general'
      )
    ).toBeUndefined();
    expect(unitIdFromHostUrl(undefined)).toBeUndefined();
  });
});

describe('useUnitChain', () => {
  it('walks from a division up to its company', async () => {
    server.use(
      rest.get(`${API}/business-units/key=:key`, (req, res, ctx) => {
        const units: Record<string, object> = {
          'division-a1': {
            id: 'd1',
            key: 'division-a1',
            name: 'Division A1 (fictional)',
            unitType: 'Division',
            parentUnit: { typeId: 'business-unit', key: 'unit-a' },
            approvalRuleMode: 'ExplicitAndFromParent',
          },
          'unit-a': {
            id: 'c1',
            key: 'unit-a',
            name: 'Unit A (fictional)',
            unitType: 'Company',
            approvalRuleMode: 'Explicit',
          },
        };
        const unit = units[req.params.key as string];
        return unit
          ? res(ctx.json(unit))
          : res(
              ctx.status(404),
              ctx.json({ statusCode: 404, message: 'Not found' })
            );
      })
    );
    const { result } = hooks.renderHook(() => useUnitChain('division-a1'), {
      project: { key: PROJECT },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeUndefined();
    expect(result.current.units).toEqual([
      expect.objectContaining({
        key: 'division-a1',
        parentKey: 'unit-a',
        approvalRuleMode: 'ExplicitAndFromParent',
      }),
      expect.objectContaining({ key: 'unit-a', approvalRuleMode: 'Explicit' }),
    ]);
    expect(result.current.units[1]).not.toHaveProperty('parentKey');
  });

  it('reports a failed read', async () => {
    server.use(
      rest.get(`${API}/business-units/key=:key`, (_req, res, ctx) =>
        res(ctx.status(500), ctx.json({ statusCode: 500, message: 'Boom.' }))
      )
    );
    const { result } = hooks.renderHook(() => useUnitChain('unit-a'), {
      project: { key: PROJECT },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toEqual({
      kind: 'request',
      message: 'Boom.',
      statusCode: 500,
    });
    expect(result.current.units).toEqual([]);
  });
});
