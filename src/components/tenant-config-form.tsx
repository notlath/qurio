import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { PrimaryButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { loadDevConfig, normalizeTenantHost, resolveCurrentTenantConfig, saveDevConfig, validateTenantHost, type TenantConfig } from '@/config';
import { Radius, Shape, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReloadAnswersPort } from '@/qlik/context';

export function TenantConfigForm({ onSaved }: { onSaved: (active: TenantConfig | null) => void }) {
  const theme = useTheme();
  const reloadPort = useReloadAnswersPort();
  const [tenantHost, setTenantHost] = useState('');
  const [clientId, setClientId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [agenticAssistantId, setAgenticAssistantId] = useState('');
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    loadDevConfig().then((dev) => {
      setTenantHost(dev?.tenantHost ?? '');
      setClientId(dev?.clientId ?? '');
      setAssistantId(dev?.assistantId ?? '');
      setAgenticAssistantId(dev?.agenticAssistantId ?? '');
    });
  }, []);

  // Editing any field makes the "Saved" line stale.
  const edit = (set: (value: string) => void) => (value: string) => {
    setSaved(null);
    set(value);
  };

  async function handleSave() {
    setFieldError(null);
    setSaved(null);
    if (!tenantHost.trim() || !clientId.trim()) {
      setFieldError({ field: 'form', message: 'Tenant hostname and OAuth client ID are required.' });
      return;
    }
    setSaving(true);
    try {
      const host = normalizeTenantHost(tenantHost);
      const preflight = await validateTenantHost(host);
      if (!preflight.ok) {
        setFieldError({ field: preflight.field, message: preflight.message });
        return;
      }
      await saveDevConfig({
        tenantHost: host,
        clientId: clientId.trim(),
        assistantId: assistantId.trim() || undefined,
        // Optional: a blank field clears it, since a save replaces the whole dev entry.
        agenticAssistantId: agenticAssistantId.trim() || undefined,
      });
      const active = await resolveCurrentTenantConfig();
      onSaved(active);
      // Says what the Assistant tab will now do, which a bare "Saved" would not.
      setSaved(`Saved. Agentic Assistant: ${active?.agenticAssistantId ? 'on' : 'off'}.`);
      reloadPort(); // the port was built from the old config — without this the save needs an app restart
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, Shape.continuous, { borderColor: theme.borderStrong, color: theme.text, backgroundColor: theme.background }];

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="small">Tenant hostname</ThemedText>
        <TextInput
          style={inputStyle}
          placeholder="acme.eu.qlikcloud.com"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          value={tenantHost}
          onChangeText={edit(setTenantHost)}
        />
        {fieldError?.field === 'tenantHost' && (
          <ThemedText type="small" themeColor="danger" selectable>
            {fieldError.message}
          </ThemedText>
        )}
      </View>

      <View style={styles.field}>
        <ThemedText type="small">OAuth client id</ThemedText>
        <TextInput style={inputStyle} autoCapitalize="none" autoCorrect={false} value={clientId} onChangeText={edit(setClientId)} />
      </View>

      <View style={styles.field}>
        <ThemedText type="small">Assistant id</ThemedText>
        <TextInput
          style={inputStyle}
          autoCapitalize="none"
          autoCorrect={false}
          value={assistantId}
          onChangeText={edit(setAssistantId)}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="small">Agentic Assistant id (optional)</ThemedText>
        <TextInput
          style={inputStyle}
          autoCapitalize="none"
          autoCorrect={false}
          value={agenticAssistantId}
          onChangeText={edit(setAgenticAssistantId)}
        />
      </View>

      {fieldError?.field === 'form' && (
        <ThemedText type="small" themeColor="danger" selectable>
          {fieldError.message}
        </ThemedText>
      )}

      <PrimaryButton label="Validate & Save" busy={saving} onPress={handleSave} />
      {saved && (
        <ThemedText type="small" themeColor="primary" accessibilityLiveRegion="polite">
          {saved}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});

