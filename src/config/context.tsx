import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { resolveCurrentTenantConfig, type TenantConfig } from '@/config';
import { loadManagedConfig } from '@/config/load-managed-config';
import { resolveTenant } from '@/config/resolver';

type TenantContextValue = {
  config: TenantConfig | null | undefined;
  managed: boolean;
  reloadConfig: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TenantConfig | null | undefined>();
  const [managed, setManaged] = useState(false);
  const reloadConfig = useCallback(async () => {
    setManaged(resolveTenant({ managed: await loadManagedConfig() }).kind === 'resolved');
    setConfig(await resolveCurrentTenantConfig());
  }, []);
  useEffect(() => {
    Promise.resolve().then(reloadConfig).catch(() => setConfig(null));
  }, [reloadConfig]);
  return (
    <TenantContext.Provider value={{ config, managed, reloadConfig }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantConfig(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenantConfig must be used within TenantConfigProvider');
  return context;
}
