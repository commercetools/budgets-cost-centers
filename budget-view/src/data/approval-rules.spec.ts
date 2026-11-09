// Approval Rules through the as-associate endpoints, the only ones the API offers. [BCC-APPR-3] [BCC-APPR-4]
import { rest } from 'msw';
import { hooks } from '@commercetools-frontend/application-shell/test-utils';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import { API, PROJECT, startServer } from '../test-utils/platform-mock';
import type { Dispatch } from './client';
import { createApprovalRule, fetchApprovalRules } from './approval-rules';

const server = startServer();
const BASE = `${API}/as-associate/c-1/in-business-unit/key=unit-a/approval-rules`;

const renderDispatch = () =>
  hooks.renderHook(() => useAsyncDispatch() as unknown as Dispatch, {
    project: { key: PROJECT },
  }).result.current;

describe('approval rules', () => {
  it('reads the rules of the unit as the chosen associate', async () => {
    let url: URL | undefined;
    server.use(
      rest.get(BASE, (req, res, ctx) => {
        url = req.url;
        return res(ctx.json({ results: [{ id: 'r-1', name: 'x' }] }));
      })
    );
    const rules = await fetchApprovalRules(
      renderDispatch(),
      PROJECT,
      'c-1',
      'unit-a'
    );
    expect(rules).toEqual([{ id: 'r-1', name: 'x' }]);
    expect(url!.searchParams.get('sort')).toBe('id asc');
  });

  it('creates a rule as the chosen associate', async () => {
    let body: unknown;
    server.use(
      rest.post(BASE, async (req, res, ctx) => {
        body = await req.json();
        return res(ctx.status(201), ctx.json({ id: 'r-2', key: 'k' }));
      })
    );
    const draft = { key: 'k', name: 'n' };
    await expect(
      createApprovalRule(renderDispatch(), PROJECT, 'c-1', 'unit-a', draft)
    ).resolves.toEqual({ id: 'r-2', key: 'k' });
    expect(body).toEqual(draft);
  });
});
