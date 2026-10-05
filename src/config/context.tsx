import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { resolveCurrentTenantConfig, saveDevConfig, type TenantConfig } from '@/config';
import { loadManagedConfig } from '@/config/load-managed-config';
import { resolveTenant } from '@/config/resolver';

const TenantContext = createContext<{
  config: TenantConfig | null | undefined;
  managed: boolean;
  reloadConfig: () => Promise<void>;
  clearConfig: () => Promise<void>;
} | null>(null);

export function TenantConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TenantConfig | null | undefined>();
  const [managed, setManaged] = useState(false);
  const reloadConfig = useCallback(async () => {
    setManaged(resolveTenant({ managed: await loadManagedConfig() }).kind === 'resolved');
    setConfig(await resolveCurrentTenantConfig());
  }, []);
  const clearConfig = useCallback(async () => {
    if (resolveTenant({ managed: await loadManagedConfig() }).kind === 'resolved') return;
    await saveDevConfig({});
    setConfig(null);
  }, []);
  useEffect(() => { Promise.resolve().then(reloadConfig).catch(() => setConfig(null)); }, [reloadConfig]);
  return <TenantContext.Provider value={{ config, managed, reloadConfig, clearConfig }}>{children}</TenantContext.Provider>;
}

export function useTenantConfig() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenantConfig must be used within TenantConfigProvider');
  return context;
}
