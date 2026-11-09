// Associates of a unit with their roles and customers, and all Associate Roles. [BCC-VIEW-2] [BCC-VIEW-3]
// [BCC-BUDGET-8] [BCC-APPR-3] [BCC-APPR-4]
// https://docs.commercetools.com/api/projects/business-units
// https://docs.commercetools.com/api/projects/associate-roles
import { useEffect, useState } from 'react';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import {
  type CustomerLike,
  type Person,
  peopleOf,
  type UnitAssociates,
} from '../model/people';
import type { RoleLike } from '../model/approval';
import { chunks } from '../model/chunks';
import {
  type DataError,
  type Dispatch,
  get,
  getAllById,
  q,
  requestError,
  useProjectKey,
} from './client';

type RoleResponse = {
  id: string;
  key: string;
  name?: string;
  permissions: string[];
};

// Customer IDs are read in chunks of at most 50, so the predicate stays short.
async function fetchCustomers(
  dispatch: Dispatch,
  projectKey: string,
  ids: string[]
): Promise<CustomerLike[]> {
  const customers: CustomerLike[] = [];
  for (const chunk of chunks(ids))
    customers.push(
      ...(await getAllById<CustomerLike>(dispatch, `/${projectKey}/customers`, [
        `id in (${chunk.map(q).join(', ')})`,
      ]))
    );
  return customers;
}

export async function fetchUnitPeople(
  dispatch: Dispatch,
  projectKey: string,
  unitKey: string
): Promise<{ people: Person[]; roles: RoleLike[] }> {
  const [unit, roles] = await Promise.all([
    get<UnitAssociates>(
      dispatch,
      `/${projectKey}/business-units/key=${encodeURIComponent(unitKey)}`
    ),
    getAllById<RoleResponse>(dispatch, `/${projectKey}/associate-roles`, []),
  ]);
  const ids = [
    ...new Set(
      [...(unit.associates ?? []), ...(unit.inheritedAssociates ?? [])].map(
        (a) => a.customer.id
      )
    ),
  ];
  return {
    people: peopleOf(unit, await fetchCustomers(dispatch, projectKey, ids)),
    roles: roles
      .map((r) => ({
        key: r.key,
        ...(r.name ? { name: r.name } : {}),
        permissions: r.permissions,
      }))
      .sort((a, b) => a.key.localeCompare(b.key, 'en')),
  };
}

export type PeopleState = {
  people: Person[];
  roles: RoleLike[];
  loading: boolean;
  error?: DataError;
};

// Without a unit key nothing is read (the panel's shared people are used instead).
export function useUnitPeople(unitKey: string | undefined): PeopleState {
  const dispatch = useAsyncDispatch() as unknown as Dispatch;
  const projectKey = useProjectKey();
  const [state, setState] = useState<PeopleState>({
    people: [],
    roles: [],
    loading: Boolean(unitKey),
  });
  useEffect(() => {
    if (!projectKey || !unitKey) {
      setState({ people: [], roles: [], loading: false });
      return undefined;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    fetchUnitPeople(dispatch, projectKey, unitKey).then(
      (r) => active && setState({ ...r, loading: false }),
      (e: unknown) =>
        active &&
        setState({
          people: [],
          roles: [],
          loading: false,
          error: requestError(e),
        })
    );
    return () => {
      active = false;
    };
  }, [dispatch, projectKey, unitKey]);
  return state;
}

// Associates of the unit's direct divisions, who may use the unit's cost objects too [BCC-COST-6]. Each person is
// listed once, with the first division they belong to.
export type DivisionPerson = Person & { unitKey: string };

type DivisionResponse = UnitAssociates & { id: string; key: string };

export async function fetchDivisionPeople(
  dispatch: Dispatch,
  projectKey: string,
  unitKey: string
): Promise<DivisionPerson[]> {
  const divisions = await getAllById<DivisionResponse>(
    dispatch,
    `/${projectKey}/business-units`,
    [`parentUnit(key=${q(unitKey)})`]
  );
  const ids = [
    ...new Set(
      divisions.flatMap((d) =>
        [...(d.associates ?? []), ...(d.inheritedAssociates ?? [])].map(
          (a) => a.customer.id
        )
      )
    ),
  ];
  const customers = await fetchCustomers(dispatch, projectKey, ids);
  const seen = new Set<string>();
  return divisions.flatMap((d) =>
    peopleOf(d, customers)
      .filter((p) => !seen.has(p.customerId) && seen.add(p.customerId))
      .map((p) => ({ ...p, unitKey: d.key }))
  );
}

export function useDivisionPeople(unitKey: string): {
  people: DivisionPerson[];
  loading: boolean;
  error?: DataError;
} {
  const dispatch = useAsyncDispatch() as unknown as Dispatch;
  const projectKey = useProjectKey();
  const [state, setState] = useState<{
    people: DivisionPerson[];
    loading: boolean;
    error?: DataError;
  }>({ people: [], loading: true });
  useEffect(() => {
    if (!projectKey) return undefined;
    let active = true;
    fetchDivisionPeople(dispatch, projectKey, unitKey).then(
      (people) => active && setState({ people, loading: false }),
      (e: unknown) =>
        active &&
        setState({ people: [], loading: false, error: requestError(e) })
    );
    return () => {
      active = false;
    };
  }, [dispatch, projectKey, unitKey]);
  return state;
}
