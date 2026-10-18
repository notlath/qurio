import { ScrollView } from 'react-native';

import { useQlikAuth } from '@/auth/session';
import { HostnameEntry } from '@/components/tenant-entry';
import { type TenantConfig } from '@/config';
import { ContentColumn, Spacing } from '@/constants/theme';
import { useTenantConfig } from '@/config/context';

// A pushed screen, so the header Back button, the iOS swipe and the Android system Back all leave
// the current Tenant and session untouched. Connecting to another Tenant signs out of this one.
export default function ChangeTenantScreen() {
  const { config } = useTenantConfig();
  if (!config) return null;
  return <ChangeTenantForm config={config} />;
}

function ChangeTenantForm({ config }: { config: TenantConfig }) {
  const { signOut } = useQlikAuth(config);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[{ padding: Spacing.three }, ContentColumn]}
      keyboardShouldPersistTaps="handled">
      <HostnameEntry replacing={{ signOut }} />
    </ScrollView>
  );
}
