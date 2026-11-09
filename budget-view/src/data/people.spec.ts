// Associates and roles of a unit, read through the proxy. [BCC-VIEW-3] [BCC-BUDGET-8] [BCC-APPR-4]
import { rest } from 'msw';
import {
  hooks,
  waitFor,
} from '@commercetools-frontend/application-shell/test-utils';
import { API, PROJECT, startServer } from '../test-utils/platform-mock';
import { useUnitPeople } from './people';

const server = startServer();

describe('useUnitPeople', () => {
  it('reads the unit associates, their customers and all associate roles', async () => {
    const customerWhere: string[] = [];
    server.use(
      rest.get(`${API}/business-units/key=unit-a`, (_req, res, ctx) =>
        res(
          ctx.json({
            id: 'u1',
            key: 'unit-a',
            associates: [
              {
                customer: { typeId: 'customer', id: 'c-1' },
                associateRoleAssignments: [
                  {
                    associateRole: { typeId: 'associate-role', key: 'buyer' },
                    inheritance: 'Enabled',
                  },
                ],
              },
            ],
          })
        )
      ),
      rest.get(`${API}/customers`, (req, res, ctx) => {
        customerWhere.push(...req.url.searchParams.getAll('where'));
        return res(
          ctx.json({ results: [{ id: 'c-1', email: 'ada@example.com' }] })
        );
      }),
      rest.get(`${API}/associate-roles`, (_req, res, ctx) =>
        res(
          ctx.json({
            results: [
              {
                id: 'r1',
                key: 'buyer',
                name: 'Buyer',
                buyerAssignable: true,
                permissions: ['CreateMyOrdersFromMyCarts'],
              },
            ],
          })
        )
      )
    );
    const { result } = hooks.renderHook(() => useUnitPeople('unit-a'), {
      project: { key: PROJECT },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeUndefined();
    expect(result.current.people).toEqual([
      { customerId: 'c-1', label: 'ada@example.com', roles: ['buyer'] },
    ]);
    expect(result.current.roles).toEqual([
      {
        key: 'buyer',
        name: 'Buyer',
        permissions: ['CreateMyOrdersFromMyCarts'],
      },
    ]);
    expect(customerWhere).toEqual(['id in ("c-1")']);
  });

  it('reports a failed read', async () => {
    server.use(
      rest.get(`${API}/business-units/key=unit-a`, (_req, res, ctx) =>
        res(
          ctx.status(403),
          ctx.json({ statusCode: 403, message: 'Forbidden.' })
        )
      ),
      rest.get(`${API}/associate-roles`, (_req, res, ctx) =>
        res(ctx.json({ results: [] }))
      )
    );
    const { result } = hooks.renderHook(() => useUnitPeople('unit-a'), {
      project: { key: PROJECT },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toEqual(
      expect.objectContaining({ statusCode: 403 })
    );
  });
});
