// [BCC-CART-8]
import { DeadlineError, withDeadline } from '../src/deadline';

test('resolves when the promise wins', async () => expect(await withDeadline(Promise.resolve(7), 50)).toBe(7));
test('rejects with DeadlineError when the promise hangs', async () => {
  const started = Date.now();
  await expect(withDeadline(new Promise(() => undefined), 30)).rejects.toBeInstanceOf(DeadlineError);
  expect(Date.now() - started).toBeLessThan(200);
});
test('passes the original rejection through', async () =>
  expect(withDeadline(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom'));
