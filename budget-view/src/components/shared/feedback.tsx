// Loading, read errors and save problems of the sections; a conflict keeps the input and offers a reload.
// [BCC-VIEW-8] [BCC-VIEW-10]
import React from 'react';
import { type MessageDescriptor, useIntl } from 'react-intl';
import type { Mode } from '../../core';
import {
  Alert,
  Button,
  LoadingSpinner,
  Stack,
  Text,
} from '@commercetools/nimbus';
import type { DataError } from '../../data/client';
import type { SaveResult } from '../../data/records';
import type { ViewFieldError, ViewMessage } from '../../model/errors';
import messages from './messages';

// Field names of core, the view's forms and its records, as people read them. [BCC-VIEW-10]
const FIELD_LABELS: Record<string, MessageDescriptor> = {
  value: messages.field_value,
  key: messages.field_key,
  container: messages.field_container,
  code: messages.field_code,
  name: messages.field_name,
  type: messages.field_type,
  ownerBusinessUnitKey: messages.field_ownerBusinessUnitKey,
  linkedBusinessUnitKey: messages.field_linkedBusinessUnitKey,
  active: messages.field_active,
  validFrom: messages.field_validFrom,
  validTo: messages.field_validTo,
  externalId: messages.field_externalId,
  buyers: messages.field_buyers,
  project: messages.field_project,
  projectStatus: messages.field_projectStatus,
  status: messages.field_status,
  siteAddress: messages.field_siteAddress,
  erpProjectNumber: messages.field_erpProjectNumber,
  'custom.type': messages.field_custom_type,
  id: messages.field_id,
  scope: messages.field_scope,
  scopeKind: messages.field_scopeKind,
  scopeRef: messages.field_scopeRef,
  amount: messages.field_amount,
  currencyCode: messages.field_currencyCode,
  period: messages.field_period,
  periodKind: messages.field_periodKind,
  'period.from': messages.field_period_from,
  from: messages.field_from,
  'period.to': messages.field_period_to,
  to: messages.field_to,
  mode: messages.field_mode,
  modeByRole: messages.field_modeByRole,
  warnAtPercent: messages.field_warnAtPercent,
  defaultMode: messages.field_defaultMode,
  costObjectRequired: messages.field_costObjectRequired,
  defaultCostObject: messages.field_defaultCostObject,
  costObjectLevel: messages.field_costObjectLevel,
  features: messages.field_features,
  approval: messages.field_approval,
  requesters: messages.field_requesters,
  approvers: messages.field_approvers,
};

export const useFieldLabel = () => {
  const intl = useIntl();
  return (field: string) => {
    const d =
      FIELD_LABELS[field] ??
      FIELD_LABELS[field.split('.')[0] ?? ''] ??
      messages.field_unknown;
    return intl.formatMessage(d);
  };
};

// A descriptor is translated; a text from core or the platform is shown as received.
export const useViewMessage = () => {
  const intl = useIntl();
  return (m: ViewMessage, values?: Record<string, string | number>) =>
    typeof m === 'string' ? m : intl.formatMessage(m, values);
};

export const Loading = () => {
  const intl = useIntl();
  return <LoadingSpinner aria-label={intl.formatMessage(messages.loading)} />;
};

export const ReadError = ({ error }: { error: DataError }) => {
  const intl = useIntl();
  return (
    <Alert.Root colorPalette="critical" variant="outlined">
      <Alert.Title>{intl.formatMessage(messages.readFailedTitle)}</Alert.Title>
      <Alert.Description>
        {error.kind === 'request'
          ? intl.formatMessage(messages.readFailedDetail, {
              message: error.message,
            })
          : error.kind === 'container'
          ? intl.formatMessage(messages.unknownContainer, {
              container: error.container,
            })
          : intl.formatMessage(messages.corruptRecords, {
              keys: error.records.map((r) => r.key).join(', '),
            })}
      </Alert.Description>
    </Alert.Root>
  );
};

export const FieldErrors = ({ errors }: { errors: ViewFieldError[] }) => {
  const intl = useIntl();
  const label = useFieldLabel();
  const text = useViewMessage();
  return (
    <Stack direction="column" gap="100">
      {errors.map((e) => {
        const message = text(e.message, e.values);
        return (
          <Text key={`${e.field}:${message}`} color="critical.11">
            {intl.formatMessage(messages.fieldError, {
              field: label(e.field),
              message,
            })}
          </Text>
        );
      })}
    </Stack>
  );
};

export type Problem =
  | Exclude<SaveResult, { ok: true }>
  | { ok: false; keyTaken: string };

// Shows why a save failed. On a conflict the form keeps its input; reload refreshes the records and their versions.
export const SaveProblem = ({
  problem,
  onReload,
}: {
  problem: Problem;
  onReload: () => void;
}) => {
  const intl = useIntl();
  if ('conflict' in problem)
    return (
      <Alert.Root colorPalette="warning" variant="outlined">
        <Alert.Title>{intl.formatMessage(messages.conflictTitle)}</Alert.Title>
        <Alert.Description>
          {intl.formatMessage(messages.conflictDetail)}
        </Alert.Description>
        <Alert.Actions>
          <Button variant="outline" size="xs" onPress={onReload}>
            {intl.formatMessage(messages.reload)}
          </Button>
        </Alert.Actions>
      </Alert.Root>
    );
  return (
    <Alert.Root colorPalette="critical" variant="outlined">
      <Alert.Title>{intl.formatMessage(messages.saveFailedTitle)}</Alert.Title>
      <Alert.Description>
        {'keyTaken' in problem ? (
          intl.formatMessage(messages.keyTaken, { key: problem.keyTaken })
        ) : 'errors' in problem ? (
          <FieldErrors errors={problem.errors} />
        ) : (
          intl.formatMessage(messages.readFailedDetail, {
            message: problem.message,
          })
        )}
      </Alert.Description>
    </Alert.Root>
  );
};

export const useModeLabel = () => {
  const intl = useIntl();
  const labels: Record<Mode, string> = {
    approval: intl.formatMessage(messages.modeApproval),
    warn: intl.formatMessage(messages.modeWarn),
    block: intl.formatMessage(messages.modeBlock),
  };
  return (m: Mode) => labels[m];
};
