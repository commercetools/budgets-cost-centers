// Permission keys of the Custom View: View and Manage. [BCC-VIEW-9]
// https://docs.commercetools.com/merchant-center-customizations/development/permissions#define-constants
// The docs name resolveCustomViewResourceAccesses; version 27 exports computeCustomViewPermissionsKeys for this.
import { computeCustomViewPermissionsKeys } from '@commercetools-frontend/application-config/ssr';

export const PERMISSIONS = computeCustomViewPermissionsKeys();
