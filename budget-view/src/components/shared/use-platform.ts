// The dispatch and project key every write needs. [BCC-VIEW-8]
import { useAsyncDispatch } from '@commercetools-frontend/sdk';
import { type Dispatch, useProjectKey } from '../../data/client';

export const usePlatform = () => ({
  dispatch: useAsyncDispatch() as unknown as Dispatch,
  projectKey: useProjectKey() ?? '',
});
