// Everything that carries a project key, read through the proxy. [BCC-PROJ-1] [BCC-PROJ-2] [BCC-VIEW-6]
import { rest } from 'msw';
import { hooks } from '@commercetools-frontend/application-shell/test-utils';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import {
  API,
  PROJECT,
  startServer,
  whereOf,
} from '../test-utils/platform-mock';
import type { Dispatch } from './client';
import { fetchProjectSources } from './project';

const server = startServer();

describe('fetchProjectSources', () => {
  it('reads shopping lists, active carts, quote requests, quotes and orders with the project predicate', async () => {
    const seen: Record<string, string[]> = {};
    const handler = (name: string) =>
      rest.get(`${API}/${name}`, (req, res, ctx) => {
        seen[name] = whereOf(req.url);
        return res(ctx.json({ results: [{ id: `${name}-1` }] }));
      });
    server.use(
      handler('shopping-lists'),
      handler('carts'),
      handler('quote-requests'),
      handler('quotes'),
      handler('orders')
    );
    const dispatch = hooks.renderHook(
      () => useAsyncDispatch() as unknown as Dispatch,
      {
        project: { key: PROJECT },
      }
    ).result.current;
    const s = await fetchProjectSources(dispatch, PROJECT, 'unit-a~PRJ-1');
    expect(s.carts).toEqual([{ id: 'carts-1' }]);
    expect(s.shoppingLists).toEqual([{ id: 'shopping-lists-1' }]);
    expect(seen).toEqual({
      'shopping-lists': ['custom(fields(bccCostObject="unit-a~PRJ-1"))'],
      carts: [
        'custom(fields(bccCostObject="unit-a~PRJ-1")) and cartState="Active"',
      ],
      'quote-requests': ['custom(fields(bccCostObject="unit-a~PRJ-1"))'],
      quotes: ['custom(fields(bccCostObject="unit-a~PRJ-1"))'],
      orders: ['custom(fields(bccCostObject="unit-a~PRJ-1"))'],
    });
  });
});
