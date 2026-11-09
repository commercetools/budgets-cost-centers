// The Business Unit on the host page and its ancestors. [BCC-VIEW-1] [BCC-COST-5] [BCC-SET-2]
// https://docs.commercetools.com/merchant-center-customizations/tooling-and-configuration/commercetools-frontend-application-shell-connectors#hosturl
// https://docs.commercetools.com/api/projects/business-units
import { useEffect, useState } from 'react';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import type { UnitNode } from '../core';
import {
  type DataError,
  type Dispatch,
  get,
  requestError,
  useProjectKey,
} from './client';

export type BusinessUnitSummary = UnitNode & {
  id: string;
  name: string;
  unitType: string;
};

type BusinessUnitResponse = {
  id: string;
  key: string;
  name: string;
  unitType: string;
  parentUnit?: { key: string };
  approvalRuleMode?: string;
};

// The detail page of a unit is `/<projectKey>/customers/business-units/<id>/<tab>`; the view reads the ID from it.
const UNIT_PATH = /\/business-units\/([^/?#]+)/;

export function unitIdFromHostUrl(
  hostUrl: string | undefined
): string | undefined {
  const m = hostUrl?.match(UNIT_PATH);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

// The SDK type is an open string union; only the two documented values are kept.
const toUnit = (bu: BusinessUnitResponse): BusinessUnitSummary => ({
  id: bu.id,
  key: bu.key,
  name: bu.name,
  unitType: bu.unitType,
  ...(bu.parentUnit ? { parentKey: bu.parentUnit.key } : {}),
  ...(bu.approvalRuleMode === 'Explicit' ||
  bu.approvalRuleMode === 'ExplicitAndFromParent'
    ? { approvalRuleMode: bu.approvalRuleMode }
    : {}),
});

export const fetchUnitById = async (
  dispatch: Dispatch,
  projectKey: string,
  id: string
) =>
  toUnit(
    await get<BusinessUnitResponse>(
      dispatch,
      `/${projectKey}/business-units/${encodeURIComponent(id)}`
    )
  );

export const fetchUnitByKey = async (
  dispatch: Dispatch,
  projectKey: string,
  key: string
) =>
  toUnit(
    await get<BusinessUnitResponse>(
      dispatch,
      `/${projectKey}/business-units/key=${encodeURIComponent(key)}`
    )
  );

// Walks parentUnit up to the company. A cycle cannot happen on the platform; the guard only stops a bad mock.
export async function fetchUnitChain(
  dispatch: Dispatch,
  projectKey: string,
  unitKey: string
): Promise<BusinessUnitSummary[]> {
  const chain: BusinessUnitSummary[] = [];
  const seen = new Set<string>();
  for (let key: string | undefined = unitKey; key && !seen.has(key); ) {
    seen.add(key);
    const unit = await fetchUnitByKey(dispatch, projectKey, key);
    chain.push(unit);
    key = unit.parentKey;
  }
  return chain;
}

type Loaded<T> = { data?: T; loading: boolean; error?: DataError };

function useLoad<T>(
  load: ((dispatch: Dispatch, projectKey: string) => Promise<T>) | undefined,
  deps: unknown[]
): Loaded<T> {
  const dispatch = useAsyncDispatch() as unknown as Dispatch;
  const projectKey = useProjectKey();
  const [state, setState] = useState<Loaded<T>>({ loading: Boolean(load) });
  useEffect(() => {
    if (!load || !projectKey) {
      setState({ loading: false });
      return undefined;
    }
    let active = true;
    setState({ loading: true });
    load(dispatch, projectKey).then(
      (data) => active && setState({ data, loading: false }),
      (e: unknown) =>
        active && setState({ loading: false, error: requestError(e) })
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectKey, ...deps]);
  return state;
}

export function useBusinessUnit(id: string | undefined): {
  unit?: BusinessUnitSummary;
  loading: boolean;
  error?: DataError;
} {
  const { data, loading, error } = useLoad(
    id ? (d, p) => fetchUnitById(d, p, id) : undefined,
    [id]
  );
  return { unit: data, loading, error };
}

// The unit first, then its parent, up to the company: the order core's unitChain() produces.
export function useUnitChain(unitKey: string | undefined): {
  units: UnitNode[];
  loading: boolean;
  error?: DataError;
} {
  const { data, loading, error } = useLoad(
    unitKey ? (d, p) => fetchUnitChain(d, p, unitKey) : undefined,
    [unitKey]
  );
  return { units: data ?? [], loading, error };
}
