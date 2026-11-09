// CSV export of the unit's spend report for a chosen calendar period, built in the browser. [BCC-VIEW-7]
// [BCC-SPEND-4]
import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  type Budget,
  type CalendarKind,
  type CostObject,
  isDate,
} from '../../core';
import {
  Alert,
  Button,
  FormField,
  Heading,
  Select,
  Stack,
  Text,
  TextInput,
} from '@commercetools/nimbus';
import { messageOf } from '../../data/client';
import { useOrdersReader } from '../../data/orders';
import {
  csvFileName,
  exportOrdersWhere,
  periodLabel,
  reportInterval,
  spendCsv,
} from '../../model/export';
import { downloadText } from '../shared/download';
import { useBudgetLabels } from './labels';
import messages from './messages';

const KINDS: readonly CalendarKind[] = ['month', 'quarter', 'year'];

type Props = {
  unitKey: string;
  costObjects: Array<{ key: string; value: CostObject }>;
  budgets: Array<{ key: string; value: Budget }>;
  now: string;
};

const SpendExport = ({ unitKey, costObjects, budgets, now }: Props) => {
  const intl = useIntl();
  const { periods } = useBudgetLabels();
  const reader = useOrdersReader();
  const [kind, setKind] = useState<CalendarKind>('month');
  const [date, setDate] = useState(now.slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { rows: number; other: number } | { error: string }
  >();

  const run = async () => {
    setResult(undefined);
    if (!isDate(date)) {
      setResult({ error: intl.formatMessage(messages.exportBadDate) });
      return;
    }
    setBusy(true);
    try {
      const interval = reportInterval(kind, date);
      const where = exportOrdersWhere(
        costObjects.map((c) => c.key),
        interval
      );
      const orders = where ? await reader.read(where) : [];
      const report = spendCsv({
        unitKey,
        interval,
        costObjects,
        budgets,
        orders,
      });
      downloadText(
        csvFileName(unitKey, periodLabel(kind, interval)),
        report.csv
      );
      setResult({ rows: report.rowCount, other: report.otherCurrencyOrders });
    } catch (e) {
      setResult({
        error: intl.formatMessage(messages.exportFailed, {
          message: messageOf(e),
        }),
      });
    }
    setBusy(false);
  };

  return (
    <Stack direction="column" gap="200">
      <Heading as="h4">{intl.formatMessage(messages.exportTitle)}</Heading>
      <Stack direction="row" gap="200" alignItems="flex-end">
        <FormField.Root>
          <FormField.Label>
            {intl.formatMessage(messages.exportPeriod)}
          </FormField.Label>
          <FormField.Input>
            <Select.Root
              selectedKey={kind}
              isClearable={false}
              onSelectionChange={(k) => setKind(k as CalendarKind)}
            >
              <Select.Options>
                {KINDS.map((k) => (
                  <Select.Option key={k} id={k}>
                    {periods[k]}
                  </Select.Option>
                ))}
              </Select.Options>
            </Select.Root>
          </FormField.Input>
        </FormField.Root>
        <FormField.Root>
          <FormField.Label>
            {intl.formatMessage(messages.exportDate)}
          </FormField.Label>
          <FormField.Input>
            <TextInput value={date} onChange={setDate} />
          </FormField.Input>
        </FormField.Root>
        <Button variant="outline" onPress={run} isDisabled={busy}>
          {intl.formatMessage(messages.exportButton)}
        </Button>
      </Stack>
      {result && 'rows' in result ? (
        <Stack direction="column" gap="100">
          <Text>
            {intl.formatMessage(messages.exported, { rows: result.rows })}
          </Text>
          {result.other ? (
            <Text>
              {intl.formatMessage(messages.otherCurrency, {
                count: result.other,
              })}
            </Text>
          ) : null}
        </Stack>
      ) : null}
      {result && 'error' in result ? (
        <Alert.Root colorPalette="critical" variant="outlined">
          <Alert.Description>{result.error}</Alert.Description>
        </Alert.Root>
      ) : null}
    </Stack>
  );
};

export default SpendExport;
