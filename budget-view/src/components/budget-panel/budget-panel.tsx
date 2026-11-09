// Panel frame: the Business Unit of the host page, its name and key, and the four sections. [BCC-VIEW-1] [BCC-VIEW-2]
// [BCC-VIEW-3] [BCC-VIEW-5] [BCC-VIEW-10] [BCC-APPR-3]
import React from 'react';
import type { ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { useCustomViewContext } from '@commercetools-frontend/application-shell-connectors';
import {
  Alert,
  Heading,
  LoadingSpinner,
  NimbusProvider,
  Stack,
  Tabs,
  Text,
} from '@commercetools/nimbus';
import {
  type BusinessUnitSummary,
  unitIdFromHostUrl,
  useBusinessUnit,
} from '../../data/units';
import Approval from '../approval/approval';
import Budgets from '../budgets/budgets';
import CostObjects from '../cost-objects/cost-objects';
import UnitSettings from '../settings/settings';
import { PanelDataProvider } from '../shared/panel-data';
import { OrdersReaderProvider } from '../../data/orders';
import messages from './messages';

const Sections = ({ unit }: { unit: BusinessUnitSummary }) => {
  const intl = useIntl();
  return (
    <PanelDataProvider unitKey={unit.key}>
      <Tabs.Root
        tabListAriaLabel={intl.formatMessage(messages.sections)}
        tabs={[
          {
            id: 'cost-objects',
            tabLabel: intl.formatMessage(messages.tabCostObjects),
            panelContent: <CostObjects unit={unit} />,
          },
          {
            id: 'budgets',
            tabLabel: intl.formatMessage(messages.tabBudgets),
            panelContent: <Budgets unit={unit} />,
          },
          {
            id: 'settings',
            tabLabel: intl.formatMessage(messages.tabSettings),
            panelContent: <UnitSettings unit={unit} />,
          },
          {
            id: 'approval',
            tabLabel: intl.formatMessage(messages.tabApproval),
            panelContent: <Approval unit={unit} />,
          },
        ]}
      />
    </PanelDataProvider>
  );
};

const PanelContent = () => {
  const intl = useIntl();
  const hostUrl = useCustomViewContext((context) => context.hostUrl);
  const unitId = unitIdFromHostUrl(hostUrl);
  const { unit, loading, error } = useBusinessUnit(unitId);

  if (!unitId) return <Text>{intl.formatMessage(messages.notAUnitPage)}</Text>;
  if (error) {
    return (
      <Alert.Root colorPalette="critical" variant="outlined">
        <Alert.Title>
          {intl.formatMessage(messages.loadFailedTitle)}
        </Alert.Title>
        <Alert.Description>
          {intl.formatMessage(messages.loadFailedDetail, {
            message: error.kind === 'request' ? error.message : '',
          })}
        </Alert.Description>
      </Alert.Root>
    );
  }
  if (loading || !unit)
    return <LoadingSpinner aria-label={intl.formatMessage(messages.loading)} />;

  return (
    <Stack direction="column" gap="400">
      <Stack direction="column" gap="100">
        <Heading as="h2">
          {intl.formatMessage(messages.title, { unitName: unit.name })}
        </Heading>
        <Text>
          {intl.formatMessage(messages.unitKey)}:{' '}
          <Text as="span" fontWeight="600">
            {unit.key}
          </Text>
        </Text>
      </Stack>
      <Sections unit={unit} />
    </Stack>
  );
};

// The Merchant Center loads the Inter font already, so Nimbus must not load it again.
export const PanelProviders = ({ children }: { children: ReactNode }) => {
  const locale = useCustomViewContext((context) => context.user?.locale);
  return (
    <NimbusProvider locale={locale} loadFonts={false}>
      <OrdersReaderProvider>{children}</OrdersReaderProvider>
    </NimbusProvider>
  );
};

const BudgetPanel = () => (
  <PanelProviders>
    <Stack direction="column" gap="400" padding="400">
      <PanelContent />
    </Stack>
  </PanelProviders>
);
BudgetPanel.displayName = 'BudgetPanel';

export default BudgetPanel;
