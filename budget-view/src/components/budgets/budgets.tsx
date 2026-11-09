// Budgets and limits of the unit with their consumption; add, edit and deactivate; CSV export of the spend report.
// [BCC-VIEW-3] [BCC-VIEW-4] [BCC-VIEW-7] [BCC-VIEW-8] [BCC-VIEW-9] [BCC-BUDGET-2] [BCC-BUDGET-5]
import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  type Budget,
  CONTAINERS,
  type CostObject,
  deactivateBudget,
  effectiveSettings,
  type Settings,
  type UnitNode,
} from '../../core';
import { parseRecordKey } from '../../core';
import { Badge, Button, Heading, Stack, Text } from '@commercetools/nimbus';
import { type StoredRecord, useRecords } from '../../data/records';
import type { BusinessUnitSummary } from '../../data/units';
import { useCanManage } from '../../hooks/use-can-manage';
import { scopeRefLabel, sortedBudgets } from '../../model/budgets';
import { costObjectRows } from '../../model/cost-objects';
import {
  Loading,
  type Problem,
  ReadError,
  SaveProblem,
  useModeLabel,
} from '../shared/feedback';
import { writeRecord } from '../shared/save';
import { usePlatform } from '../shared/use-platform';
import BudgetConsumption from './budget-consumption';
import BudgetForm from './budget-form';
import { useBudgetLabels } from './labels';
import { usePanelChain, usePanelPeople } from '../shared/panel-data';
import messages from './messages';
import SpendExport from './spend-export';

type Props = { unit: BusinessUnitSummary; now?: string };

const q = (v: string) => JSON.stringify(v);

