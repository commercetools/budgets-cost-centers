// True when the user holds the manage permission of the Custom View; view-only users get no edit controls.
// [BCC-VIEW-9]
// https://docs.commercetools.com/merchant-center-customizations/development/permissions#in-components
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import { PERMISSIONS } from '../constants';

export const useCanManage = (): boolean =>
  useIsAuthorized({ demandedPermissions: [PERMISSIONS.Manage] });
