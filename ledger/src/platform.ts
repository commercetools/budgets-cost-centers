// The platform calls the ledger needs, as a port so the handler is tested without a project. [BCC-APPR-5] [BCC-APPR-6] [BCC-APPR-7] [BCC-APPR-8]

export type CustomLike = { type: { id: string }; fields: Record<string, unknown> };
export type LedgerOrder = { id: string; version: number; custom?: CustomLike };

export type OrderAction =
  | { action: 'setCustomField'; name: string; value: unknown }
  | { action: 'setCustomType'; type: { typeId: 'type'; key: string }; fields: Record<string, unknown> };

// A failed platform call with its HTTP status; `status` is undefined for network failures.
export class PlatformError extends Error {
  constructor(
    readonly status: number | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

export type StoredSettings = { key: string; version: number; value: unknown };

export interface LedgerPlatform {
  // Settings records whose approval coverage names this rule. [BCC-APPR-8]
  findSettingsByRuleId(ruleId: string): Promise<StoredSettings[]>;
  saveSettings(key: string, value: unknown, version: number): Promise<void>;
  // The Message as stored by the Messages API; undefined when it is not stored (unknown, or querying disabled).
  getMessage(id: string): Promise<unknown | undefined>;
  // undefined when the order does not exist.
  getOrder(id: string): Promise<LedgerOrder | undefined>;
  updateOrder(id: string, version: number, actions: OrderAction[]): Promise<void>;
  // undefined when no type has this key.
  typeIdByKey(key: string): Promise<string | undefined>;
}

export const statusOf = (error: unknown): number | undefined => (error instanceof PlatformError ? error.status : undefined);
