import type { AnalyticsApp, Answer, Assistant, Citation, Interaction, QlikUser, Thread } from '@/domain';
import type { QlikAssistant, QlikInteraction, QlikItem, QlikSource, QlikThread, QlikUserRecord } from './wire-types';

export function toQlikUser(wire: QlikUserRecord): QlikUser {
  return {
    id: wire.id,
    name: wire.name,
    email: wire.email || undefined,
    pictureUrl: wire.picture?.startsWith('https://') ? wire.picture : undefined,
  };
}

export function toAssistant(wire: QlikAssistant): Assistant {
  return { id: wire.id, name: wire.name, description: wire.description, kind: wire.appIds?.length ? 'agentic' : 'classic' };
}

export function toThread(wire: QlikThread): Thread {
  return { id: wire.id, name: wire.name, createdAt: wire.createdAt, updatedAt: wire.updatedAt };
}

export function toAnalyticsApp(wire: QlikItem): AnalyticsApp {
  return { id: wire.resourceId, name: wire.name, updatedAt: wire.updatedAt, hasThumbnail: !!wire.thumbnailId };
}

const FILE_NAME_PREFIX = /^File name: .*\n/;

/**
 * Some chunks carry a Qlik-injected "File name: {doc}\n" header, some don't
 * — inconsistent even within one answer (ticket-01 fixture 09). Never shown
 * to the user verbatim, so it's stripped here rather than in the UI.
 */
function stripFileNamePrefix(text: string): string {
  return text.replace(FILE_NAME_PREFIX, '');
}

export function toCitations(sources: QlikSource[]): Citation[] {
  return sources.map((source) => ({
    documentId: source.documentId,
    knowledgeBaseId: source.knowledgebaseId,
    documentPath: source.source,
    // A chunk without text contributes no excerpt rather than crashing the citation: the document
    // path is still worth showing, and one unhydrated chunk must not take down the whole thread view.
    excerpts: (source.chunks ?? []).flatMap((chunk) => (chunk.text ? [stripFileNamePrefix(chunk.text)] : [])),
  }));
}

export function toAnswer(output: string, sources: QlikSource[]): Answer {
  return {
    blocks: [{ kind: 'text', markdown: output }],
    citations: toCitations(sources),
  };
}

export function toInteraction(wire: QlikInteraction): Interaction {
  return {
    id: wire.id,
    threadId: wire.threadId,
    question: wire.request,
    createdAt: wire.createdAt,
    answer: toAnswer(wire.response, wire.sources),
  };
}
