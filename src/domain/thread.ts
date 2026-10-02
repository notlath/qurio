import type { Interaction } from './interaction';

export type Thread = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ThreadDetail = Thread & {
  interactions: Interaction[];
};
