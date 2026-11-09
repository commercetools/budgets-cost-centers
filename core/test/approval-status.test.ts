// [BCC-APPR-5]
import { nextApprovalStatus, toApprovalMessage } from '../src/approval-status';

const created = { type: 'ApprovalFlowCreated', approvalFlow: { order: { typeId: 'order', id: 'o-1' } } };
const completed = (status: string) => ({ type: 'ApprovalFlowCompleted', status, order: { typeId: 'order', id: 'o-1' } });

describe('toApprovalMessage', () => {
  test('created', () => expect(toApprovalMessage(created)).toEqual({ type: 'ApprovalFlowCreated', orderId: 'o-1' }));
  test('completed', () =>
    expect(toApprovalMessage(completed('Rejected'))).toEqual({ type: 'ApprovalFlowCompleted', orderId: 'o-1', status: 'Rejected' }));
  test('other message types', () => expect(toApprovalMessage({ type: 'ApprovalFlowApproved' })).toEqual({ type: 'other' }));
  test('malformed input does not throw', () => {
    expect(toApprovalMessage({ type: 'ApprovalFlowCreated' })).toEqual({ type: 'other' });
    expect(toApprovalMessage(completed('Pending'))).toEqual({ type: 'other' });
    expect(toApprovalMessage(null)).toEqual({ type: 'other' });
  });
});

describe('nextApprovalStatus', () => {
  const c = toApprovalMessage(created);
  test('created sets pending', () => expect(nextApprovalStatus(undefined, c)).toBe('pending'));
  test('rejected', () => expect(nextApprovalStatus('pending', toApprovalMessage(completed('Rejected')))).toBe('rejected'));
  test('approved', () => expect(nextApprovalStatus('pending', toApprovalMessage(completed('Approved')))).toBe('approved'));
  test('late created never replaces a final status', () => {
    expect(nextApprovalStatus('rejected', c)).toBeUndefined();
    expect(nextApprovalStatus('approved', c)).toBeUndefined();
  });
  test('duplicate delivery writes nothing', () => {
    expect(nextApprovalStatus('rejected', toApprovalMessage(completed('Rejected')))).toBeUndefined();
    expect(nextApprovalStatus('pending', c)).toBeUndefined();
  });
  test('other messages write nothing', () => expect(nextApprovalStatus(undefined, { type: 'other' })).toBeUndefined());
});
