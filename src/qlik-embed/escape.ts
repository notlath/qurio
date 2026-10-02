/**
 * A value interpolated into the generated page's JavaScript. JSON quoting handles strings; the
 * extra escapes stop `</script>`, HTML comments and the two line separators JSON leaves raw
 * from ending the script block early.
 */
export function jsLiteral(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** A value interpolated into an HTML attribute — returned already double-quoted. */
export function quotedAttr(value: string): string {
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `"${escaped}"`;
}
