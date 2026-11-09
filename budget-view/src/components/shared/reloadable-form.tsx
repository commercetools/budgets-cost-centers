// Form state that survives a conflict reload: after the user reloads, the form takes the fresh record, names the
// fields someone else changed and keeps the user's own changes to re-apply. [BCC-VIEW-8]
import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { Alert, Button, Stack, Text } from '@commercetools/nimbus';
import { useFieldLabel } from './feedback';
import messages from './messages';

type Values = Record<string, unknown>;

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const differing = <F extends Values>(a: F, b: F) =>
  Object.keys({ ...a, ...b }).filter((k) => !same(a[k], b[k]));

export type Replaced<F> = { changed: string[]; yours: Partial<F> };

// `fromRecord` builds the form from the current record; `version` is that record's version (undefined while none
// exists).
export function useReloadableForm<F extends Values>(
  fromRecord: () => F,
  version: number | undefined
) {
  const [form, setForm] = useState<F>(fromRecord);
  const [base, setBase] = useState(() => ({ version, values: fromRecord() }));
  const [awaiting, setAwaiting] = useState(false);
  const [replaced, setReplaced] = useState<Replaced<F>>();

  if (version !== base.version) {
    const fresh = fromRecord();
    setBase({ version, values: fresh });
    if (awaiting) {
      setAwaiting(false);
      const yours = Object.fromEntries(
        differing(form, base.values).map((k) => [k, form[k]])
      ) as Partial<F>;
      setReplaced({ changed: differing(fresh, base.values), yours });
      setForm(fresh);
    }
  }

  return {
    form,
    setForm,
    replaced,
    // Call when the user reloads after a conflict.
    reloadRequested: () => {
      setAwaiting(true);
      setReplaced(undefined);
    },
    reapply: () => {
      if (replaced) setForm((f) => ({ ...f, ...replaced.yours }));
      setReplaced(undefined);
    },
  };
}

export function ReloadedNotice<F>({
  replaced,
  onReapply,
}: {
  replaced: Replaced<F> | undefined;
  onReapply: () => void;
}) {
  const intl = useIntl();
  const label = useFieldLabel();
  if (!replaced) return null;
  const list = (keys: string[]) => keys.map(label).join(', ');
  const yours = Object.keys(replaced.yours);
  return (
    <Alert.Root colorPalette="info" variant="outlined">
      <Alert.Title>{intl.formatMessage(messages.reloadedTitle)}</Alert.Title>
      <Alert.Description>
        <Stack direction="column" gap="50">
          <Text>
            {replaced.changed.length
              ? intl.formatMessage(messages.reloadedChanged, {
                  fields: list(replaced.changed),
                })
              : intl.formatMessage(messages.reloadedUnchanged)}
          </Text>
          {yours.length ? (
            <Text>
              {intl.formatMessage(messages.reloadedYours, {
                fields: list(yours),
              })}
            </Text>
          ) : null}
        </Stack>
      </Alert.Description>
      {yours.length ? (
        <Alert.Actions>
          <Button variant="outline" size="xs" onPress={onReapply}>
            {intl.formatMessage(messages.reapply)}
          </Button>
        </Alert.Actions>
      ) : null}
    </Alert.Root>
  );
}
