// Money in cent amounts. [BCC-BUDGET-1]
export type Money = { currencyCode: string; centAmount: number };

export const isMoney = (v: unknown): v is Money =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as Money).currencyCode === 'string' &&
  /^[A-Z]{3}$/.test((v as Money).currencyCode) &&
  Number.isSafeInteger((v as Money).centAmount);

// Fraction digits of a currency (ISO 4217, as the platform uses for cent amounts); 2 when unknown.
// https://docs.commercetools.com/api/types#money
export function fractionDigits(currencyCode: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatMoney(m: Money): string {
  const digits = fractionDigits(m.currencyCode);
  return `${(m.centAmount / 10 ** digits).toFixed(digits)} ${m.currencyCode}`;
}
