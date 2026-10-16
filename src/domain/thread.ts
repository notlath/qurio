import type { Interaction } from './interaction';

export type Thread = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

const MAX_NAME_LENGTH = 60;

/**
 * The name of a new Thread: its first question with whitespace collapsed.
 * A long question is cut at the last word boundary before 60 characters and ends with an ellipsis.
 * A single word longer than that is cut at 60 characters.
 */
export function threadNameFor(question: string): string {
  const text = question.replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_NAME_LENGTH) return text;
  const space = text.lastIndexOf(' ', MAX_NAME_LENGTH);
  return `${text.slice(0, space > 0 ? space : MAX_NAME_LENGTH)}…`;
}

export type ThreadDetail = Thread & {
  interactions: Interaction[];
};
