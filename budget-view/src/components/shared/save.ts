// Writes a record: an update sends the version it read; a create first checks that the key is free, because a
// Custom Object create replaces a record with the same key. [BCC-VIEW-8] [BCC-COST-2] [BCC-BUDGET-1]
import { CONTAINERS } from '../../core';
import type { Dispatch } from '../../data/client';
import { messageOf } from '../../data/client';
import {
  recordExists,
  type SaveOptions,
  type SaveResult,
  saveRecord,
} from '../../data/records';
import type { Problem } from './feedback';

export async function writeRecord(input: {
  dispatch: Dispatch;
  projectKey: string;
  container: string;
  key: string;
  value: unknown;
  version?: number;
  options?: SaveOptions;
}): Promise<SaveResult | Problem> {
  const { dispatch, projectKey, container, key, value, version, options } =
    input;
  if (version === undefined) {
    try {
      if (await recordExists(dispatch, projectKey, container, key))
        // A settings key is the unit key, not a choice of the user: a record that appeared meanwhile was written by
        // someone else, so it is a conflict the user resolves by reloading.
        return container === CONTAINERS.settings
          ? { ok: false, conflict: true }
          : { ok: false, keyTaken: key };
    } catch (e) {
      return { ok: false, message: messageOf(e) };
    }
  }
  return saveRecord(
    dispatch,
    projectKey,
    container,
    key,
    value,
    version,
    options
  );
}
