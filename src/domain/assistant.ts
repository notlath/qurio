export type Assistant = {
  id: string;
  kind: 'classic' | 'agentic';
  name: string;
  description: string; // "" when the Assistant has none
};
