import type { Answer } from './answer';
import type { Feedback } from './feedback';

export type Interaction = {
  id: string;
  threadId: string;
  question: string;
  answer: Answer;
  createdAt: string;
  feedback?: Feedback;
};
