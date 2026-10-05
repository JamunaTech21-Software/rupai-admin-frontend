import { useEffect, useState } from 'react';

import { fetchEnvironment } from './environment';

/** The non-production environment name, or null in production or while unknown. */
export function useEnvironment(): string | null {
  const [environment, setEnvironment] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchEnvironment(controller.signal)
      .then(setEnvironment)
      .catch(() => {
        // No backend reachable: show no banner rather than a wrong one.
      });
    return () => {
      controller.abort();
    };
  }, []);

  return environment;
}
