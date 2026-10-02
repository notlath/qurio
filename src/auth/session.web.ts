export function useQlikAuth(): never {
  throw new Error('Qlik authentication is native-only (ADR-0005). It is never reachable from web.');
}
