import type { AppError } from './errors';

export type ErrorMessage = { title: string; message: string; canRetry: boolean };

const CONTACT_ADMIN = 'Contact your IT administrator.';

export function errorMessageFor(error: AppError): ErrorMessage {
  switch (error.kind) {
    case 'ConfigMissing':
      return {
        title: 'Not set up yet',
        message: `This app has not been configured for your organization. ${CONTACT_ADMIN}`,
        canRetry: false,
      };
    case 'AssistantNotChosen':
      return {
        title: 'No Assistant chosen',
        message: 'Choose an Assistant before you ask a question.',
        canRetry: false,
      };
    case 'NotEntitled':
      return {
        title: 'No Answers access',
        message: `Your account does not have a Qlik Answers license. ${CONTACT_ADMIN}`,
        canRetry: false,
      };
    case 'AssistantForbidden':
      return {
        title: 'No access to this Assistant',
        message: `You don't have permission to use this Assistant. ${CONTACT_ADMIN}`,
        canRetry: false,
      };
    case 'AssistantNotFound':
      return {
        title: 'Assistant not found',
        message: `This app is misconfigured. ${CONTACT_ADMIN}`,
        canRetry: false,
      };
    case 'AccessDenied':
      return {
        title: 'No access',
        message: `Your account is not permitted to see Analytics Apps. ${CONTACT_ADMIN}`,
        canRetry: false,
      };
    case 'SessionExpired':
      return {
        title: 'Signed out',
        message: 'Your session expired. Sign in again to continue.',
        canRetry: true,
      };
    case 'RateLimited':
      return {
        title: 'Busy right now',
        message: 'Too many questions were asked recently. Try again in a moment.',
        canRetry: true,
      };
    case 'ServiceUnavailable':
      return {
        title: 'Temporarily unavailable',
        message: 'Qlik is temporarily unavailable. Try again shortly.',
        canRetry: true,
      };
    case 'Offline':
      return {
        title: "You're offline",
        message: 'Check your internet connection and try again.',
        canRetry: true,
      };
  }
}
