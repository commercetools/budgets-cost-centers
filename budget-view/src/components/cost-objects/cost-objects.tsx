// Cost objects of the unit: own ones editable, those of the parents read-only with their owner; add, edit,
// deactivate, and the project overview. [BCC-VIEW-2] [BCC-VIEW-6] [BCC-VIEW-8] [BCC-VIEW-9] [BCC-COST-5]
import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  CONTAINERS,
  type CostObject,
  deactivateCostObject,
  type UnitNode,
} from '../../core';
import {
  Badge,
  Button,
  Heading,
  Stack,
  Table,
  Text,
} from '@commercetools/nimbus';
import { useRecords } from '../../data/records';
import type { BusinessUnitSummary } from '../../data/units';
import { useCanManage } from '../../hooks/use-can-manage';
import { costObjectRows, type CostObjectRow } from '../../model/cost-objects';
import {
  Loading,
  type Problem,
  ReadError,
  SaveProblem,
} from '../shared/feedback';
import { writeRecord } from '../shared/save';
import { usePlatform } from '../shared/use-platform';
import ProjectOverview from '../project/project-overview';
import CostObjectForm from './cost-object-form';
import { useCostObjectLabels } from './labels';
import { usePanelChain } from '../shared/panel-data';
import messages from './messages';

type Props = { unit: BusinessUnitSummary; now?: string };

const q = (v: string) => JSON.stringify(v);

const Body = ({ unit, units, now }: Props & { units: UnitNode[] }) => {
  const intl = useIntl();
  const canManage = useCanManage();
  const { types } = useCostObjectLabels();
  const { dispatch, projectKey } = usePlatform();
  const owners = units.map((u) => q(u.key)).join(', ');
  const { records, loading, error, reload } = useRecords<CostObject>(
    CONTAINERS.costObjects,
    `value(ownerBusinessUnitKey in (${owners}))`
  );
  const [form, setForm] = useState<{ editKey?: string } | undefined>();
  const [project, setProject] = useState<string>();
  const [problem, setProblem] = useState<Problem>();
  // Only the first load shows a spinner, so a reload never discards an open form.
  const [loaded, setLoaded] = useState(false);
  if (!loaded && !loading) setLoaded(true);

  if (!loaded) return <Loading />;
  const rows = costObjectRows(unit.key, units, records);
  const editing = form?.editKey
    ? records.find((r) => r.key === form.editKey)
    : undefined;
  const openProject = rows.find((r) => r.key === project);

  const deactivate = async (row: CostObjectRow) => {
    setProblem(undefined);
    const result = await writeRecord({
      dispatch,
      projectKey,
      container: CONTAINERS.costObjects,
      key: row.key,
      value: deactivateCostObject(row.value),
      version: row.version,
    });
    if (result.ok) reload();
    else setProblem(result);
  };

  return (
    <Stack direction="column" gap="300">
      {error ? <ReadError error={error} /> : null}
      {problem ? (
        <SaveProblem
          problem={problem}
          onReload={() => {
            setProblem(undefined);
            reload();
          }}
        />
      ) : null}
      {rows.length === 0 ? (
        <Text>{intl.formatMessage(messages.empty)}</Text>
      ) : (
        <Table.Root
          size="sm"
          aria-label={intl.formatMessage(messages.tableLabel)}
        >
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>
                {intl.formatMessage(messages.colCode)}
              </Table.ColumnHeader>
              <Table.ColumnHeader>
                {intl.formatMessage(messages.colName)}
              </Table.ColumnHeader>
              <Table.ColumnHeader>
                {intl.formatMessage(messages.colType)}
              </Table.ColumnHeader>
              <Table.ColumnHeader>
                {intl.formatMessage(messages.colOwner)}
              </Table.ColumnHeader>
              <Table.ColumnHeader>
                {intl.formatMessage(messages.colStatus)}
              </Table.ColumnHeader>
              <Table.ColumnHeader>
                {intl.formatMessage(messages.colActions)}
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row key={row.key}>
                <Table.Cell>{row.value.code}</Table.Cell>
                <Table.Cell>{row.value.name}</Table.Cell>
                <Table.Cell>{types[row.value.type]}</Table.Cell>
                <Table.Cell>
                  <Stack direction="column" gap="50">
                    <Text>{row.owner}</Text>
                    {row.editable ? null : (
                      <Badge size="xs" colorPalette="neutral">
                        {intl.formatMessage(messages.inherited)}
                      </Badge>
                    )}
                  </Stack>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    size="xs"
                    colorPalette={row.value.active ? 'positive' : 'neutral'}
                  >
                    {intl.formatMessage(
                      row.value.active ? messages.active : messages.inactive
                    )}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Stack direction="row" gap="100">
                    {row.value.type === 'project' ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={intl.formatMessage(
                          messages.openProjectLabel,
                          { code: row.value.code }
                        )}
                        onPress={() => setProject(row.key)}
                      >
                        {intl.formatMessage(messages.openProject)}
                      </Button>
                    ) : null}
                    {canManage && row.editable ? (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          aria-label={intl.formatMessage(messages.editLabel, {
                            code: row.value.code,
                          })}
                          onPress={() => setForm({ editKey: row.key })}
                        >
                          {intl.formatMessage(messages.edit)}
                        </Button>
                        {row.value.active ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            colorPalette="critical"
                            aria-label={intl.formatMessage(
                              messages.deactivateLabel,
                              { code: row.value.code }
                            )}
                            onPress={() => deactivate(row)}
                          >
                            {intl.formatMessage(messages.deactivate)}
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </Stack>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
      {canManage && !form ? (
        <Stack direction="row">
          <Button variant="outline" onPress={() => setForm({})}>
            {intl.formatMessage(messages.add)}
          </Button>
        </Stack>
      ) : null}
      {canManage && form && (!form.editKey || editing) ? (
        <CostObjectForm
          key={form.editKey ?? 'new'}
          unitKey={unit.key}
          editing={editing}
          onSaved={() => {
            setForm(undefined);
            reload();
          }}
          onCancel={() => setForm(undefined)}
          onReload={reload}
        />
      ) : null}
      {openProject ? (
        <ProjectOverview
          key={openProject.key}
          project={openProject}
          readOnly={!openProject.editable}
          now={now}
          onClose={() => setProject(undefined)}
          onChanged={reload}
        />
      ) : null}
    </Stack>
  );
};

const CostObjects = ({ unit, now }: Props) => {
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

export default CostObjects;
