import { Redirect } from 'expo-router';

import { useAgenticAvailability } from '@/qlik-embed/use-agentic-target';
import { QlikEmbedHost } from '@/qlik-embed/qlik-embed-host';

/**
 * The Agentic Assistant in the shared embedded host. Guarded on direct entry, not only by the
 * hidden link: with no `agenticAssistantId` (or on web) there is nothing to open, so it returns
 * to the classic Assistant, which stays the working surface until ticket 22 retires it.
 */
export default function AgenticAssistantScreen() {
  const availability = useAgenticAvailability();

  if (availability.status === 'loading') return null;
  if (availability.status === 'unavailable') return <Redirect href="/assistant" />;
  return (
    <QlikEmbedHost
      config={availability.config}
      surface={availability.target.surface}
      resourceId={availability.target.resourceId}
    />
  );
}
