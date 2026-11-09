// Labels of cost-object types and project statuses. [BCC-VIEW-2] [BCC-VIEW-10]
import { useIntl } from 'react-intl';
import type { CostObjectType, ProjectStatus } from '../../core';
import messages from './messages';

export const COST_OBJECT_TYPES: readonly CostObjectType[] = [
  'cost-center',
  'project',
  'site',
];
export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'planned',
  'active',
  'closed',
];

export function useCostObjectLabels() {
  const intl = useIntl();
  const types: Record<CostObjectType, string> = {
    'cost-center': intl.formatMessage(messages.typeCostCenter),
    project: intl.formatMessage(messages.typeProject),
    site: intl.formatMessage(messages.typeSite),
  };
  const statuses: Record<ProjectStatus, string> = {
    planned: intl.formatMessage(messages.statusPlanned),
    active: intl.formatMessage(messages.statusActive),
    closed: intl.formatMessage(messages.statusClosed),
  };
  return { types, statuses };
}
