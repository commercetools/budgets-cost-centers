// Interaction helpers for Nimbus inputs in component tests. [BCC-VIEW-10]
import {
  fireEvent,
  screen,
} from '@commercetools-frontend/application-shell/test-utils';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A Nimbus Select trigger is named "<selected value> <label>".
export async function pick(label: string, option: string) {
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`(^| )${escape(label)}$`) })
  );
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

export const type = (name: string | RegExp, value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name }), {
    target: { value },
  });
