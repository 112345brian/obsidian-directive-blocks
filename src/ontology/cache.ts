import type { App } from 'obsidian';

import type { OntologyIndex } from './types.ts';

function mapToObject<T>(map: Map<string, T>, mapper: (value: T) => unknown): Record<string, unknown> {
  return Object.fromEntries([...map.entries()].map(([key, value]) => [key, mapper(value)]));
}

export async function writeOntologyCache(app: App, cachePath: string, index: OntologyIndex): Promise<void> {
  const payload = {
    ancestorsByType: mapToObject(index.ancestorsByType, (value) => [...value]),
    cacheVersion: index.cacheVersion,
    effectiveEntityLocks: mapToObject(index.effectiveEntityLocks, (value) => value),
    effectiveTypeLocks: mapToObject(index.effectiveTypeLocks, (value) => value),
    entities: mapToObject(index.entities, (value) => value),
    generatedAt: index.generatedAt,
    issues: index.issues,
    settings: index.settings,
    types: mapToObject(index.types, (value) => ({
      ...value,
      canHave: Object.fromEntries(value.canHave),
      cannotHave: [...value.cannotHave],
      mustHave: Object.fromEntries(value.mustHave),
      relations: Object.fromEntries(value.relations),
    })),
  };

  const parent = cachePath.split('/').slice(0, -1).join('/');
  if (parent && !(await app.vault.adapter.exists(parent))) {
    await app.vault.adapter.mkdir(parent);
  }
  await app.vault.adapter.write(cachePath, JSON.stringify(payload, null, 2));
}
