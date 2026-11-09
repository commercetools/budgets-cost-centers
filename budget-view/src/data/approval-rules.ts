// Approval Rules of a unit. The API offers them only through as-associate endpoints, so every call acts for an
// associate of the unit that the user picked. [BCC-APPR-3] [BCC-APPR-4]
// https://docs.commercetools.com/api/projects/approval-rules
import type { RuleLike } from '../model/approval';
import { type Dispatch, getAllById, post } from './client';

const base = (projectKey: string, associateId: string, unitKey: string) =>
  `/${projectKey}/as-associate/${encodeURIComponent(
    associateId
  )}/in-business-unit/key=${encodeURIComponent(unitKey)}/approval-rules`;

export const fetchApprovalRules = (
  dispatch: Dispatch,
  projectKey: string,
  associateId: string,
  unitKey: string
): Promise<RuleLike[]> =>
  getAllById<RuleLike>(dispatch, base(projectKey, associateId, unitKey), []);

export const createApprovalRule = (
  dispatch: Dispatch,
  projectKey: string,
  associateId: string,
  unitKey: string,
  draft: unknown
): Promise<RuleLike> =>
  post<RuleLike>(dispatch, base(projectKey, associateId, unitKey), draft);
