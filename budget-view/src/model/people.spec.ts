// Associates of a unit with their roles, for buyers, limits and the approval setup. [BCC-VIEW-2] [BCC-VIEW-3]
// [BCC-BUDGET-8] [BCC-APPR-4]
import { holdersOf, peopleOf } from './people';

const unit = {
  associates: [
    {
      customer: { typeId: 'customer', id: 'c-2' },
      associateRoleAssignments: [
        {
          associateRole: { typeId: 'associate-role', key: 'buyer' },
          inheritance: 'Enabled',
        },
      ],
    },
  ],
  inheritedAssociates: [
    {
      customer: { typeId: 'customer', id: 'c-1' },
      associateRoleAssignments: [
        {
          associateRole: { typeId: 'associate-role', key: 'admin' },
          source: { typeId: 'business-unit', key: 'unit-a' },
        },
      ],
    },
    {
      customer: { typeId: 'customer', id: 'c-2' },
      associateRoleAssignments: [
        {
          associateRole: { typeId: 'associate-role', key: 'approver' },
          source: { typeId: 'business-unit', key: 'unit-a' },
        },
      ],
    },
  ],
};

const customers = [
  { id: 'c-1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lane' },
  { id: 'c-2', email: 'bo@example.com' },
];

describe('peopleOf', () => {
  it('merges own and inherited assignments per customer, labelled by name and email', () => {
    expect(peopleOf(unit, customers)).toEqual([
      {
        customerId: 'c-1',
        label: 'Ada Lane (ada@example.com)',
        roles: ['admin'],
      },
      {
        customerId: 'c-2',
        label: 'bo@example.com',
        roles: ['approver', 'buyer'],
      },
    ]);
  });

  it('falls back to the customer ID when the customer is not readable', () => {
    expect(peopleOf(unit, [])[0]?.label).toBe('c-1');
  });
});

describe('holdersOf', () => {
  it('lists the customers holding a role', () => {
    expect(holdersOf('buyer', peopleOf(unit, customers))).toEqual(['c-2']);
  });
});
