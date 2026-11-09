// Labels of scope kinds and period kinds, and money formatting. [BCC-VIEW-3] [BCC-VIEW-10] [BCC-BUDGET-1]
import { useIntl } from 'react-intl';
import { fractionDigits, type Money, type ScopeKind } from '../../core';
import type { PeriodKind } from '../../model/budgets';
import messages from './messages';

export function useBudgetLabels() {
  const intl = useIntl();
  const scopes: Record<ScopeKind, string> = {
    'cost-object': intl.formatMessage(messages.scopeCostObject),
    'business-unit': intl.formatMessage(messages.scopeBusinessUnit),
    role: intl.formatMessage(messages.scopeRole),
    associate: intl.formatMessage(messages.scopeAssociate),
  };
  const periods: Record<PeriodKind, string> = {
    month: intl.formatMessage(messages.periodMonth),
    quarter: intl.formatMessage(messages.periodQuarter),
    year: intl.formatMessage(messages.periodYear),
    range: intl.formatMessage(messages.periodRange),
  };
  // The amount is in the currency's minor unit [BCC-BUDGET-1]; core's fractionDigits gives its size.
  const money = (m: Money) => {
    const digits = fractionDigits(m.currencyCode);
    return intl.formatNumber(m.centAmount / 10 ** digits, {
      style: 'currency',
      currency: m.currencyCode,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };
  return { scopes, periods, money };
}
