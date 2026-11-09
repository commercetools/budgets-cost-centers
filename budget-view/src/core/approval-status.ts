// Approval status on the order, from Approval Flow Messages. [BCC-APPR-5]
// https://docs.commercetools.com/api/projects/messages/approval-rule-approval-flow-messages
import { isRecord } from './check';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ApprovalMessage =
  | { type: 'ApprovalFlowCreated'; orderId: string }
  | { type: 'ApprovalFlowCompleted'; orderId: string; status: 'Approved' | 'Rejected' }
  | { type: 'other' };

const idOf = (ref: unknown): string | undefined => (isRecord(ref) && typeof ref.id === 'string' ? ref.id : undefined);

export function toApprovalMessage(message: unknown): ApprovalMessage {
  if (!isRecord(message)) return { type: 'other' };
  if (message.type === 'ApprovalFlowCreated') {
    const orderId = isRecord(message.approvalFlow) ? idOf(message.approvalFlow.order) : undefined;
    return orderId ? { type: 'ApprovalFlowCreated', orderId } : { type: 'other' };
  }
  if (message.type === 'ApprovalFlowCompleted') {
    const orderId = idOf(message.order);
    const status = message.status;
    if (orderId && (status === 'Approved' || status === 'Rejected')) return { type: 'ApprovalFlowCompleted', orderId, status };
  }
  return { type: 'other' };
}

// Returns the status to write, or undefined to write nothing. A final status is never replaced by `pending`, so the
// order in which Messages arrive does not matter.
export function nextApprovalStatus(current: ApprovalStatus | undefined, message: ApprovalMessage): ApprovalStatus | undefined {
  let next: ApprovalStatus | undefined;
  if (message.type === 'ApprovalFlowCreated') next = current === undefined ? 'pending' : undefined;
  else if (message.type === 'ApprovalFlowCompleted') next = message.status === 'Approved' ? 'approved' : 'rejected';
  return next === current ? undefined : next;
}
