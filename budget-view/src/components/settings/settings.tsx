// Unit settings: default mode, cost object required, default cost object. Saving writes the unit's full record,
// pre-filled from the effective settings. [BCC-VIEW-5] [BCC-VIEW-8] [BCC-VIEW-9] [BCC-SET-1] [BCC-SET-2] [BCC-SET-4]
import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  CONTAINERS,
  type CostObject,
  type Mode,
  MODES,
  type Settings,
  type UnitNode,
} from '../../core';
import {
  Alert,
  Button,
  FormField,
  Heading,
  Select,
  Stack,
  Switch,
  Text,
} from '@commercetools/nimbus';
import { useRecords } from '../../data/records';
import type { BusinessUnitSummary } from '../../data/units';
import { useCanManage } from '../../hooks/use-can-manage';
import {
  defaultCostObjectOptions,
  type SettingsDraft,
  settingsDraft,
  type SettingsForm,
  settingsFormOf,
  settingsFromForm,
  visibleCostObjectKeys,
} from '../../model/settings';
import {
  Loading,
  type Problem,
  ReadError,
  SaveProblem,
  useModeLabel,
} from '../shared/feedback';
import sharedMessages from '../shared/messages';
import { writeRecord } from '../shared/save';
import { usePlatform } from '../shared/use-platform';
import { usePanelChain } from '../shared/panel-data';
import { ReloadedNotice, useReloadableForm } from '../shared/reloadable-form';
import messages from './messages';

type Props = { unit: BusinessUnitSummary; now?: string };

const q = (v: string) => JSON.stringify(v);
const NONE = '__none__';

const Source = ({ draft }: { draft: SettingsDraft }) => {
  const intl = useIntl();
  if (draft.source === 'own')
    return <Text>{intl.formatMessage(messages.sourceOwn)}</Text>;
  if (draft.source === 'inherited')
    return (
      <Text>
        {intl.formatMessage(messages.sourceInherited, { unitKey: draft.from })}
      </Text>
    );
  return <Text>{intl.formatMessage(messages.sourceDefaults)}</Text>;
};

const ReadOnly = ({ form }: { form: SettingsForm }) => {
  const intl = useIntl();
  const modeLabel = useModeLabel();
  const row = (label: string, value: string) => (
    <Stack direction="row" gap="200">
      <Text fontWeight="600">{label}</Text>
      <Text>{value}</Text>
    </Stack>
  );
  return (
    <Stack direction="column" gap="100">
      {row(
        intl.formatMessage(messages.fieldDefaultMode),
        modeLabel(form.defaultMode)
      )}
      {row(
        intl.formatMessage(messages.fieldRequired),
        intl.formatMessage(
          form.costObjectRequired ? sharedMessages.yes : sharedMessages.no
        )
      )}
      {row(
        intl.formatMessage(messages.fieldDefaultCostObject),
        form.defaultCostObject || intl.formatMessage(messages.noDefault)
      )}
    </Stack>
  );
};

