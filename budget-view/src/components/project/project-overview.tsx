// Project overview: shopping lists, active carts, quote requests, quotes and orders carrying the project key with
// their totals, the project budgets with consumption, and status, site address and ERP number.
// [BCC-VIEW-6] [BCC-PROJ-1] [BCC-PROJ-2] [BCC-PROJ-4] [BCC-VIEW-8] [BCC-VIEW-9]
import React, { useEffect, useState } from 'react';
import { type MessageDescriptor, useIntl } from 'react-intl';
import { type Budget, CONTAINERS, type ProjectStatus } from '../../core';
import {
  Button,
  FormField,
  Heading,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@commercetools/nimbus';
import { type DataError, requestError } from '../../data/client';
import { fetchProjectSources } from '../../data/project';
import { useRecords } from '../../data/records';
import { useCanManage } from '../../hooks/use-can-manage';
import type { CostObjectRow } from '../../model/cost-objects';
import {
  applyProjectFields,
  type ProjectFields,
  projectBudgets,
  projectFieldsOf,
  type ProjectItem,
  projectItems,
  type ProjectResource,
} from '../../model/project';
import BudgetConsumption from '../budgets/budget-consumption';
import { useBudgetLabels } from '../budgets/labels';
import { PROJECT_STATUSES, useCostObjectLabels } from '../cost-objects/labels';
import costObjectMessages from '../cost-objects/messages';
import {
  Loading,
  type Problem,
  ReadError,
  SaveProblem,
} from '../shared/feedback';
import { writeRecord } from '../shared/save';
import { ReloadedNotice, useReloadableForm } from '../shared/reloadable-form';
import { usePlatform } from '../shared/use-platform';
import messages from './messages';

type Props = {
  project: CostObjectRow;
  // A project of a parent unit, opened from a division: its fields are shown, not edited. [BCC-COST-5]
  readOnly?: boolean;
  now?: string;
  onClose: () => void;
  onChanged: () => void;
};

const q = (v: string) => JSON.stringify(v);

// OrderState, QuoteState and QuoteRequestState values; another value is shown as received inside a frame.
// https://docs.commercetools.com/api/projects/orders https://docs.commercetools.com/api/projects/quotes
// https://docs.commercetools.com/api/projects/quote-requests
const STATES: Record<string, MessageDescriptor> = {
  Open: messages.stateOpen,
  Confirmed: messages.stateConfirmed,
  Complete: messages.stateComplete,
  Cancelled: messages.stateCancelled,
  Pending: messages.statePending,
  Declined: messages.stateDeclined,
  DeclinedForRenegotiation: messages.stateDeclinedForRenegotiation,
  RenegotiationAddressed: messages.stateRenegotiationAddressed,
  Accepted: messages.stateAccepted,
  Withdrawn: messages.stateWithdrawn,
  Submitted: messages.stateSubmitted,
  Closed: messages.stateClosed,
  Rejected: messages.stateRejected,
};

function useProjectItems(key: string) {
  const { dispatch, projectKey } = usePlatform();
  const [state, setState] = useState<{
    items: ProjectItem[];
    loading: boolean;
    error?: DataError;
  }>({
    items: [],
    loading: true,
  });
  useEffect(() => {
    let active = true;
    fetchProjectSources(dispatch, projectKey, key).then(
      (s) => active && setState({ items: projectItems(s), loading: false }),
      (e: unknown) =>
        active &&
        setState({ items: [], loading: false, error: requestError(e) })
    );
    return () => {
      active = false;
    };
  }, [dispatch, projectKey, key]);
  return state;
}

const Items = ({ code, items }: { code: string; items: ProjectItem[] }) => {
  const intl = useIntl();
  const { money } = useBudgetLabels();
  const kinds: Record<ProjectResource, string> = {
    'shopping-list': intl.formatMessage(messages.kindShoppingList),
    cart: intl.formatMessage(messages.kindCart),
    'quote-request': intl.formatMessage(messages.kindQuoteRequest),
    quote: intl.formatMessage(messages.kindQuote),
    order: intl.formatMessage(messages.kindOrder),
  };
  if (!items.length) return <Text>{intl.formatMessage(messages.empty)}</Text>;
  return (
    <Table.Root
      size="sm"
      aria-label={intl.formatMessage(messages.tableLabel, { code })}
    >
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>
            {intl.formatMessage(messages.colKind)}
          </Table.ColumnHeader>
          <Table.ColumnHeader>
            {intl.formatMessage(messages.colName)}
          </Table.ColumnHeader>
          <Table.ColumnHeader>
            {intl.formatMessage(messages.colState)}
          </Table.ColumnHeader>
          <Table.ColumnHeader>
            {intl.formatMessage(messages.colItems)}
          </Table.ColumnHeader>
          <Table.ColumnHeader textAlign="end">
            {intl.formatMessage(messages.colTotal)}
          </Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map((i) => (
          <Table.Row key={`${i.kind}:${i.id}`}>
            <Table.Cell>{kinds[i.kind]}</Table.Cell>
            <Table.Cell>{i.label}</Table.Cell>
            <Table.Cell>
              {i.state
                ? STATES[i.state]
                  ? intl.formatMessage(STATES[i.state]!)
                  : intl.formatMessage(messages.stateOther, { state: i.state })
                : null}
            </Table.Cell>
            <Table.Cell>{i.lineItemCount}</Table.Cell>
            <Table.Cell textAlign="end">
              {i.total ? money(i.total) : null}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
};

const Fields = ({
  project,
  readOnly,
  onSaved,
}: {
  project: CostObjectRow;
  readOnly?: boolean;
  onSaved: () => void;
}) => {
  const intl = useIntl();
  const canManage = useCanManage() && !readOnly;
  const { statuses } = useCostObjectLabels();
  const { dispatch, projectKey } = usePlatform();
  const {
    form: fields,
    setForm: setFields,
    replaced,
    reloadRequested,
    reapply,
  } = useReloadableForm<ProjectFields>(
    () => projectFieldsOf(project.value),
    project.version
  );
  const [problem, setProblem] = useState<Problem>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const set =
    <K extends keyof ProjectFields>(k: K) =>
    (v: ProjectFields[K]) =>
      setFields((f) => ({ ...f, [k]: v }));

  if (!canManage) {
    const current = projectFieldsOf(project.value);
    const notSet = intl.formatMessage(messages.notSet);
    const row = (label: string, value: string) => (
      <Stack direction="row" gap="200">
        <Text fontWeight="600">{label}</Text>
        <Text>{value || notSet}</Text>
      </Stack>
    );
    return (
      <Stack direction="column" gap="100">
        {row(
          intl.formatMessage(costObjectMessages.fieldProjectStatus),
          statuses[current.status]
        )}
        {row(
          intl.formatMessage(costObjectMessages.fieldSiteAddress),
          current.siteAddress
        )}
        {row(
          intl.formatMessage(costObjectMessages.fieldErpProjectNumber),
          current.erpProjectNumber
        )}
      </Stack>
    );
  }

  const save = async () => {
    setProblem(undefined);
    setSaved(false);
    setSaving(true);
    const result = await writeRecord({
      dispatch,
      projectKey,
      container: CONTAINERS.costObjects,
      key: project.key,
      value: applyProjectFields(project.value, fields),
      version: project.version,
    });
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      onSaved();
    } else setProblem(result);
  };

  return (
    <Stack direction="column" gap="200">
      <FormField.Root>
        <FormField.Label>
          {intl.formatMessage(costObjectMessages.fieldProjectStatus)}
        </FormField.Label>
        <FormField.Input>
          <Select.Root
            selectedKey={fields.status}
            isClearable={false}
            onSelectionChange={(k) => set('status')(k as ProjectStatus)}
          >
            <Select.Options>
              {PROJECT_STATUSES.map((s) => (
                <Select.Option key={s} id={s}>
                  {statuses[s]}
                </Select.Option>
              ))}
            </Select.Options>
          </Select.Root>
        </FormField.Input>
      </FormField.Root>
      <FormField.Root>
        <FormField.Label>
          {intl.formatMessage(costObjectMessages.fieldSiteAddress)}
        </FormField.Label>
        <FormField.Input>
          <TextInput value={fields.siteAddress} onChange={set('siteAddress')} />
        </FormField.Input>
      </FormField.Root>
      <FormField.Root>
        <FormField.Label>
          {intl.formatMessage(costObjectMessages.fieldErpProjectNumber)}
        </FormField.Label>
        <FormField.Input>
          <TextInput
            value={fields.erpProjectNumber}
            onChange={set('erpProjectNumber')}
          />
        </FormField.Input>
      </FormField.Root>
      {problem ? (
        <SaveProblem
          problem={problem}
          onReload={() => {
            setProblem(undefined);
            reloadRequested();
            onSaved();
          }}
        />
      ) : null}
      <ReloadedNotice replaced={replaced} onReapply={reapply} />
      {saved ? <Text>{intl.formatMessage(messages.saved)}</Text> : null}
      <Stack direction="row">
        <Button
          variant="solid"
          colorPalette="primary"
          onPress={save}
          isDisabled={saving}
        >
          {intl.formatMessage(messages.save)}
        </Button>
      </Stack>
    </Stack>
  );
};

const ProjectOverview = ({
  project,
  readOnly,
  now,
  onClose,
  onChanged,
}: Props) => {
  const intl = useIntl();
  const [at] = useState(() => now ?? new Date().toISOString());
  const { items, loading, error } = useProjectItems(project.key);
  const budgets = useRecords<Budget>(
    CONTAINERS.budgets,
    `value(scope(ref = ${q(project.key)}))`
  );
  const own = projectBudgets(project.key, budgets.records);

  return (
    <Stack
      direction="column"
      gap="300"
      padding="300"
      borderWidth="1px"
      borderRadius="200"
    >
      <Stack
        direction="row"
        gap="200"
        alignItems="center"
        justifyContent="space-between"
      >
        <Heading as="h4">
          {intl.formatMessage(messages.title, {
            code: project.value.code,
            name: project.value.name,
          })}
        </Heading>
        <Button size="xs" variant="ghost" onPress={onClose}>
          {intl.formatMessage(messages.close)}
        </Button>
      </Stack>
      <Heading as="h5">{intl.formatMessage(messages.fieldsTitle)}</Heading>
      <Fields project={project} readOnly={readOnly} onSaved={onChanged} />
      {error ? <ReadError error={error} /> : null}
      {loading ? (
        <Loading />
      ) : (
        <Items code={project.value.code} items={items} />
      )}
      <Heading as="h5">{intl.formatMessage(messages.budgetsTitle)}</Heading>
      {budgets.error ? <ReadError error={budgets.error} /> : null}
      {budgets.loading ? <Loading /> : null}
      {!budgets.loading && !own.length ? (
        <Text>{intl.formatMessage(messages.noBudgets)}</Text>
      ) : null}
      {own.map((b) => (
        <Stack
          key={b.key}
          role="group"
          aria-label={b.key}
          direction="column"
          gap="100"
        >
          <Text fontWeight="600">{b.key}</Text>
          <BudgetConsumption
            budgetKey={b.key}
            budget={b.value}
            people={[]}
            budgets={own}
            at={at}
          />
        </Stack>
      ))}
    </Stack>
  );
};

export default ProjectOverview;
