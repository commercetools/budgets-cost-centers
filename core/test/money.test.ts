// [BCC-BUDGET-1] [BCC-SPEND-4]
import { formatMoney, fractionDigits } from '../src/money';

test.each([
  ['EUR', 2],
  ['JPY', 0],
  ['KWD', 3],
])('%s has %i fraction digits', (code, digits) => expect(fractionDigits(code)).toBe(digits));
test('an unknown code falls back to 2', () => expect(fractionDigits('XQQ')).toBe(2));
test('formats in the currency minor unit', () => {
  expect(formatMoney({ currencyCode: 'EUR', centAmount: 15050 })).toBe('150.50 EUR');
  expect(formatMoney({ currencyCode: 'JPY', centAmount: 100000 })).toBe('100000 JPY');
  expect(formatMoney({ currencyCode: 'EUR', centAmount: -15000 })).toBe('-150.00 EUR');
});
