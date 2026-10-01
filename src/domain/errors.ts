export type AppError =
  | { kind: 'ConfigMissing' } // no MDM config — administrator action
  | { kind: 'NotEntitled' } // authenticated, no Answers entitlement
  | { kind: 'AssistantForbidden' } // entitled, but no access to this Assistant
  | { kind: 'AssistantNotFound' } // wrong assistantId — misconfiguration
  | { kind: 'AccessDenied' } // authenticated, but not permitted to list tenant resources such as Analytics Apps
  | { kind: 'SessionExpired' } // refresh failed → interactive re-auth
  | { kind: 'RateLimited'; retryAfterMs?: number }
  | { kind: 'ServiceUnavailable' }
  | { kind: 'Offline' };
