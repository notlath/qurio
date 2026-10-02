/**
 * Qlik concatenates JSON objects with no delimiter (`}{`), so this splits on
 * brace depth while ignoring braces inside strings — splitting on `}{`
 * textually, as Qlik's own example does, corrupts an answer containing that
 * sequence. `rest` carries an in-progress object across calls, so a chunk
 * boundary splitting an object mid-way is handled by feeding accumulated
 * buffer back in on the next call (technical-proposal.md §6).
 */
export function takeObjects(buf: string): { objects: string[]; rest: string } {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < buf.length; i++) {
    const ch = buf[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        objects.push(buf.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return { objects, rest: start >= 0 ? buf.slice(start) : '' };
}
