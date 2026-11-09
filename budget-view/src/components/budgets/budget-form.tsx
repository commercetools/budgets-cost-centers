// Form to add or edit a budget or limit: scope, amount, period, mode, role overrides and warning threshold.
// [BCC-VIEW-3] [BCC-VIEW-8] [BCC-BUDGET-1] [BCC-BUDGET-3] [BCC-BUDGET-4] [BCC-BUDGET-5] [BCC-BUDGET-6]
// [BCC-BUDGET-8] [BCC-BUDGET-9]
import React, { type Key, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  type Budget,
  CONTAINERS,
  type Mode,
  MODES,
  type ScopeKind,
  type Settings,
} from '../../core';
import {
  Button,
  FormField,
  Heading,
  Select,
  Stack,
  Text,
  TextInput,
} from '@commercetools/nimbus';
import type { RoleLike } from '../../model/approval';
import type { ViewFieldError } from '../../model/errors';
import {
  type BudgetForm as Form,
  budgetFormDefaults,
  budgetFromForm,
  formFromBudget,
  PERIOD_KINDS,
  type PeriodKind,
  SCOPE_KINDS,
  withScopeKind,
} from '../../model/budgets';
import type { CostObjectRow } from '../../model/cost-objects';
import type { Person } from '../../model/people';
import {
  FieldErrors,
  type Problem,
  SaveProblem,
  useModeLabel,
} from '../shared/feedback';
import sharedMessages from '../shared/messages';
import { ReloadedNotice, useReloadableForm } from '../shared/reloadable-form';
import { writeRecord } from '../shared/save';
import { usePlatform } from '../shared/use-platform';
import { useBudgetLabels } from './labels';
import messages from './messages';

type Props = {
  unitKey: string;
  settings: Settings;
  editing?: { key: string; version: number; value: Budget };
  costObjects: CostObjectRow[];
  people: Person[];
  roles: RoleLike[];
  now: string;
  onSaved: () => void;
  onCancel: () => void;
  onReload: () => void;
};

const Field = ({
  label,
  value,
  onChange,
  hint,
  placeholder,
  isReadOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  isReadOnly?: boolean;
}) => (
  <FormField.Root isReadOnly={isReadOnly}>
    <FormField.Label>{label}</FormField.Label>
    <FormField.Input>
      <TextInput value={value} onChange={onChange} placeholder={placeholder} />
    </FormField.Input>
    {hint ? <FormField.Description>{hint}</FormField.Description> : null}
  </FormField.Root>
);

