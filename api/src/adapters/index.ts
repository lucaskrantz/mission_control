import { ServiceAdapter } from './types';
import { minecraftAdapter } from './minecraft';

export const ADAPTERS: ServiceAdapter[] = [
  minecraftAdapter,
  // Add more adapters here as they are implemented
];

/**
 * Find the first matching adapter for a container
 */
export function findAdapter(containerInfo: any): ServiceAdapter | null {
  for (const adapter of ADAPTERS) {
    if (adapter.match(containerInfo)) {
      return adapter;
    }
  }
  return null;
}

/**
 * Enrich a container with service-specific data
 */
export async function enrichContainer(containerInfo: any): Promise<Record<string, unknown> | null> {
  const adapter = findAdapter(containerInfo);
  if (!adapter) {
    return null;
  }

  try {
    return await adapter.enrich(containerInfo);
  } catch (error) {
    console.error(`[Adapter ${adapter.id}] Error enriching container:`, error);
    return null;
  }
}
