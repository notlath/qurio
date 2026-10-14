import type { AppError } from '@/domain';

import type { AnswersPort } from '../port';
import {
  fixtureAnalyticsApps,
  fixtureAnswerFor,
  fixtureAssistants,
  fixtureInteractionsByThreadId,
  fixtureStarters,
  fixtureThreads,
} from './data';
import { paginate } from './pagination';

let nextThreadId = 1;
let nextInteractionId = 1;

const DEFAULT_PAGE_SIZE = 5;

// Fixture-only simulation trigger (ticket 11 — "evidence... by simulation" is explicitly allowed):
// asking "ERROR:<kind>" throws that AppError instead of answering. Never a real API behavior.
const ERROR_TRIGGER = /^ERROR:(\w+)$/;

function simulatedErrorFor(kind: string): AppError {
  if (kind === 'RateLimited') return { kind: 'RateLimited', retryAfterMs: 10_000 }; // shorter than the real 60s, for a demo
  return { kind } as AppError;
}

export function createFixtureAnswersPort(): AnswersPort {
  const threads = [...fixtureThreads];
  const interactionsByThreadId = { ...fixtureInteractionsByThreadId };

  return {
    capabilities: { streaming: false, analyticsInsights: false },

    async listThreads(opts) {
      return paginate(threads, { limit: opts?.limit ?? DEFAULT_PAGE_SIZE, cursor: opts?.cursor });
    },

    async createThread(name) {
      const now = new Date().toISOString();
      const thread = { id: `fixture-thread-${nextThreadId++}`, name, createdAt: now, updatedAt: now };
      threads.unshift(thread);
      interactionsByThreadId[thread.id] = [];
      return thread;
    },

    async getThread(id) {
      const thread = threads.find((t) => t.id === id);
      if (!thread) throw new Error(`Fixture thread not found: ${id}`);
      return { ...thread, interactions: interactionsByThreadId[id] ?? [] };
    },

    async deleteThread(id) {
      const index = threads.findIndex((t) => t.id === id);
      if (index === -1) throw new Error(`Fixture thread not found: ${id}`);
      threads.splice(index, 1);
      delete interactionsByThreadId[id];
    },

    async ask(threadId, prompt, handlers) {
      if (!interactionsByThreadId[threadId]) throw new Error(`Fixture thread not found: ${threadId}`);
      await new Promise((resolve) => setTimeout(resolve, 300)); // simulated latency, so the loading state is real to see

      const errorTrigger = prompt.match(ERROR_TRIGGER);
      if (errorTrigger) throw simulatedErrorFor(errorTrigger[1]);

      const answer = fixtureAnswerFor(prompt);
      const fullText = answer.blocks.map((b) => b.markdown).join('');
      const words = fullText.split(' ');
      let deliveredText = '';

      for (let i = 0; i < words.length; i++) {
        if (handlers.signal?.aborted) break;
        const delta = i === 0 ? words[i] : ` ${words[i]}`;
        deliveredText += delta;
        handlers.onDelta(delta);
        // simulated per-token arrival, same shape ticket 1 observed (small multi-word fragments)
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      const stopped = deliveredText !== fullText;
      const interaction = {
        id: `fixture-interaction-${nextInteractionId++}`,
        threadId,
        question: prompt,
        answer: stopped
          ? { blocks: [{ kind: 'text' as const, markdown: deliveredText }], citations: [] }
          : answer,
        createdAt: new Date().toISOString(),
      };
      interactionsByThreadId[threadId] = [...interactionsByThreadId[threadId], interaction];
      return interaction;
    },

    async listInteractions(threadId) {
      return interactionsByThreadId[threadId] ?? [];
    },

    async submitFeedback(threadId, interactionId, feedback) {
      const list = interactionsByThreadId[threadId] ?? [];
      const interaction = list.find((i) => i.id === interactionId);
      if (!interaction) throw new Error(`Fixture interaction not found: ${interactionId}`);
      await new Promise((resolve) => setTimeout(resolve, 300)); // simulated latency
      // Fixture-only sentinel so the "failed submission" UI path is demoable and verifiable
      // without a live tenant — never a real API behavior.
      if (feedback.comment === 'FAIL') throw new Error('Simulated feedback submission failure.');
      interaction.feedback = feedback;
    },

    async listStarters() {
      return fixtureStarters;
    },

    async listAssistants() {
      return fixtureAssistants;
    },

    async listAnalyticsApps(opts) {
      const name = opts?.name?.toLowerCase();
      const apps = name ? fixtureAnalyticsApps.filter((app) => app.name.toLowerCase().includes(name)) : fixtureAnalyticsApps;
      return paginate(apps, { limit: opts?.limit ?? DEFAULT_PAGE_SIZE, cursor: opts?.cursor });
    },

    async thumbnailImage() {
      return null; // fixture apps have no thumbnails, so the generated cover is what renders
    },
  };
}
