// [BCC-COST-2] [BCC-BUDGET-1]
import { recordKey, parseRecordKey } from '../src/keys';

test('builds owner~code', () => {
  expect(recordKey('unit-a', 'PRJ-1001')).toEqual({ ok: true, value: 'unit-a~PRJ-1001' });
});

test('rejects a code with a space or a tilde', () => {
  expect(recordKey('unit-a', 'PRJ 1001')).toMatchObject({ ok: false, errors: [{ field: 'code' }] });
  expect(recordKey('unit-a', 'a~b')).toMatchObject({ ok: false, errors: [{ field: 'code' }] });
});

test('rejects a unit key with a character a Custom Object key forbids, naming the unit key', () => {
  const r = recordKey('unit@a', 'CC-1');
  expect(r).toMatchObject({ ok: false, errors: [{ field: 'ownerBusinessUnitKey' }] });
  expect(JSON.stringify(r)).toContain('unit@a');
});

test('rejects keys longer than 256 characters', () => {
  expect(recordKey('u'.repeat(200), 'c'.repeat(60))).toMatchObject({ ok: false });
});

test('parses at the last tilde', () => {
  expect(parseRecordKey('unit~a~CC-1')).toEqual({ ownerBusinessUnitKey: 'unit~a', code: 'CC-1' });
  expect(parseRecordKey('no-tilde')).toBeNull();
});
