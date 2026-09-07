import type { AnswersPort } from './port';

export function createAnswersPort(): AnswersPort {
  throw new Error('The Qlik adapter is native-only (ADR-0005). Web builds inject a fixture port.');
}
