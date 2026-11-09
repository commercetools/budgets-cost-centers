// The manage permission decides whether edit and setup controls exist. [BCC-VIEW-9]
import React from 'react';
import {
  renderCustomView,
  screen,
} from '@commercetools-frontend/application-shell/test-utils';
import { useCanManage } from './use-can-manage';

const Probe = () => <span>{useCanManage() ? 'manage' : 'view-only'}</span>;

const render = (canManage: boolean) =>
  renderCustomView({
    locale: 'en',
    projectKey: 'demo',
    projectAllAppliedPermissions: [
      { name: 'canView', value: true },
      { name: 'canManage', value: canManage },
    ],
    children: <Probe />,
  });

describe('useCanManage', () => {
  it('is true with the manage permission', async () => {
    render(true);
    expect(await screen.findByText('manage')).toBeInTheDocument();
  });

  it('is false for a view-only user', async () => {
    render(false);
    expect(await screen.findByText('view-only')).toBeInTheDocument();
  });
});
