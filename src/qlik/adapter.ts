import { fetch as streamingFetch } from 'expo/fetch';

import { getAccessToken } from '@/auth/access-token';
import type { TenantConfig } from '@/config';
import type { AppError, Interaction, Starter } from '@/domain';

import { classifyFetchFailure } from './classic/errors';
import { qlikFetch, qlikJson, qlikUrl, type HttpDeps, type HttpInit, type HttpResponse, type QlikList } from './classic/http';
import { toAnalyticsApp, toAnswer, toAssistant, toInteraction, toThread } from './classic/mappers';
import { consumeStream, type StreamReader } from './classic/stream-session';
import type { QlikAssistant, QlikInteraction, QlikItem, QlikSource, QlikThread } from './classic/wire-types';
import type { AnswersPort } from './port';

/** An `expo/fetch` response, whose `body` is a real ReadableStream on native. */
type QlikResponse = HttpResponse & {
  body?: { pipeThrough(transform: TextDecoderStream): { getReader(): StreamReader } } | null;
};

const ANALYTICS_APP_PAGE_SIZE = 50;

function defaultDeps(config: TenantConfig): HttpDeps<QlikResponse> {
  return {
    fetch: streamingFetch as unknown as HttpDeps<QlikResponse>['fetch'],
    getToken: () => getAccessToken(config),
  };
}

/**
 * The real Qlik transport, against the published classic Assistants REST API
 * (technical-proposal.md §2.1). Every Qlik wire shape stops here: nothing above
 * this file sees anything but domain types (ADR-0006).
 */
export function createAnswersPort(config: TenantConfig, deps: HttpDeps<QlikResponse> = defaultDeps(config)): AnswersPort {
  const json = <T,>(path: string, init?: HttpInit) =>
    qlikJson<T, QlikResponse>(deps, config, path, init);

  // Qlik sorts interactions newest-first (`-CREATED` is the ordering ticket 01 verified); the UI
  // reads a thread top to bottom, so the reversal happens once, here.
  async function listInteractions(threadId: string): Promise<Interaction[]> {
    const { data } = await json<QlikList<QlikInteraction>>(`/threads/${threadId}/interactions?sort=-CREATED`);
    return data.map(toInteraction).reverse();
  }

  /**
   * Neither `stream` nor `invoke` returns an interaction id, but feedback is addressed by one, so
   * it is recovered from the newest interaction on the thread (ticket-01 fixture 04). Matched on the
   * question text before being trusted: reconciling against someone else's concurrent interaction
   * would silently file this answer's feedback against theirs.
   */
  async function reconcileInteraction(threadId: string, prompt: string): Promise<QlikInteraction | null> {
    const { data } = await json<QlikList<QlikInteraction>>(`/threads/${threadId}/interactions?sort=-CREATED&limit=1`);
    const latest = data[0];
    return latest?.request === prompt ? latest : null;
  }

  return {
    capabilities: { streaming: true, analyticsInsights: false },

    async listThreads(opts) {
      const path =
        opts?.cursor ?? `/threads?sort=-UPDATED${opts?.limit === undefined ? '' : `&limit=${opts.limit}`}`;
      const { data, links } = await json<QlikList<QlikThread>>(path);
      return { items: data.map(toThread), next: links?.next?.href };
    },

    async createThread(name) {
      return toThread(await json<QlikThread>('/threads', { method: 'POST', body: { name } }));
    },

    async getThread(id) {
      const [thread, interactions] = await Promise.all([
        json<QlikThread>(`/threads/${id}`),
        listInteractions(id),
      ]);
      return { ...toThread(thread), interactions };
    },

    async deleteThread(id) {
      await qlikFetch(deps, config, `/threads/${id}`, { method: 'DELETE' });
    },

    async ask(threadId, prompt, handlers) {
      const local = (text: string): Interaction => ({
        id: `local-${Date.now()}`,
        threadId,
        question: prompt,
        answer: toAnswer(text, []),
        createdAt: new Date().toISOString(),
      });

      let response: QlikResponse;
      try {
        response = await qlikFetch(deps, config, `/threads/${threadId}/actions/stream`, {
          method: 'POST',
          body: { input: { prompt, promptType: 'thread', includeText: true } },
          signal: handlers.signal,
        });
      } catch (error) {
        // Stopped before a single byte arrived: an empty answer, not a failure to report.
        if (classifyFetchFailure(error) === null) return local('');
        throw error;
      }

      // A 200 with no readable body is not something this client can render as an answer.
      if (!response.body) throw { kind: 'ServiceUnavailable' } satisfies AppError;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      const { text, rawSources, stopped } = await consumeStream(reader, handlers);

      // After a Stop, what Qlik stored may be a longer answer than the user watched arrive —
      // reconciling would swap it in behind them, so the partial stands on its own (ticket 7).
      if (stopped) return { ...local(text), answer: toAnswer(text, rawSources as QlikSource[]) };

      const reconciled = await reconcileInteraction(threadId, prompt);
      return {
        ...(reconciled ? toInteraction(reconciled) : local(text)),
        answer: toAnswer(text, rawSources as QlikSource[]),
      };
    },

    listInteractions,

    async submitFeedback(threadId, interactionId, feedback) {
      await qlikFetch(deps, config, `/threads/${threadId}/interactions/${interactionId}/feedback`, {
        method: 'POST',
        body: feedback,
      });
    },

    async listAnalyticsApps(opts) {
      // Items is tenant-level, not part of the Assistant: `/api/` paths are rooted at the Tenant.
      // `name` is Items' case-insensitive name search. Later pages follow Qlik's own `next` href, which
      // is expected to keep it: not yet seen against a live Tenant, nor whether it matches part of a name.
      const path =
        opts?.cursor ??
        `/api/v1/items?resourceType=app&sort=-updatedAt&limit=${opts?.limit ?? ANALYTICS_APP_PAGE_SIZE}` +
          (opts?.name ? `&name=${encodeURIComponent(opts.name)}` : '');
      const { data, links } = await json<QlikList<QlikItem>>(path);
      return { items: data.map(toAnalyticsApp), next: links?.next?.href };
    },

    async thumbnailImage(appId) {
      // [POC] Endpoint from the published Apps API (qlik.dev/apis/rest/apps), not yet captured live.
      // Built through qlikUrl, so the bearer token can only ever be sent to the Tenant itself.
      const token = await deps.getToken();
      if (!token) return null;
      return {
        uri: qlikUrl(config, `/api/v1/apps/${encodeURIComponent(appId)}/media/thumbnail`),
        headers: { Authorization: `Bearer ${token}` },
      };
    },

    async listAssistants() {
      // Tenant-level, like Items. All pages at once: the choice needs the whole list, and a Tenant has few.
      const assistants: QlikAssistant[] = [];
      let path: string | undefined = '/api/v1/assistants?limit=100';
      while (path) {
        const { data, links }: QlikList<QlikAssistant> = await json<QlikList<QlikAssistant>>(path);
        assistants.push(...data);
        path = links?.next?.href;
      }
      return assistants.map(toAssistant);
    },

    async listStarters() {
      // [POC] Shape unverified — ticket 01 never captured a /starters response.
      const { data } = await json<QlikList<Starter>>('/starters');
      return data;
    },
  };
}
