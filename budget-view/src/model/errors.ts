// Validation errors of the view. A message is either a descriptor from a message file or a text from core or the
// platform, which the view shows as received inside a message-file frame. [BCC-VIEW-10]
import type { MessageDescriptor } from 'react-intl';

export type ViewMessage = string | MessageDescriptor;

export type ViewFieldError = {
  field: string;
  message: ViewMessage;
  values?: Record<string, string | number>;
};
