// Custom Object records of the three containers: read with their version, validated with core both ways, written with
// the version that was read. [BCC-VIEW-8] [BCC-COST-2] [BCC-COST-3] [BCC-BUDGET-1] [BCC-SET-1] [BCC-SET-3]
// https://docs.commercetools.com/api/projects/custom-objects
import { useCallback, useEffect, useState } from 'react';
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import {
  CONTAINERS,
  type FieldError,
  KEY_PATTERN,
  parseRecordKey,
  type Result,
  validateBudget,
  validateCostObject,
  validateSettings,
  validateSettingsForWrite,
} from '../core';
import {
  type DataError,
  type Dispatch,
  get,
  getAllById,
  messageOf,
  post,
  requestError,
  statusOf,
  useProjectKey,
} from './client';
import type { ViewFieldError } from '../model/errors';
import messages from '../model/messages';

export type StoredRecord<T = unknown> = {
  key: string;
  version: number;
  value: T;
};

// `errors`: validation before any request (core texts as received, the view's own as descriptors); `message`: the
// platform's answer.
export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true }
  | { ok: false; errors: ViewFieldError[] }
  | { ok: false; message: string };

export type SaveOptions = {
  // Cost-object keys the unit can use; required to write settings with a default cost object [BCC-SET-3].
  visibleCostObjectKeys?: string[];
};

type Validator = (value: unknown) => Result<unknown>;

// The read validator of a container. Settings are checked by shape on read, so a default cost object that is no
// longer visible does not discard the unit's own record (see core/src/settings.ts).
export function validatorFor(container: string): Validator | undefined {
  switch (container) {
    case CONTAINERS.costObjects:
      return validateCostObject;
    case CONTAINERS.budgets:
      return validateBudget;
    case CONTAINERS.settings:
      return validateSettings;
    default:
      return undefined;
  }
}

const writeValidatorFor = (
  container: string,
  options: SaveOptions
): Validator | undefined =>
  container === CONTAINERS.settings
    ? (value) =>
        validateSettingsForWrite(value, options.visibleCostObjectKeys ?? [])
    : validatorFor(container);

// Cost objects and budgets are keyed `<ownerBusinessUnitKey>~<code>`; the key must name the owner in the value.
function keyErrors(
  container: string,
  key: string,
  value: unknown
): ViewFieldError[] {
  if (!KEY_PATTERN.test(key))
    return [{ field: 'key', message: messages.keyInvalid, values: { key } }];
  const owner = (value as { ownerBusinessUnitKey?: unknown })
    .ownerBusinessUnitKey;
  if (container === CONTAINERS.costObjects) {
    const code = (value as { code?: unknown }).code;
    if (key !== `${String(owner)}~${String(code)}`)
      return [{ field: 'key', message: messages.keyCostObject }];
  }
  if (
    container === CONTAINERS.budgets &&
    parseRecordKey(key)?.ownerBusinessUnitKey !== owner
  ) {
    return [{ field: 'key', message: messages.keyBudget }];
  }
  return [];
}

const invalid = (errors: ViewFieldError[]): SaveResult => ({
  ok: false,
  errors,
});

export async function saveRecord(
  dispatch: Dispatch,
  projectKey: string,
  container: string,
  key: string,
  value: unknown,
  version?: number,
  options: SaveOptions = {}
): Promise<SaveResult> {
  const validate = writeValidatorFor(container, options);
  if (!validate)
    return invalid([
      {
        field: 'container',
        message: messages.unknownContainer,
        values: { container },
      },
    ]);
  const checked = validate(value);
  if (!checked.ok) return invalid(checked.errors);
  const keyProblems = keyErrors(container, key, checked.value);
  if (keyProblems.length) return invalid(keyProblems);

  try {
    const saved = await post<{ version: number }>(
      dispatch,
      `/${projectKey}/custom-objects`,
      {
        container,
        key,
        value: checked.value,
        ...(version === undefined ? {} : { version }),
      }
    );
    return { ok: true, version: saved.version };
  } catch (e) {
    if (statusOf(e) === 409) return { ok: false, conflict: true };
    return { ok: false, message: messageOf(e) };
  }
}

// Creating a Custom Object replaces one with the same key, and the API offers no create-only guard, so the view checks
// that a key is free before it creates a record.
// https://docs.commercetools.com/api/projects/custom-objects#get-customobject-by-container-and-key
export async function recordExists(
  dispatch: Dispatch,
  projectKey: string,
  container: string,
  key: string
): Promise<boolean> {
  try {
    await get(
      dispatch,
      `/${projectKey}/custom-objects/${encodeURIComponent(
        container
      )}/${encodeURIComponent(key)}`
    );
    return true;
  } catch (e) {
    if (statusOf(e) === 404) return false;
    throw e;
  }
}

type RawRecord = { id: string; key: string; version: number; value: unknown };

export type RecordsState<T = unknown> = {
  records: Array<StoredRecord<T>>;
  loading: boolean;
  error?: DataError;
  reload: () => void;
};

// Reads every record of a container that matches `where` (a Custom Object query predicate). A record core rejects is
// left out and reported in `error`, so one corrupt record never breaks the panel.
export function useRecords<T = unknown>(
  container: string,
  where?: string
): RecordsState<T> {
  const dispatch = useAsyncDispatch() as unknown as Dispatch;
  const projectKey = useProjectKey();
  const [round, setRound] = useState(0);
  const [state, setState] = useState<Omit<RecordsState<T>, 'reload'>>({
    records: [],
    loading: true,
  });
  const reload = useCallback(() => setRound((r) => r + 1), []);

  useEffect(() => {
    const validate = validatorFor(container);
    if (!projectKey || !validate) {
      setState({
        records: [],
        loading: false,
        error: { kind: 'container', container },
      });
      return undefined;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    getAllById<RawRecord>(
      dispatch,
      `/${projectKey}/custom-objects/${encodeURIComponent(container)}`,
      where ? [where] : []
    ).then(
      (raw) => {
        if (!active) return;
        const records: Array<StoredRecord<T>> = [];
        const broken: Array<{ key: string; errors: FieldError[] }> = [];
        for (const r of raw) {
          const checked = validate(r.value);
          if (checked.ok)
            records.push({
              key: r.key,
              version: r.version,
              value: checked.value as T,
            });
          else broken.push({ key: r.key, errors: checked.errors });
        }
        setState({
          records,
          loading: false,
          ...(broken.length
            ? { error: { kind: 'invalid', records: broken } }
            : {}),
        });
      },
      (e: unknown) =>
        active &&
        setState({ records: [], loading: false, error: requestError(e) })
    );
    return () => {
      active = false;
    };
  }, [dispatch, projectKey, container, where, round]);

  return { ...state, reload };
}
