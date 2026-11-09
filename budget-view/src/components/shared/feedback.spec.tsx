// Validation errors name the field by its translated label and frame core texts in a message. [BCC-VIEW-10]
import React from 'react';
import {
  renderCustomView,
  screen,
} from '@commercetools-frontend/application-shell/test-utils';
import { PanelProviders } from '../budget-panel/budget-panel';
import { PROJECT } from '../../test-utils/platform-mock';
import modelMessages from '../../model/messages';
import { FieldErrors } from './feedback';

describe('FieldErrors', () => {
  it('finding 7: shows translated field labels and translates descriptors, keeping core texts as received', () => {
    renderCustomView({
      locale: 'en',
      projectKey: PROJECT,
      children: (
        <PanelProviders>
          <FieldErrors
            errors={[
              { field: 'period.from', message: 'Must be a date.' },
              {
                field: 'warnAtPercent',
                message: 'Warning threshold must be 0 to 100.',
              },
              { field: 'requesters', message: modelMessages.requesterMissing },
              { field: 'somethingNew', message: 'Odd.' },
            ]}
          />
        </PanelProviders>
      ),
    });
    expect(screen.getByText('From: Must be a date.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Warning threshold (%): Warning threshold must be 0 to 100.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Requester roles: Pick at least one requester role.')
    ).toBeInTheDocument();
    expect(screen.getByText('Input: Odd.')).toBeInTheDocument();
    expect(screen.queryByText(/period\.from/)).not.toBeInTheDocument();
  });
});
