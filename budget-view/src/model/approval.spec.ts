// Approval Rule check and setup: budget rules, missing requesters, coverage record, staleness, rule draft, the
// associates the view may act for. [BCC-APPR-3] [BCC-APPR-4] [BCC-APPR-2] [BCC-APPR-1]
import { DEFAULT_SETTINGS, type Settings } from '../core';
import {
  BUDGET_PREDICATE,
  budgetRules,
  countsAsCoverage,
  coverageFrom,
  coverageStatus,
  missingRequesters,
  orderingRoles,
  peopleWith,
  type RuleLike,
  ruleDraft,
  ruleSummary,
  rolesInUse,
  settingsWithCoverage,
} from './approval';

const role = (key: string, permissions: string[]) => ({
  key,
  name: key,
  permissions,
});
const roles = [
  role('buyer', ['CreateMyCarts', 'CreateMyOrdersFromMyCarts']),
  role('site-buyer', ['CreateOrdersFromOthersCarts']),
  role('viewer', ['ViewMyOrders']),
  role('admin', ['CreateApprovalRules', 'UpdateApprovalRules']),
  role('rule-maker', ['CreateApprovalRules']),
];

const rule = (over: Partial<RuleLike> = {}): RuleLike => ({
  id: 'r-1',
  key: 'bcc-budget-unit-a',
  version: 1,
  name: 'Budget approval',
  status: 'Active',
  predicate: 'custom.bccBudgetExceeded = true',
  requesters: [{ associateRole: { key: 'buyer' } }],
  approvers: {
    tiers: [{ and: [{ or: [{ associateRole: { key: 'approver' } }] }] }],
  },
  lastModifiedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('budgetRules', () => {
  it('keeps active rules whose predicate mentions bccBudgetExceeded', () => {
    const rules = [
      rule(),
      rule({
        id: 'r-2',
        predicate: 'custom.bccBudgetExceeded=true and totalPrice > "100 EUR"',
      }),
      rule({ id: 'r-3', status: 'Inactive' }),
      rule({ id: 'r-4', predicate: 'totalPrice > "100 EUR"' }),
      rule({ id: 'r-5', predicate: 'custom.bccBudgetExceeded = false' }),
    ];
    expect(budgetRules(rules).map((r) => r.id)).toEqual(['r-1', 'r-2', 'r-5']);
  });
});

describe('missingRequesters', () => {
  it('warns about roles that may create orders and are no requester of a budget rule', () => {
    const ordering = orderingRoles(roles, ['buyer', 'site-buyer', 'viewer']);
    expect(ordering).toEqual(['buyer', 'site-buyer']);
    expect(missingRequesters(ordering, [rule()])).toEqual(['site-buyer']);
    expect(missingRequesters(ordering, [rule({ status: 'Inactive' })])).toEqual(
      ['buyer', 'site-buyer']
    );
  });

  it('considers every role when none is given as in use', () => {
    expect(orderingRoles(roles)).toEqual(['buyer', 'site-buyer']);
  });
});

describe('coverageFrom', () => {
  it('records rule key, requester roles and the check time', () => {
    expect(
      coverageFrom(
        [
          rule({
            requesters: [
              { associateRole: { key: 'site-buyer' } },
              { associateRole: { key: 'buyer' } },
            ],
          }),
          rule({ id: 'r-9', key: undefined, status: 'Inactive' }),
        ],
        '2026-11-02T10:00:00.000Z'
      )
    ).toEqual({
      ruleKey: 'bcc-budget-unit-a',
      ruleId: 'r-1',
      requesterRoles: ['buyer', 'site-buyer'],
      checkedAt: '2026-11-02T10:00:00.000Z',
    });
  });

  it('records no rule when there is no active budget rule', () => {
    expect(coverageFrom([], '2026-11-02T10:00:00.000Z')).toEqual({
      requesterRoles: [],
      checkedAt: '2026-11-02T10:00:00.000Z',
    });
  });
});

describe('coverageStatus (Review Focus 2)', () => {
  const approval = {
    ruleKey: 'bcc-budget-unit-a',
    requesterRoles: ['buyer'],
    checkedAt: '2026-10-15T00:00:00.000Z',
  };

  it('is current when the rule is unchanged since the check', () => {
    expect(coverageStatus(approval, [rule()])).toEqual({
      stale: false,
      reasons: [],
    });
  });

  it('is stale when never checked', () => {
    expect(coverageStatus({ requesterRoles: [] }, [])).toEqual({
      stale: true,
      reasons: ['never-checked'],
    });
  });

  it('detects a rule deactivated after the check', () => {
    const r = rule({
      status: 'Inactive',
      lastModifiedAt: '2026-10-20T00:00:00.000Z',
    });
    expect(coverageStatus(approval, [r]).reasons).toEqual([
      'rule-inactive',
      'rule-changed',
      'requesters-changed',
    ]);
  });

  it('detects a rule that is gone', () => {
    expect(coverageStatus(approval, []).reasons).toEqual([
      'rule-missing',
      'requesters-changed',
    ]);
  });

  it('detects a rule changed after the check', () => {
    const r = rule({
      lastModifiedAt: '2026-10-16T00:00:00.000Z',
      requesters: [
        { associateRole: { key: 'buyer' } },
        { associateRole: { key: 'site-buyer' } },
      ],
    });
    expect(coverageStatus(approval, [r]).reasons).toEqual([
      'rule-changed',
      'requesters-changed',
    ]);
  });

  it('is stale when a budget rule exists that the record does not name', () => {
    expect(
      coverageStatus(
        { requesterRoles: [], checkedAt: '2026-10-15T00:00:00.000Z' },
        [rule()]
      ).reasons
    ).toEqual(['requesters-changed']);
  });
});

describe('peopleWith', () => {
  const people = [
    { customerId: 'c-1', label: 'Ada (fictional)', roles: ['buyer'] },
    { customerId: 'c-2', label: 'Bo (fictional)', roles: ['admin'] },
    {
      customerId: 'c-3',
      label: 'Cy (fictional)',
      roles: ['rule-maker', 'buyer'],
    },
  ];
  it('offers only associates holding the permission', () => {
    expect(
      peopleWith('CreateApprovalRules', people, roles).map((p) => p.customerId)
    ).toEqual(['c-2', 'c-3']);
    expect(
      peopleWith('UpdateApprovalRules', people, roles).map((p) => p.customerId)
    ).toEqual(['c-2']);
  });
});

describe('ruleDraft', () => {
  it('builds an active rule on custom.bccBudgetExceeded = true with requesters and approver tiers', () => {
    expect(BUDGET_PREDICATE).toBe('custom.bccBudgetExceeded = true');
    expect(
      ruleDraft('unit-a', {
        requesterRoles: ['buyer'],
        approverTiers: [['approver', 'deputy'], ['ceo']],
      })
    ).toEqual({
      ok: true,
      value: {
        key: 'bcc-budget-unit-a',
        name: 'Budget approval (Budgets & Cost Centers)',
        status: 'Active',
        predicate: 'custom.bccBudgetExceeded = true',
        requesters: [
          { associateRole: { typeId: 'associate-role', key: 'buyer' } },
        ],
        approvers: {
          tiers: [
            {
              and: [
                {
                  or: [
                    {
                      associateRole: {
                        typeId: 'associate-role',
                        key: 'approver',
                      },
                    },
                    {
                      associateRole: {
                        typeId: 'associate-role',
                        key: 'deputy',
                      },
                    },
                  ],
                },
              ],
            },
            {
              and: [
                {
                  or: [
                    { associateRole: { typeId: 'associate-role', key: 'ceo' } },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
  });

  it('needs a requester and one to five non-empty tiers', () => {
    expect(
      ruleDraft('unit-a', { requesterRoles: [], approverTiers: [['a']] })
    ).toEqual({
      ok: false,
      errors: [expect.objectContaining({ field: 'requesters' })],
    });
    expect(
      ruleDraft('unit-a', { requesterRoles: ['b'], approverTiers: [[], ['a']] })
    ).toEqual({
      ok: false,
      errors: [expect.objectContaining({ field: 'approvers' })],
    });
    expect(
      ruleDraft('unit-a', {
        requesterRoles: ['b'],
        approverTiers: [['a'], ['a'], ['a'], ['a'], ['a'], ['a']],
      }).ok
    ).toBe(false);
  });

  it('makes a unit key with other characters a valid rule key', () => {
    const r = ruleDraft('unit.a~x', {
      requesterRoles: ['b'],
      approverTiers: [['a']],
    });
    expect(r.ok && r.value.key).toBe('bcc-budget-unit-a-x');
  });
});

describe('settingsWithCoverage', () => {
  const coverage = {
    ruleKey: 'k',
    requesterRoles: ['buyer'],
    checkedAt: '2026-11-02T10:00:00.000Z',
  };
  const parent: Settings = {
    ...DEFAULT_SETTINGS,
    costObjectRequired: true,
    defaultMode: 'block',
  };

  it('writes the coverage into the full own record', () => {
    expect(
      settingsWithCoverage(
        { value: parent, version: 3, source: 'own' },
        coverage
      )
    ).toEqual({
      ...parent,
      approval: coverage,
    });
  });

  it('starts a division record from the inherited values', () => {
    expect(
      settingsWithCoverage(
        { value: parent, source: 'inherited', from: 'unit-a' },
        coverage
      )
    ).toEqual({
      ...parent,
      approval: coverage,
    });
  });
});

describe('ruleSummary and rolesInUse', () => {
  it('lists requester roles and the roles of each approver tier', () => {
    const r = rule({
      approvers: {
        tiers: [
          {
            and: [
              {
                or: [
                  { associateRole: { key: 'a' } },
                  { associateRole: { key: 'b' } },
                ],
              },
              { or: [{ associateRole: { key: 'c' } }] },
            ],
          },
          { and: [{ or: [{ associateRole: { key: 'd' } }] }] },
        ],
      },
    });
    expect(ruleSummary(r)).toEqual({
      ref: 'bcc-budget-unit-a',
      requesters: ['buyer'],
      tiers: [['a', 'b', 'c'], ['d']],
    });
  });

  it('collects the roles held in the unit', () => {
    expect(
      rolesInUse([
        { customerId: 'c', label: 'c', roles: ['b', 'a'] },
        { customerId: 'd', label: 'd', roles: ['a'] },
      ])
    ).toEqual(['a', 'b']);
  });
});

describe('review findings', () => {
  it('finding 1: dates the check no earlier than the newest rule change, so a just-created rule is current', () => {
    const created = rule({ lastModifiedAt: '2026-11-02T10:05:00.000Z' });
    const coverage = coverageFrom([created], '2026-11-02T10:00:00.000Z');
    expect(coverage.checkedAt).toBe('2026-11-02T10:05:00.000Z');
    expect(coverageStatus(coverage, [created])).toEqual({
      stale: false,
      reasons: [],
    });
    expect(coverageFrom([created], '2026-11-02T11:00:00.000Z').checkedAt).toBe(
      '2026-11-02T11:00:00.000Z'
    );
  });

  it('finding 3: only an exact budget predicate counts as coverage [BCC-APPR-1]', () => {
    const conditional = rule({
      id: 'r-2',
      key: 'conditional',
      predicate:
        'custom.bccBudgetExceeded = true and totalPrice.centAmount > 1000000',
      requesters: [{ associateRole: { key: 'site-buyer' } }],
    });
    expect(countsAsCoverage(conditional)).toBe(false);
    expect(
      countsAsCoverage(rule({ predicate: '(custom.bccBudgetExceeded=true)' }))
    ).toBe(true);
    expect(countsAsCoverage(rule({ status: 'Inactive' }))).toBe(false);
    // The conditional rule is listed, but its requesters are not covered.
    expect(budgetRules([conditional]).map((r) => r.id)).toEqual(['r-2']);
    expect(coverageFrom([conditional], '2026-11-02T10:00:00.000Z')).toEqual({
      requesterRoles: [],
      checkedAt: '2026-11-02T10:00:00.000Z',
    });
    expect(missingRequesters(['buyer', 'site-buyer'], [conditional])).toEqual([
      'buyer',
      'site-buyer',
    ]);
    expect(
      coverageFrom([conditional, rule()], '2026-11-02T10:00:00.000Z')
    ).toEqual({
      ruleKey: 'bcc-budget-unit-a',
      ruleId: 'r-1',
      requesterRoles: ['buyer'],
      checkedAt: '2026-11-02T10:00:00.000Z',
    });
    // A recorded rule whose predicate gained a condition no longer covers.
    expect(
      coverageStatus(
        {
          ruleKey: 'bcc-budget-unit-a',
          ruleId: 'r-1',
          requesterRoles: ['buyer'],
          checkedAt: '2026-10-15T00:00:00.000Z',
        },
        [
          rule({
            predicate: 'custom.bccBudgetExceeded = true and lineItemCount > 1',
          }),
        ]
      ).reasons
    ).toEqual(['rule-not-exact', 'requesters-changed']);
  });

  it('finding 3: finds the recorded rule by its id when its key changed', () => {
    expect(
      coverageStatus(
        {
          ruleKey: 'old-key',
          ruleId: 'r-1',
          requesterRoles: ['buyer'],
          checkedAt: '2026-10-15T00:00:00.000Z',
        },
        [rule({ key: 'new-key' })]
      )
    ).toEqual({ stale: false, reasons: [] });
  });

  it('finding 11: roles covered by the parent count in a division inheriting rules [BCC-APPR-2]', () => {
    expect(
      missingRequesters(['buyer', 'site-buyer'], [], ['site-buyer'])
    ).toEqual(['buyer']);
  });

  it('finding 7: rule draft errors are message descriptors, not English text', () => {
    const r = ruleDraft('unit-a', { requesterRoles: [], approverTiers: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    for (const e of r.errors)
      expect(e.message).toEqual(
        expect.objectContaining({ id: expect.any(String) })
      );
  });
});
