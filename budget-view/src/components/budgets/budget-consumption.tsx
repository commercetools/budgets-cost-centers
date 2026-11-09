// Consumption of one budget: period in effect, consumed and remaining, a bar in the states ok, warn and exceeded,
// and a hint about orders in another currency. A role limit shows one bar per holder whose cart check applies it: an
// own associate limit replaces it. [BCC-VIEW-4] [BCC-SPEND-1] [BCC-BUDGET-8]
import React, { useMemo } from 'react';
import { useIntl } from 'react-intl';
import type { Budget, ScopeLevel } from '../../core';
import { Badge, ProgressBar, Stack, Text } from '@commercetools/nimbus';
import { useOrders } from '../../data/orders';
import {
  applicableHolders,
  budgetConsumption,
  consumptionWhere,
} from '../../model/consumption';
import { holdersOf, type Person } from '../../model/people';
import { Loading, ReadError } from '../shared/feedback';
import { useBudgetLabels } from './labels';
import messages from './messages';

const PALETTE: Record<ScopeLevel, string> = {
  ok: 'positive',
  warn: 'warning',
  exceeded: 'critical',
};

const BudgetConsumption = ({
  budgetKey,
  budget,
  people,
  budgets,
  at,
}: {
  budgetKey: string;
  budget: Budget;
  people: Person[];
  // All budgets of the owner unit, to see which associate limits replace a role limit.
  budgets: Array<{ key: string; value: Budget }>;
  at: string;
}) => {
  const intl = useIntl();
  const { money } = useBudgetLabels();
  const holders = useMemo(
    () => applicableHolders(budgetKey, budget, people, budgets, at),
    [budgetKey, budget, people, budgets, at]
  );
  const where = consumptionWhere(budget, at, holders);
  const { orders, loading, error } = useOrders(where);
  const levels: Record<ScopeLevel, string> = {
    ok: intl.formatMessage(messages.levelOk),
    warn: intl.formatMessage(messages.levelWarn),
    exceeded: intl.formatMessage(messages.levelExceeded),
  };
  if (loading) return <Loading />;
  if (error) return <ReadError error={error} />;
  const { interval, lines } = budgetConsumption(budget, orders, at, holders);
  if (!interval) return <Text>{intl.formatMessage(messages.notInEffect)}</Text>;
  const nameOf = (id?: string) =>
    people.find((p) => p.customerId === id)?.label ?? id;

  return (
    <Stack direction="column" gap="200">
      <Text>
        {intl.formatMessage(messages.inEffect, {
          from: interval.from.slice(0, 10),
          to: interval.to.slice(0, 10),
        })}
      </Text>
      {budget.scope.kind === 'role' && !lines.length ? (
        <Text>
          {intl.formatMessage(
            holdersOf(budget.scope.ref, people).length
              ? messages.allReplaced
              : messages.noHolders
          )}
        </Text>
      ) : null}
      {lines.map((l) => {
        const label = l.customerId
          ? intl.formatMessage(messages.barLabelFor, {
              who: nameOf(l.customerId),
            })
          : intl.formatMessage(messages.barLabel);
        const valueText = intl.formatNumber(l.percent / 100, {
          style: 'percent',
        });
        return (
          <Stack key={l.customerId ?? 'all'} direction="column" gap="100">
            {/* Label and value text are rendered here: Nimbus shows a bare "0" for value 0 (`value && valueText`). */}
            <Stack direction="row" justifyContent="space-between">
              <Text>{label}</Text>
              <Text>{valueText}</Text>
            </Stack>
            <ProgressBar
              aria-label={label}
              value={Math.min(l.percent, 100)}
              valueLabel={valueText}
              colorPalette={PALETTE[l.level]}
              data-level={l.level}
            />
            <Stack direction="row" gap="200" alignItems="center">
              <Badge size="xs" colorPalette={PALETTE[l.level]}>
                {levels[l.level]}
              </Badge>
              <Text>
                {intl.formatMessage(messages.consumed, {
                  consumed: money(l.consumed),
                  amount: money(l.amount),
                  remaining: money(l.remaining),
                  orders: l.orderCount,
                })}
              </Text>
            </Stack>
            {l.otherCurrencyOrders ? (
              <Text>
                {intl.formatMessage(messages.otherCurrency, {
                  count: l.otherCurrencyOrders,
                })}
              </Text>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
};

export default BudgetConsumption;