const Choice = ({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <FormField.Root>
    <FormField.Label>{label}</FormField.Label>
    <FormField.Input>
      <Select.Root
        selectedKey={value || null}
        isClearable={false}
        placeholder={placeholder}
        onSelectionChange={(k: Key | null) =>
          onChange(k === null ? '' : String(k))
        }
      >
        <Select.Options>
          {options.map((o) => (
            <Select.Option key={o.id} id={o.id}>
              {o.label}
            </Select.Option>
          ))}
        </Select.Options>
      </Select.Root>
    </FormField.Input>
  </FormField.Root>
);

const BudgetForm = (props: Props) => {
  const { unitKey, settings, editing, costObjects, people, roles, now } = props;
  const intl = useIntl();
  const modeLabel = useModeLabel();
  const { scopes, periods } = useBudgetLabels();
  const { dispatch, projectKey } = usePlatform();
  const { form, setForm, replaced, reloadRequested, reapply } =
    useReloadableForm<Form>(
      () =>
        editing
          ? formFromBudget(editing.key, editing.value)
          : budgetFormDefaults(settings, now),
      editing?.version
    );
  const [errors, setErrors] = useState<ViewFieldError[]>([]);
  const [problem, setProblem] = useState<Problem>();
  const [saving, setSaving] = useState(false);
  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setForm((f) => ({ ...f, [k]: v }));
  const choose = intl.formatMessage(messages.choose);

  const save = async () => {
    setProblem(undefined);
    const built = budgetFromForm(unitKey, form);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors([]);
    setSaving(true);
    const result = await writeRecord({
      dispatch,
      projectKey,
      container: CONTAINERS.budgets,
      key: built.value.key,
      value: built.value.value,
      version: editing?.version,
    });
    setSaving(false);
    if (result.ok) props.onSaved();
    else setProblem(result);
  };

  const refField = () => {
    switch (form.scopeKind) {
      case 'business-unit':
        return (
          <Text>{intl.formatMessage(messages.fieldUnit, { unitKey })}</Text>
        );
      case 'cost-object':
        return (
          <Choice
            label={intl.formatMessage(messages.fieldCostObject)}
            value={form.scopeRef}
            placeholder={choose}
            options={costObjects.map((c) => ({
              id: c.key,
              label: `${c.value.code} ${c.value.name}`,
            }))}
            onChange={set('scopeRef')}
          />
        );
      case 'role':
        return (
          <Choice
            label={intl.formatMessage(messages.fieldRole)}
            value={form.scopeRef}
            placeholder={choose}
            options={roles.map((r) => ({ id: r.key, label: r.name ?? r.key }))}
            onChange={set('scopeRef')}
          />
        );
      case 'associate':
        return (
          <Choice
            label={intl.formatMessage(messages.fieldAssociate)}
            value={form.scopeRef}
            placeholder={choose}
            options={people.map((p) => ({ id: p.customerId, label: p.label }))}
            onChange={set('scopeRef')}
          />
        );
    }
  };

  return (
    <Stack
      direction="column"
      gap="300"
      padding="300"
      borderWidth="1px"
      borderRadius="200"
    >
      <Heading as="h4">
        {editing
          ? intl.formatMessage(messages.editTitle, { key: editing.key })
          : intl.formatMessage(messages.newTitle)}
      </Heading>
      {editing ? null : (
        <Choice
          label={intl.formatMessage(messages.fieldScopeKind)}
          value={form.scopeKind}
          options={SCOPE_KINDS.map((k) => ({ id: k, label: scopes[k] }))}
          onChange={(k) =>
            setForm((f) => withScopeKind(f, k as ScopeKind, unitKey))
          }
        />
      )}
      {editing ? (
        <Text>
          {scopes[form.scopeKind]} {form.scopeRef}
        </Text>
      ) : (
        refField()
      )}
      <Field
        label={intl.formatMessage(messages.fieldId)}
        value={form.id}
        onChange={set('id')}
        hint={editing ? undefined : intl.formatMessage(messages.fieldIdHint)}
        isReadOnly={Boolean(editing)}
      />
      <Stack direction="row" gap="200">
        <Field
          label={intl.formatMessage(messages.fieldAmount)}
          value={form.amount}
          onChange={set('amount')}
        />
        <Field
          label={intl.formatMessage(messages.fieldCurrency)}
          value={form.currencyCode}
          onChange={set('currencyCode')}
        />
      </Stack>
      <Choice
        label={intl.formatMessage(messages.fieldPeriod)}
        value={form.periodKind}
        options={PERIOD_KINDS.map((k) => ({ id: k, label: periods[k] }))}
        onChange={(k) => set('periodKind')(k as PeriodKind)}
      />
      <Stack direction="row" gap="200">
        <Field
          label={intl.formatMessage(messages.fieldFrom)}
          value={form.from}
          onChange={set('from')}
          placeholder={intl.formatMessage(messages.datePlaceholder)}
        />
        <Field
          label={intl.formatMessage(messages.fieldTo)}
          value={form.to}
          onChange={set('to')}
          placeholder={intl.formatMessage(messages.datePlaceholder)}
        />
      </Stack>
      <Text>{intl.formatMessage(messages.fieldPeriodHint)}</Text>
      <Choice
        label={intl.formatMessage(messages.fieldMode)}
        value={form.mode}
        options={MODES.map((m) => ({ id: m, label: modeLabel(m) }))}
        onChange={(m) => set('mode')(m as Mode)}
      />
      <Field
        label={intl.formatMessage(messages.fieldWarnAt)}
        value={form.warnAtPercent}
        onChange={set('warnAtPercent')}
      />
      {roles.length ? (
        <Stack direction="column" gap="200">
          <Text fontWeight="600">
            {intl.formatMessage(messages.fieldOverrides)}
          </Text>
          {roles.map((r) => (
            <Choice
              key={r.key}
              label={intl.formatMessage(messages.fieldModeFor, {
                role: r.name ?? r.key,
              })}
              value={form.modeByRole[r.key] || '__budget__'}
              options={[
                {
                  id: '__budget__',
                  label: intl.formatMessage(messages.noOverride),
                },
                ...MODES.map((m) => ({ id: m, label: modeLabel(m) })),
              ]}
              onChange={(m) =>
                setForm((f) => ({
                  ...f,
                  modeByRole: {
                    ...f.modeByRole,
                    [r.key]: m === '__budget__' ? '' : (m as Mode),
                  },
                }))
              }
            />
          ))}
        </Stack>
      ) : null}
      {errors.length ? <FieldErrors errors={errors} /> : null}
      {problem ? (
        <SaveProblem
          problem={problem}
          onReload={() => {
            setProblem(undefined);
            reloadRequested();
            props.onReload();
          }}
        />
      ) : null}
      <ReloadedNotice replaced={replaced} onReapply={reapply} />
      <Stack direction="row" gap="200">
        <Button
          variant="solid"
          colorPalette="primary"
          onPress={save}
          isDisabled={saving}
        >
          {intl.formatMessage(sharedMessages.save)}
        </Button>
        <Button variant="ghost" onPress={props.onCancel}>
          {intl.formatMessage(sharedMessages.cancel)}
        </Button>
      </Stack>
    </Stack>
  );
};

export default BudgetForm;
