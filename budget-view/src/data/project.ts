// Shopping lists, active carts, quote requests, quotes and orders that carry a project key. [BCC-PROJ-1]
// [BCC-PROJ-2] [BCC-VIEW-6]
// https://docs.commercetools.com/api/projects/shoppingLists https://docs.commercetools.com/api/projects/carts
// https://docs.commercetools.com/api/projects/quote-requests https://docs.commercetools.com/api/projects/quotes
import { type ProjectSources, projectWhere } from '../model/project';
import { type Dispatch, getAllById } from './client';

export async function fetchProjectSources(
  dispatch: Dispatch,
  projectKey: string,
  costObjectKey: string
): Promise<ProjectSources> {
  const read = <T extends { id: string }>(
    path: string,
    resource: Parameters<typeof projectWhere>[1]
  ) =>
    getAllById<T>(dispatch, `/${projectKey}/${path}`, [
      projectWhere(costObjectKey, resource),
    ]);
  const [shoppingLists, carts, quoteRequests, quotes, orders] =
    await Promise.all([
      read<ProjectSources['shoppingLists'][number]>(
        'shopping-lists',
        'shopping-list'
      ),
      read<ProjectSources['carts'][number]>('carts', 'cart'),
      read<ProjectSources['quoteRequests'][number]>(
        'quote-requests',
        'quote-request'
      ),
      read<ProjectSources['quotes'][number]>('quotes', 'quote'),
      read<ProjectSources['orders'][number]>('orders', 'order'),
    ]);
  return { shoppingLists, carts, quoteRequests, quotes, orders };
}