const Body = ({
  unit,
  units,
  at,
}: {
  unit: BusinessUnitSummary;
  units: UnitNode[];
  at: string;
}) => {
  const intl = useIntl();
  const canManage = useCanManage();
  const modeLabel = useModeLabel();
  const { scopes, periods, money } = useBudgetLabels();
  const { dispatch, projectKey } = usePlatform();
  const keys = units.map((u) => q(u.key)).join(', ');
  const budgets = useRecords<Budget>(
    CONTAINERS.budgets,
    `value(ownerBusinessUnitKey = ${q(unit.key)})`
  );
  const settings = useRecords<Settings>(
    CONTAINERS.settings,
    `key in (${keys})`
  );
  const costObjects = useRecords<CostObject>(
    CONTAINERS.costObjects,
    `value(ownerBusinessUnitKey = ${q(unit.key)})`
  );
  const people = usePanelPeople(unit.key);
  const [form, setForm] = useState<{ editKey?: string } | undefined>();
  const [problem, setProblem] = useState<Problem>();
  // Only the first load shows a spinner, so a reload never discards an open form.
  const [loaded, setLoaded] = useState(false);
  const ready =
    !budgets.loading &&
    !settings.loading &&
    !costObjects.loading &&
    !people.loading;
  if (!loaded && ready) setLoaded(true);
  if (!loaded) return <Loading />;

  const effective = effectiveSettings(
    unit.key,
    units,
    Object.fromEntries(settings.records.map((r) => [r.key, r.value]))
  );
  const ownCostObjects = costObjectRows(
    unit.key,
    units,
    costObjects.records
  ).filter((r) => r.editable && r.value.active);
  const rows = sortedBudgets(budgets.records);
  const editing = form?.editKey
    ? budgets.records.find((r) => r.key === form.editKey)
    : undefined;
  const labelCtx = { roles: people.roles, people: people.people };

  const deactivate = async (row: StoredRecord<Budget>) => {
    setProblem(undefined);
    const result = await writeRecord({
      dispatch,
      projectKey,
      container: CONTAINERS.budgets,
      key: row.key,
      value: deactivateBudget(row.value),
      version: row.version,
    });
    if (result.ok) budgets.reload();
    else setProblem(result);
  };

  return (
    <Stack direction="column" gap="400">
      {[budgets.error, settings.error, costObjects.error, people.error].map(
        (e, i) => (e ? <ReadError key={i} error={e} /> : null)
      )}
      {problem ? (
        <SaveProblem
          problem={problem}
          onReload={() => {
            setProblem(undefined);
            budgets.reload();
          }}
        />
      ) : null}
      {rows.length === 0 ? (
        <Text>{intl.formatMessage(messages.empty)}</Text>
      ) : null}
      {rows.map((row) => {
        const b = row.value;
        const overrides = Object.entries(b.modeByRole ?? {});
        return (
          <Stack
            key={row.key}
            role="group"
            aria-label={row.key}
            direction="column"
            gap="200"
            padding="300"
            borderWidth="1px"
            borderRadius="200"
          >
            <Stack direction="row" gap="200" alignItems="center">
              <Text fontWeight="600">
                {parseRecordKey(row.key)?.code ?? row.key}
              </Text>
              {b.active ? null : (
                <Badge size="xs" colorPalette="neutral">
                  {intl.formatMessage(messages.inactive)}
                </Badge>
              )}
            </Stack>
            <Text>
              {intl.formatMessage(messages.summary, {
                scopeKind: scopes[b.scope.kind],
                scopeRef: scopeRefLabel(b, labelCtx),
                amount: money(b.amount),
                period: periods[b.period.kind],
                mode: modeLabel(b.mode),
                warnAt: b.warnAtPercent,
              })}
            </Text>
            {overrides.length ? (
              <Text>
                {intl.formatMessage(messages.roleOverrides, {
                  overrides: overrides
                    .map(([r, m]) => `${r} ${modeLabel(m)}`)
                    .join(', '),
                })}
              </Text>
            ) : null}
            {b.active ? (
              <BudgetConsumption
                budgetKey={row.key}
                budget={b}
                people={people.people}
                budgets={budgets.records}
                at={at}
              />
            ) : null}
            {canManage ? (
              <Stack direction="row" gap="100">
                <Button
                  size="xs"
                  variant="outline"
                  aria-label={intl.formatMessage(messages.editLabel, {
                    key: row.key,
                  })}
                  onPress={() => setForm({ editKey: row.key })}
                >
                  {intl.formatMessage(messages.edit)}
                </Button>
                {b.active ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="critical"
                    aria-label={intl.formatMessage(messages.deactivateLabel, {
                      key: row.key,
                    })}
                    onPress={() => deactivate(row)}
                  >
                    {intl.formatMessage(messages.deactivate)}
                  </Button>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        );
      })}
      {canManage && !form ? (
        <Stack direction="row">
          <Button variant="outline" onPress={() => setForm({})}>
            {intl.formatMessage(messages.add)}
          </Button>
        </Stack>
      ) : null}
      {canManage && form && (!form.editKey || editing) ? (
        <BudgetForm
          key={form.editKey ?? 'new'}
          unitKey={unit.key}
          settings={effective}
          editing={editing}
          costObjects={ownCostObjects}
          people={people.people}
          roles={people.roles}
          now={at}
          onSaved={() => {
            setForm(undefined);
            budgets.reload();
          }}
          onCancel={() => setForm(undefined)}
          onReload={budgets.reload}
        />
      ) : null}
      <SpendExport
        unitKey={unit.key}
        costObjects={costObjects.records.filter(
          (r) => r.value.ownerBusinessUnitKey === unit.key
        )}
        budgets={budgets.records}
        now={at}
      />
    </Stack>
  );
};

const Budgets = ({ unit, now }: Props) => {
  const intl = useIntl();
  const [at] = useState(() => now ?? new Date().toISOString());
  const { units, loading, error } = usePanelChain(unit.key);
  return (
    <Stack direction="column" gap="300">
      <Heading as="h3">{intl.formatMessage(messages.title)}</Heading>
      {error ? <ReadError error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && units.length ? (
        <Body unit={unit} units={units} at={at} />
      ) : null}
    </Stack>
  );
};

export default Budgets;
