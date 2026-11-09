// Form to add or edit an own cost object of any type, with allowed buyers, validity and project fields.
// [BCC-VIEW-2] [BCC-VIEW-8] [BCC-COST-2] [BCC-COST-4] [BCC-PROJ-4]
import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  CONTAINERS,
  type CostObjectType,
  type FieldError,
  type ProjectStatus,
} from '../../core';
import {
  Button,
  Checkbox,
  FormField,
  Heading,
  Select,
  Stack,
  Text,
  TextInput,
} from '@commercetools/nimbus';
import {
  type CostObjectForm as Form,
  costObjectFromForm,
  emptyCostObjectForm,
  formFromCostObject,
  type StoredCostObject,
} from '../../model/cost-objects';
import {
  FieldErrors,
  Loading,
  type Problem,
  ReadError,
  SaveProblem,
} from '../shared/feedback';
import sharedMessages from '../shared/messages';
import { writeRecord } from '../shared/save';
import { usePlatform } from '../shared/use-platform';
import {
  COST_OBJECT_TYPES,
  PROJECT_STATUSES,
  useCostObjectLabels,
} from './labels';
import { usePanelPeople } from '../shared/panel-data';
import { useDivisionPeople } from '../../data/people';
import messages from './messages';

type Props = {
  unitKey: string;
  // The record being edited; absent for a new cost object.
  editing?: StoredCostObject;
  onSaved: () => void;
  onCancel: () => void;
  onReload: () => void;
};

const Text_ = ({
  label,
  value,
  onChange,
  placeholder,
  hint,
  isReadOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
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

// The unit's associates, those of its divisions (who see the cost object too), and current buyers who are neither any
// more, so they can be removed. [BCC-COST-6]
const Buyers = ({
  unitKey,
  selected,
  onChange,
}: {
  unitKey: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) => {
  const intl = useIntl();
  const own = usePanelPeople(unitKey);
  const divisions = useDivisionPeople(unitKey);
  if (own.loading || divisions.loading) return <Loading />;
  const options = [
    ...own.people.map((p) => ({ id: p.customerId, label: p.label })),
    ...divisions.people
      .filter((p) => !own.people.some((o) => o.customerId === p.customerId))
      .map((p) => ({
        id: p.customerId,
        label: intl.formatMessage(messages.buyerOfDivision, {
          label: p.label,
          unitKey: p.unitKey,
        }),
      })),
  ];
  const former = selected
    .filter((id) => !options.some((o) => o.id === id))
    .map((id) => ({
      id,
      label: intl.formatMessage(messages.formerBuyer, { id }),
    }));
  const all = [...options, ...former];
  return (
    <Stack direction="column" gap="100">
      {own.error ? <ReadError error={own.error} /> : null}
      {divisions.error ? <ReadError error={divisions.error} /> : null}
      <Text fontWeight="600">{intl.formatMessage(messages.fieldBuyers)}</Text>
      <Text>{intl.formatMessage(messages.fieldBuyersHint)}</Text>
      {all.length === 0 ? (
        <Text>{intl.formatMessage(messages.noAssociates)}</Text>
      ) : (
        all.map((p) => (
          <Checkbox
            key={p.id}
            isSelected={selected.includes(p.id)}
            onChange={(on) =>
              onChange(
                on ? [...selected, p.id] : selected.filter((id) => id !== p.id)
              )
            }
          >
            {p.label}
          </Checkbox>
        ))
      )}
    </Stack>
  );
};

const CostObjectForm = ({
  unitKey,
  editing,
  onSaved,
  onCancel,
  onReload,
}: Props) => {
  const intl = useIntl();
  const { types, statuses } = useCostObjectLabels();
  const { dispatch, projectKey } = usePlatform();
  const [form, setForm] = useState<Form>(() =>
    editing ? formFromCostObject(editing.value) : emptyCostObjectForm()
  );
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [problem, setProblem] = useState<Problem>();
  const [saving, setSaving] = useState(false);
  const set =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setProblem(undefined);
    const built = costObjectFromForm(unitKey, form, editing?.value);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors([]);
    setSaving(true);
    const result = await writeRecord({
      dispatch,
      projectKey,
      container: CONTAINERS.costObjects,
      key: built.value.key,
      value: built.value.value,
      version: editing?.version,
    });
    setSaving(false);
    if (result.ok) onSaved();
    else setProblem(result);
  };

  const reload = () => {
    setProblem(undefined);
    onReload();
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
          ? intl.formatMessage(messages.editTitle, { code: editing.value.code })
          : intl.formatMessage(messages.newTitle)}
      </Heading>
      <Text_
        label={intl.formatMessage(messages.fieldCode)}
        value={form.code}
        onChange={set('code')}
        hint={intl.formatMessage(messages.fieldCodeHint)}
        isReadOnly={Boolean(editing)}
      />
      <Text_
        label={intl.formatMessage(messages.fieldName)}
        value={form.name}
        onChange={set('name')}
      />
      <FormField.Root>
        <FormField.Label>
          {intl.formatMessage(messages.fieldType)}
        </FormField.Label>
        <FormField.Input>
          <Select.Root
            selectedKey={form.type}
            isClearable={false}
            onSelectionChange={(k) => set('type')(k as CostObjectType)}
          >
            <Select.Options>
              {COST_OBJECT_TYPES.map((t) => (
                <Select.Option key={t} id={t}>
                  {types[t]}
                </Select.Option>
              ))}
            </Select.Options>
          </Select.Root>
        </FormField.Input>
      </FormField.Root>
      <Text_
        label={intl.formatMessage(messages.fieldExternalId)}
        value={form.externalId}
        onChange={set('externalId')}
      />
      <Text_
        label={intl.formatMessage(messages.fieldValidFrom)}
        value={form.validFrom}
        onChange={set('validFrom')}
        placeholder={intl.formatMessage(messages.datePlaceholder)}
      />
      <Text_
        label={intl.formatMessage(messages.fieldValidTo)}
        value={form.validTo}
        onChange={set('validTo')}
        placeholder={intl.formatMessage(messages.datePlaceholder)}
      />
      {form.type === 'project' ? (
        <>
          <FormField.Root>
            <FormField.Label>
              {intl.formatMessage(messages.fieldProjectStatus)}
            </FormField.Label>
            <FormField.Input>
              <Select.Root
                selectedKey={form.projectStatus}
                isClearable={false}
                onSelectionChange={(k) =>
                  set('projectStatus')(k as ProjectStatus)
                }
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
          <Text_
            label={intl.formatMessage(messages.fieldSiteAddress)}
            value={form.siteAddress}
            onChange={set('siteAddress')}
          />
          <Text_
            label={intl.formatMessage(messages.fieldErpProjectNumber)}
            value={form.erpProjectNumber}
            onChange={set('erpProjectNumber')}
          />
        </>
      ) : null}
      <Buyers
        unitKey={unitKey}
        selected={form.buyers}
        onChange={set('buyers')}
      />
      {errors.length ? <FieldErrors errors={errors} /> : null}
      {problem ? <SaveProblem problem={problem} onReload={reload} /> : null}
      <Stack direction="row" gap="200">
        <Button
          variant="solid"
          colorPalette="primary"
          onPress={save}
          isDisabled={saving}
        >
          {intl.formatMessage(sharedMessages.save)}
        </Button>
        <Button variant="ghost" onPress={onCancel}>
          {intl.formatMessage(sharedMessages.cancel)}
        </Button>
      </Stack>
    </Stack>
  );
};

export default CostObjectForm;
