import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchBrand, type Brand } from '@/brand/brand';

type BrandContextValue = { brand: Brand | null; showBrandFor: (tenantHost: string | null) => void };

// No provider (tests, isolated screens) means Qurio's Brand.
const BrandContext = createContext<BrandContextValue>({ brand: null, showBrandFor: () => {} });

/**
 * Loads the Brand of the configured Tenant. Before the configuration saves (first sign-in),
 * the hostname entry calls `showBrandFor`, so the sign-in screen carries the Brand colour too.
 */
export function BrandProvider({ configuredHost, children }: { configuredHost: string | null; children: ReactNode }) {
  const [enteredHost, showBrandFor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ tenantHost: string; brand: Brand | null } | null>(null);
  const tenantHost = configuredHost ?? enteredHost;

  useEffect(() => {
    if (!tenantHost) return;
    let current = true;
    void fetchBrand(tenantHost).then((brand) => {
      if (current) setLoaded({ tenantHost, brand });
    });
    return () => {
      current = false;
    };
  }, [tenantHost]);

  // A response for an earlier hostname never brands the current one.
  const brand = loaded && loaded.tenantHost === tenantHost ? loaded.brand : null;
  return <BrandContext.Provider value={{ brand, showBrandFor }}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  return useContext(BrandContext);
}
