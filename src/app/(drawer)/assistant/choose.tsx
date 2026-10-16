import { useLocalSearchParams } from 'expo-router';

import { AssistantChooser } from '@/components/assistant-switcher';

/**
 * The Assistant picker, presented as a native form sheet (see the layout): it drags, snaps and
 * dismisses like any system sheet. `agentic=1` also lists Agentic Assistants, as the Assistant
 * header asks for. History does not.
 */
export default function ChooseAssistantSheet() {
  const { agentic } = useLocalSearchParams<{ agentic?: string }>();
  return <AssistantChooser includeAgentic={agentic === '1'} />;
}
