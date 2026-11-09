// Approval Rule check and setup, acting as an associate of the unit that the user picks: active budget rules,
// roles that may order but are not covered, the coverage record with its check time and staleness, and "Set up
// budget approval". [BCC-APPR-2] [BCC-APPR-3] [BCC-APPR-4] [BCC-VIEW-9] [BCC-SET-1]
import React, { useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  CONTAINERS,
  type CostObject,
  coveredRoles,
  type Settings,
  type UnitNode,
} from '../../core';
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Heading,
  Select,
  Stack,
  Table,
  Text,
} from '@commercetools/nimbus';
import {
  createApprovalRule,
  fetchApprovalRules,
} from '../../data/approval-rules';
import { messageOf } from '../../data/client';
import { useRecords } from '../../data/records';
import type { BusinessUnitSummary } from '../../data/units';
import { useCanManage } from '../../hooks/use-can-manage';
import {
  budgetRules,
  countsAsCoverage,
  coverageFrom,
  coveringRules,
  coverageStatus,
  missingRequesters,
  orderingRoles,
  peopleWith,
  type RoleLike,
  rolesInUse,
  ruleDraft,
  type RuleLike,
  ruleSummary,
  settingsWithCoverage,
  type StaleReason,
} from '../../model/approval';
import type { ViewFieldError } from '../../model/errors';
import type { Person } from '../../model/people';
import {
  settingsDraft,
  type SettingsDraft,
  visibleCostObjectKeys,
} from '../../model/settings';
import {
  FieldErrors,
  Loading,
  type Problem,
  ReadError,
  SaveProblem,
} from '../shared/feedback';
import { writeRecord } from '../shared/save';
import { usePlatform } from '../shared/use-platform';
import { usePanelChain, usePanelPeople } from '../shared/panel-data';
import messages from './messages';

// `clock` gives the time a check is written at; tests fix it.
type Props = { unit: BusinessUnitSummary; clock?: () => string };

const realClock = () => new Date().toISOString();

const q = (v: string) => JSON.stringify(v);

const REASONS: Record<StaleReason, keyof typeof messages> = {
  'never-checked': 'reasonNeverChecked',
  'rule-missing': 'reasonRuleMissing',
  'rule-inactive': 'reasonRuleInactive',
  'rule-not-exact': 'reasonRuleNotExact',
  'rule-changed': 'reasonRuleChanged',
  'requesters-changed': 'reasonRequesters',
};

