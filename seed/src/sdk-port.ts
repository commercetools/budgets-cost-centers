// SeedPort on the commercetools SDK. Approval Rules exist only in a Business Unit, reached as an associate:
// https://docs.commercetools.com/api/projects/approval-rules [BCC-SEED-2] [BCC-SEED-3]
import type {
  ApprovalRuleDraft,
  AssociateRoleDraft,
  BusinessUnitDraft,
  CartDraft,
  CustomerDraft,
  ShoppingListDraft,
} from '@commercetools/platform-sdk';
import type { ApiRoot } from 'budgets-cost-centers-shared';
import type { ResourceKind, SeedPort } from './apply';

const statusOf = (e: unknown): number | undefined => {
  const x = e as { statusCode?: number; status?: number; body?: { statusCode?: number } };
  return x?.statusCode ?? x?.status ?? x?.body?.statusCode;
};

// 404 means "absent"; anything else is a real failure the caller must see.
async function orUndefined<T>(call: () => Promise<{ body: T }>): Promise<T | undefined> {
  try {
    return (await call()).body;
  } catch (e) {
    if (statusOf(e) === 404) return undefined;
    throw e;
  }
}

const idOf = (body: { id: string } | undefined) => (body ? { id: body.id } : undefined);

export function sdkPort(apiRoot: ApiRoot): SeedPort {
  const byKey = (kind: ResourceKind, key: string) => {
    switch (kind) {
      case 'associate-role':
        return apiRoot.associateRoles().withKey({ key }).get().execute();
      case 'customer':
        return apiRoot.customers().withKey({ key }).get().execute();
      case 'business-unit':
        return apiRoot.businessUnits().withKey({ key }).get().execute();
      case 'cart':
        return apiRoot.carts().withKey({ key }).get().execute();
      case 'shopping-list':
        return apiRoot.shoppingLists().withKey({ key }).get().execute();
    }
  };
  const inUnit = (associateId: string, businessUnitKey: string) =>
    apiRoot.asAssociate().withAssociateIdValue({ associateId }).inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey });

  return {
    async typeExists(key) {
      return (await orUndefined(() => apiRoot.types().withKey({ key }).get().execute())) !== undefined;
    },
    async findByKey(kind, key) {
      return idOf(await orUndefined<{ id: string }>(() => byKey(kind, key)));
    },
    async create(kind, draft) {
      switch (kind) {
        case 'associate-role':
          return idOf((await apiRoot.associateRoles().post({ body: draft as AssociateRoleDraft }).execute()).body)!;
        case 'customer':
          // Creating a customer returns a sign-in result that wraps the customer.
          return idOf((await apiRoot.customers().post({ body: draft as CustomerDraft }).execute()).body.customer)!;
        case 'business-unit':
          return idOf((await apiRoot.businessUnits().post({ body: draft as BusinessUnitDraft }).execute()).body)!;
        case 'cart':
          return idOf((await apiRoot.carts().post({ body: draft as CartDraft }).execute()).body)!;
        case 'shopping-list':
          return idOf((await apiRoot.shoppingLists().post({ body: draft as ShoppingListDraft }).execute()).body)!;
      }
    },
    async getCustomObject(container, key) {
      const o = await orUndefined(() => apiRoot.customObjects().withContainerAndKey({ container, key }).get().execute());
      return o ? { value: o.value, version: o.version } : undefined;
    },
    async putCustomObject(container, key, value, version) {
      await apiRoot
        .customObjects()
        .post({ body: { container, key, value, ...(version !== undefined ? { version } : {}) } })
        .execute();
    },
    async findApprovalRule(associateId, businessUnitKey, key) {
      return idOf(await orUndefined(() => inUnit(associateId, businessUnitKey).approvalRules().withKey({ key }).get().execute()));
    },
    async createApprovalRule(associateId, businessUnitKey, draft) {
      const { body } = await inUnit(associateId, businessUnitKey)
        .approvalRules()
        .post({ body: draft as ApprovalRuleDraft })
        .execute();
      return { id: body.id };
    },
  };
}
