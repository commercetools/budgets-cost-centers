// Entry point: the Custom View shell with the app messages; the panel wraps itself in NimbusProvider. [BCC-VIEW-1]
// [BCC-VIEW-10]
import React, { lazy } from 'react';
import {
  CustomViewShell,
  setupGlobalErrorListener,
} from '@commercetools-frontend/application-shell';
import loadMessages from '../../load-messages';

const AsyncApplicationRoutes = lazy(
  () => import('../../routes' /* webpackChunkName: "routes" */)
);

// Set up the global error listener before any React component renders, to catch errors on mounting.
setupGlobalErrorListener();

const EntryPoint = () => (
  <CustomViewShell applicationMessages={loadMessages}>
    <AsyncApplicationRoutes />
  </CustomViewShell>
);
EntryPoint.displayName = 'EntryPoint';

export default EntryPoint;