const Rules = ({
  rules,
  roleName,
}: {
  rules: RuleLike[];
  roleName: (k: string) => string;
}) => {
  const intl = useIntl();
  if (!rules.length) return <Text>{intl.formatMessage(messages.noRule)}</Text>;
  return (
    <Table.Root size="sm" aria-label={intl.formatMessage(messages.rulesLabel)}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>
            {intl.formatMessage(messages.colRule)}
          </Table.ColumnHeader>
          <Table.ColumnHeader>
            {intl.formatMessage(messages.colRequesters)}
          </Table.ColumnHeader>
          <Table.ColumnHeader>
            {intl.formatMessage(messages.colApprovers)}
          </Table.ColumnHeader>
          <Table.ColumnHeader>
            {intl.formatMessage(messages.colCoverage)}
          </Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rules.map((r) => {
          const s = ruleSummary(r);
          return (
            <Table.Row key={r.id}>
              <Table.Cell>{s.ref}</Table.Cell>
              <Table.Cell>{s.requesters.map(roleName).join(', ')}</Table.Cell>
              <Table.Cell>
                {s.tiers
                  .map((t, i) => `${i + 1}: ${t.map(roleName).join(', ')}`)
                  .join('; ')}
              </Table.Cell>
              <Table.Cell>
                {intl.formatMessage(
                  countsAsCoverage(r) ? messages.counts : messages.notCounts
                )}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
};

const Setup = ({
  unitKey,
  associate,
  roles,
  ordering,
  onCreated,
}: {
  unitKey: string;
  associate: Person;
  roles: RoleLike[];
  ordering: string[];
  onCreated(): Promise<void>;
}) => {
  const intl = useIntl();
  const { dispatch, projectKey } = usePlatform();
  const [requesters, setRequesters] = useState<string[]>(ordering);
  const [tiers, setTiers] = useState<string[][]>([[]]);
  const [errors, setErrors] = useState<ViewFieldError[]>([]);
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const toggle = (list: string[], key: string, on: boolean) =>
    on ? [...list, key] : list.filter((k) => k !== key);
  const name = (r: RoleLike) => r.name ?? r.key;

  const create = async () => {
    setFailure(undefined);
    const draft = ruleDraft(unitKey, {
      requesterRoles: roles
        .map((r) => r.key)
        .filter((k) => requesters.includes(k)),
      approverTiers: tiers.map((t) =>
        roles.map((r) => r.key).filter((k) => t.includes(k))
      ),
    });
    if (!draft.ok) {
      setErrors(draft.errors);
      return;
    }
    setErrors([]);
    setBusy(true);
    try {
      await createApprovalRule(
        dispatch,
        projectKey,
        associate.customerId,
        unitKey,
        draft.value
      );
      await onCreated();
    } catch (e) {
      setFailure(
        intl.formatMessage(messages.createFailed, { message: messageOf(e) })
      );
    }
    setBusy(false);
  };

  return (
    <Stack
      direction="column"
      gap="300"
      padding="300"
      borderWidth="1px"
      borderRadius="200"
    >
      <Heading as="h4">{intl.formatMessage(messages.setupTitle)}</Heading>
      <Text fontWeight="600">{intl.formatMessage(messages.requesters)}</Text>
      {roles.map((r) => (
        <Checkbox
          key={r.key}
          aria-label={intl.formatMessage(messages.requesterLabel, {
            role: name(r),
          })}
          isSelected={requesters.includes(r.key)}
          onChange={(on) => setRequesters((l) => toggle(l, r.key, on))}
        >
          {name(r)}
        </Checkbox>
      ))}
      {tiers.map((tier, i) => (
        <Stack key={i} direction="column" gap="100">
          <Text fontWeight="600">
            {intl.formatMessage(messages.tier, { n: i + 1 })}
          </Text>
          {roles.map((r) => (
            <Checkbox
              key={r.key}
              aria-label={intl.formatMessage(messages.tierRoleLabel, {
                n: i + 1,
                role: name(r),
              })}
              isSelected={tier.includes(r.key)}
              onChange={(on) =>
                setTiers((ts) =>
                  ts.map((t, j) => (j === i ? toggle(t, r.key, on) : t))
                )
              }
            >
              {name(r)}
            </Checkbox>
          ))}
        </Stack>
      ))}
      {tiers.length < 5 ? (
        <Stack direction="row">
          <Button
            size="xs"
            variant="ghost"
            onPress={() => setTiers((ts) => [...ts, []])}
          >
            {intl.formatMessage(messages.addTier)}
          </Button>
        </Stack>
      ) : null}
      {errors.length ? <FieldErrors errors={errors} /> : null}
      {failure ? (
        <Alert.Root colorPalette="critical" variant="outlined">
          <Alert.Description>{failure}</Alert.Description>
        </Alert.Root>
      ) : null}
      <Stack direction="row">
        <Button
          variant="solid"
          colorPalette="primary"
          onPress={create}
          isDisabled={busy}
        >
          {intl.formatMessage(messages.create, { associate: associate.label })}
        </Button>
      </Stack>
    </Stack>
  );
};

const Check = ({
  unitKey,
  draft,
  people,
  roles,
  inherited,
  visibleKeys,
  clock,
  onSettingsSaved,
}: {
  unitKey: string;
  draft: SettingsDraft;
  people: Person[];
  roles: RoleLike[];
  // Roles the parent's coverage holds while the unit inherits Approval Rules [BCC-APPR-2].
  inherited: string[];
  visibleKeys: string[];
  clock: () => string;
  onSettingsSaved: () => void;
}) => {
  const intl = useIntl();
  const canManage = useCanManage();
  const { dispatch, projectKey } = usePlatform();
  const candidates = peopleWith('CreateApprovalRules', people, roles);
  const [associateId, setAssociateId] = useState<string>();
  const [rules, setRules] = useState<RuleLike[]>();
  const [readFailure, setReadFailure] = useState<string>();
  const [problem, setProblem] = useState<Problem>();
  const [saved, setSaved] = useState(false);
  const associate = candidates.find((p) => p.customerId === associateId);
  const roleName = (k: string) => roles.find((r) => r.key === k)?.name ?? k;
  const ordering = orderingRoles(roles, rolesInUse(people));
  // Coverage counts only from the unit's own record [BCC-APPR-2].
  const approval =
    draft.source === 'own' ? draft.value.approval : { requesterRoles: [] };

  // Only the read for the associate picked last may set the rules; an earlier read answering later is dropped.
  const request = useRef(0);
  const load = async (id: string) => {
    const mine = ++request.current;
    setReadFailure(undefined);
    setRules(undefined);
    try {
      const r = await fetchApprovalRules(dispatch, projectKey, id, unitKey);
      if (mine !== request.current) return undefined;
      setRules(r);
      return r;
    } catch (e) {
      if (mine === request.current)
        setReadFailure(
          intl.formatMessage(messages.readFailed, { message: messageOf(e) })
        );
      return undefined;
    }
  };

  const saveCoverage = async (current: RuleLike[]) => {
    setProblem(undefined);
    setSaved(false);
    const result = await writeRecord({
      dispatch,
      projectKey,
      container: CONTAINERS.settings,
      key: unitKey,
      // Dated at the write, not when the panel opened. [BCC-APPR-3]
      value: settingsWithCoverage(draft, coverageFrom(current, clock())),
      version: draft.version,
      options: { visibleCostObjectKeys: visibleKeys },
    });
    if (result.ok) {
      setSaved(true);
      onSettingsSaved();
    } else setProblem(result);
  };

  if (!candidates.length)
    return (
      <Text>{intl.formatMessage(messages.noCandidates, { unitKey })}</Text>
    );

  const active = rules ? budgetRules(rules) : [];
  const covering = rules ? coveringRules(rules) : [];
  const missing = rules ? missingRequesters(ordering, rules, inherited) : [];
  const status = rules ? coverageStatus(approval, rules) : undefined;

  return (
    <Stack direction="column" gap="300">
      <FormField.Root>
        <FormField.Label>{intl.formatMessage(messages.actAs)}</FormField.Label>
        <FormField.Input>
          <Select.Root
            selectedKey={associateId ?? null}
            isClearable={false}
            placeholder={intl.formatMessage(messages.choose)}
            onSelectionChange={(k) => {
              const id = k === null ? undefined : String(k);
              setAssociateId(id);
              setSaved(false);
              if (id) void load(id);
            }}
          >
            <Select.Options>
              {candidates.map((p) => (
                <Select.Option key={p.customerId} id={p.customerId}>
                  {p.label}
                </Select.Option>
              ))}
            </Select.Options>
          </Select.Root>
        </FormField.Input>
        <FormField.Description>
          {intl.formatMessage(messages.actAsHint)}
        </FormField.Description>
      </FormField.Root>
      {associate ? (
        <Text>
          {intl.formatMessage(messages.actingAs, {
            associate: associate.label,
            unitKey,
          })}
        </Text>
      ) : null}
      {readFailure ? (
        <Alert.Root colorPalette="critical" variant="outlined">
          <Alert.Description>{readFailure}</Alert.Description>
        </Alert.Root>
      ) : null}
      {associate && !rules && !readFailure ? <Loading /> : null}
      {rules ? (
        <Stack direction="column" gap="300">
          <Heading as="h4">{intl.formatMessage(messages.rulesTitle)}</Heading>
          <Rules rules={active} roleName={roleName} />
          {missing.length ? (
            <Alert.Root colorPalette="warning" variant="outlined">
              <Alert.Description>
                {intl.formatMessage(messages.missing, {
                  roles: missing.join(', '),
                })}
              </Alert.Description>
            </Alert.Root>
          ) : null}
          {status && !saved ? (
            status.stale ? (
              <Alert.Root colorPalette="warning" variant="outlined">
                <Alert.Title>{intl.formatMessage(messages.stale)}</Alert.Title>
                <Alert.Description>
                  {status.reasons
                    .map((r) => intl.formatMessage(messages[REASONS[r]]))
                    .join(' ')}
                </Alert.Description>
              </Alert.Root>
            ) : (
              <Text>{intl.formatMessage(messages.current)}</Text>
            )
          ) : null}
          {saved ? (
            <Text>{intl.formatMessage(messages.checkSaved)}</Text>
          ) : null}
          {problem ? (
            <SaveProblem
              problem={problem}
              onReload={() => {
                setProblem(undefined);
                onSettingsSaved();
              }}
            />
          ) : null}
          {canManage && status?.stale && !saved ? (
            <Stack direction="row">
              <Button variant="outline" onPress={() => saveCoverage(rules)}>
                {intl.formatMessage(messages.saveCheck)}
              </Button>
            </Stack>
          ) : null}
          {canManage && associate && !covering.length ? (
            <Setup
              unitKey={unitKey}
              associate={associate}
              roles={roles}
              ordering={ordering}
              onCreated={async () => {
                const fresh = await load(associate.customerId);
                if (fresh) await saveCoverage(fresh);
              }}
            />
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
};

const Body = ({
  unit,
  units,
  clock,
}: {
  unit: BusinessUnitSummary;
  units: UnitNode[];
  clock: () => string;
}) => {
  const intl = useIntl();
  const keys = units.map((u) => q(u.key)).join(', ');
  const settings = useRecords<Settings>(
    CONTAINERS.settings,
    `key in (${keys})`
  );
  const costObjects = useRecords<CostObject>(
    CONTAINERS.costObjects,
    `value(ownerBusinessUnitKey in (${keys}))`
  );
  const people = usePanelPeople(unit.key);
  const [loaded, setLoaded] = useState(false);
  if (!loaded && !settings.loading && !costObjects.loading && !people.loading)
    setLoaded(true);
  if (!loaded) return <Loading />;

  const draft = settingsDraft(unit.key, units, settings.records);
  const own = draft.source === 'own' ? draft.value.approval : undefined;
  const self = units.find((u) => u.key === unit.key);
  const inherited =
    self?.approvalRuleMode === 'ExplicitAndFromParent' && self.parentKey
      ? coveredRoles(
          self.parentKey,
          units,
          Object.fromEntries(settings.records.map((r) => [r.key, r.value]))
        )
      : [];
  return (
    <Stack direction="column" gap="300">
      {[settings.error, costObjects.error, people.error].map((e, i) =>
        e ? <ReadError key={i} error={e} /> : null
      )}
      <Text>{intl.formatMessage(messages.intro)}</Text>
      {own ? (
        <Stack direction="column" gap="100">
          <Text>
            {own.checkedAt
              ? intl.formatMessage(messages.checkedAt, {
                  checkedAt: own.checkedAt,
                })
              : intl.formatMessage(messages.neverChecked)}
          </Text>
          <Text>
            {intl.formatMessage(messages.coveredRoles, {
              roles:
                own.requesterRoles.join(', ') ||
                intl.formatMessage(messages.none),
            })}
          </Text>
        </Stack>
      ) : (
        <Text>{intl.formatMessage(messages.recordInherited)}</Text>
      )}
      <Check
        unitKey={unit.key}
        draft={draft}
        people={people.people}
        roles={people.roles}
        inherited={inherited}
        visibleKeys={visibleCostObjectKeys(
          unit.key,
          units,
          costObjects.records.map((r) => r.value)
        )}
        clock={clock}
        onSettingsSaved={settings.reload}
      />
    </Stack>
  );
};

const Approval = ({ unit, clock = realClock }: Props) => {
  const intl = useIntl();
  const { units, loading, error } = usePanelChain(unit.key);
  return (
    <Stack direction="column" gap="300">
      <Heading as="h3">{intl.formatMessage(messages.title)}</Heading>
      {error ? <ReadError error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && units.length ? (
        <Body unit={unit} units={units} clock={clock} />
      ) : null}
    </Stack>
  );
};

export default Approval;
