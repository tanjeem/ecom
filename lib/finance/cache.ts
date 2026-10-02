// Server-side caches that depend on finance configuration. Cleared whenever
// settings, accounts or budgets change so the next summary is fresh.

type Clearable = { clear: () => void };
const registry: Clearable[] = [];

export const registerFinanceCache = (c: Clearable) => { registry.push(c); };
export const invalidateServerFinanceCaches = () => { for (const c of registry) c.clear(); };
