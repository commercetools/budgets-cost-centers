// Platform requests through the Merchant Center API proxy, in the user's session. [BCC-VIEW-8]
// https://docs.commercetools.com/merchant-center-customizations/development/data-fetching#rest-http-client
import { useCustomViewContext } from '@commercetools-frontend/application-shell-connectors';
import { MC_API_PROXY_TARGETS } from '@commercetools-frontend/constants';
import { actions, type TSdkAction } from '@commercetools-frontend/sdk';
import type { FieldError } from '../core';

// The SDK middleware resolves a dispatched SDK action to the response body, or rejects with the HTTP error.
export type Dispatch = (action: TSdkAction) => Promise<unknown>;

// `request` carries the platform's message, which the view shows inside a message-file frame [BCC-VIEW-10].
export type DataError =
  | { kind: 'request'; message: string; statusCode?: number }
  | { kind: 'invalid'; records: Array<{ key: string; errors: FieldError[] }> }
  | { kind: 'container'; container: string };

export const PAGE = 500;
export const q = (v: string) => JSON.stringify(v);

export const useProjectKey = (): string | undefined =>
  useCustomViewContext((context) => context.project?.key);

export const statusOf = (e: unknown): number | undefined => {
  const x = e as
    | { statusCode?: number; status?: number; body?: { statusCode?: number } }
    | undefined;
  return x?.statusCode ?? x?.status ?? x?.body?.statusCode;
};

export const messageOf = (e: unknown): string => {
  const x = e as { body?: { message?: string }; message?: string } | undefined;
  return x?.body?.message ?? x?.message ?? String(e);
};

export const requestError = (e: unknown): DataError => ({
  kind: 'request',
  message: messageOf(e),
  statusCode: statusOf(e),
});

type Query = Record<string, string | number | boolean | string[] | undefined>;

// Repeated `where` parameters are combined with AND by the platform.
export function withQuery(path: string, query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value])
      params.append(name, String(v));
  }
  const s = params.toString();
  return s ? `${path}?${s}` : path;
}

export const get = <T>(dispatch: Dispatch, uri: string): Promise<T> =>
  dispatch(
    actions.get({
      mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
      uri,
    })
  ) as Promise<T>;

export const post = <T>(
  dispatch: Dispatch,
  uri: string,
  payload: unknown
): Promise<T> =>
  dispatch(
    actions.post({
      mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
      uri,
      payload,
    })
  ) as Promise<T>;

// Pages by id instead of offset, like the service (service/src/sdk-platform.ts), so large result sets stay cheap.
export async function getAllById<T extends { id: string }>(
  dispatch: Dispatch,
  path: string,
  where: string[]
): Promise<T[]> {
  const all: T[] = [];
  for (let last: string | undefined; ; ) {
    const page = await get<{ results: T[] }>(
      dispatch,
      withQuery(path, {
        where: last ? [...where, `id > ${q(last)}`] : where,
        sort: 'id asc',
        limit: PAGE,
        withTotal: false,
      })
    );
    all.push(...page.results);
    if (page.results.length < PAGE) return all;
    last = page.results[page.results.length - 1]?.id;
  }
}