const Editor = ({
  unitKey,
  draft,
  options,
  visibleKeys,
  onSaved,
  onReload,
}: {
  unitKey: string;
  draft: SettingsDraft;
  options: Array<{ key: string; label: string }>;
  visibleKeys: string[];
  onSaved: () => void;
  onReload: () => void;
}) => {
  const intl = useIntl();
  const modeLabel = useModeLabel();
  const { dispatch, projectKey } = usePlatform();
  const { form, setForm, replaced, reloadRequested, reapply } =
    useReloadableForm<SettingsForm>(() => settingsFormOf(draft), draft.version);
  const [problem, setProblem] = useState<Problem>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const unavailable =
    form.defaultCostObject &&
    !options.some((o) => o.key === form.defaultCostObject)
      ? form.defaultCostObject
      : undefined;

  const save = async () => {
    setProblem(undefined);
    setSaved(false);
    setSaving(true);
    const value: Settings = settingsFromForm(draft, form);
    const result = await writeRecord({
      dispatch,
      projectKey,
      container: CONTAINERS.settings,
      key: unitKey,
      value,
      version: draft.version,
      options: { visibleCostObjectKeys: visibleKeys },
    });
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      onSaved();
    } else setProblem(result);
  };

  return (
    <Stack direction="column" gap="300">
      <FormField.Root>
        <FormField.Label>
          {intl.formatMessage(messages.fieldDefaultMode)}
        </FormField.Label>
        <FormField.Input>
          <Select.Root
            selectedKey={form.defaultMode}
            isClearable={false}
            onSelectionChange={(k) =>
              setForm((f) => ({ ...f, defaultMode: k as Mode }))
            }
          >
            <Select.Options>
              {MODES.map((m) => (
                <Select.Option key={m} id={m}>
                  {modeLabel(m)}
                </Select.Option>
              ))}
            </Select.Options>
          </Select.Root>
        </FormField.Input>
        <FormField.Description>
          {intl.formatMessage(messages.fieldDefaultModeHint)}
        </FormField.Description>
      </FormField.Root>
      <Switch
        isSelected={form.costObjectRequired}
        onChange={(on) => setForm((f) => ({ ...f, costObjectRequired: on }))}
      >
        {intl.formatMessage(messages.fieldRequired)}
      </Switch>
      <FormField.Root>
        <FormField.Label>
          {intl.formatMessage(messages.fieldDefaultCostObject)}
        </FormField.Label>
        <FormField.Input>
          <Select.Root
            selectedKey={form.defaultCostObject || NONE}
            isClearable={false}
            onSelectionChange={(k) =>
              setForm((f) => ({
                ...f,
                defaultCostObject: k === NONE ? '' : String(k),
              }))
            }
          >
            <Select.Options>
              <Select.Option id={NONE}>
                {intl.formatMessage(messages.noDefault)}
              </Select.Option>
              {options.map((o) => (
                <Select.Option key={o.key} id={o.key}>
                  {o.label}
                </Select.Option>
              ))}
            </Select.Options>
          </Select.Root>
        </FormField.Input>
        <FormField.Description>
          {intl.formatMessage(messages.fieldDefaultCostObjectHint)}
        </FormField.Description>
      </FormField.Root>
      {unavailable ? (
        <Alert.Root colorPalette="warning" variant="outlined">
          <Alert.Description>
            {intl.formatMessage(messages.defaultUnavailable, {
              key: unavailable,
            })}
          </Alert.Description>
        </Alert.Root>
      ) : null}
      {problem ? (
        <SaveProblem
          problem={problem}
          onReload={() => {
            setProblem(undefined);
            reloadRequested();
            onReload();
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
          {intl.formatMessage(sharedMessages.save)}
        </Button>
      </Stack>
    </Stack>
  );
};

const Body = ({ unit, units, now }: Props & { units: UnitNode[] }) => {
  const canManage = useCanManage();
  const keys = units.map((u) => q(u.key)).join(', ');
  const settings = useRecords<Settings>(
    CONTAINERS.settings,
    `key in (${keys})`
  );
  const costObjects = useRecords<CostObject>(
    CONTAINERS.costObjects,
    `value(ownerBusinessUnitKey in (${keys}))`
  );
  const [at] = useState(() => now ?? new Date().toISOString());
  // Only the first load shows a spinner, so a reload never discards the input of the form.
  const [loaded, setLoaded] = useState(false);
  if (!loaded && !settings.loading && !costObjects.loading) setLoaded(true);
  if (!loaded) return <Loading />;
  const draft = settingsDraft(unit.key, units, settings.records);
  const values = costObjects.records.map((r) => r.value);
  const reload = () => {
    settings.reload();
    costObjects.reload();
  };
  return (
    <Stack direction="column" gap="300">
      {settings.error ? <ReadError error={settings.error} /> : null}
      {costObjects.error ? <ReadError error={costObjects.error} /> : null}
      <Source draft={draft} />
      {canManage ? (
        <Editor
          unitKey={unit.key}
          draft={draft}
          options={defaultCostObjectOptions(unit.key, units, values, at)}
          visibleKeys={visibleCostObjectKeys(unit.key, units, values)}
          onSaved={settings.reload}
          onReload={reload}
        />
      ) : (
        <ReadOnly form={settingsFormOf(draft)} />
      )}
    </Stack>
  );
};

const UnitSettings = ({ unit, now }: Props) => {
  const intl = useIntl();
  const { units, loading, error } = usePanelChain(unit.key);
  return (
    <Stack direction="column" gap="300">
      <Heading as="h3">{intl.formatMessage(messages.title)}</Heading>
      {error ? <ReadError error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && units.length ? (
        <Body unit={unit} units={units} now={now} />
      ) : null}
    </Stack>
  );
};

export default UnitSettings;
