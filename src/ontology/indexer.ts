import type { App, TFile } from 'obsidian';

import type { EffectiveLockState, OntologyEntity, OntologyIndex, OntologyIssue, OntologyType, PropertyDefinition, RelationDefinition } from './types.ts';

import { extractLinkTargets, hasNegatedTarget } from './links.ts';
import { parseOntologyEntity, parseOntologyType } from './parser.ts';

export interface BuildIndexSettings {
  typeFolder: string;
}

function isTypeFile(file: TFile, typeFolder: string): boolean {
  return file.extension === 'md' && file.path.startsWith(`${typeFolder.replace(/\/$/, '')}/`);
}

function collectInheritedMap<T>(
  typeName: string,
  index: Pick<OntologyIndex, 'ancestorsByType' | 'types'>,
  selector: (type: OntologyType) => Map<string, T>
): Map<string, T> {
  const result = new Map<string, T>();
  const names = [...(index.ancestorsByType.get(typeName) ?? new Set<string>()), typeName];
  for (const name of names) {
    const type = index.types.get(name);
    if (!type) {
      continue;
    }
    for (const [key, value] of selector(type)) {
      result.set(key, value);
    }
  }
  return result;
}

function computeAncestors(types: Map<string, OntologyType>, issues: OntologyIssue[]): Map<string, Set<string>> {
  const ancestorsByType = new Map<string, Set<string>>();
  const visiting = new Set<string>();

  const visit = (name: string, stack: string[]): Set<string> => {
    if (ancestorsByType.has(name)) {
      return ancestorsByType.get(name)!;
    }
    const type = types.get(name);
    const ancestors = new Set<string>();
    if (!type) {
      return ancestors;
    }
    if (visiting.has(name)) {
      issues.push({
        file: type.path,
        message: `Circular inheritance detected: ${[...stack, name].join(' -> ')}`,
        severity: 'error',
      });
      return ancestors;
    }

    visiting.add(name);
    for (const parent of type.extends) {
      if (!types.has(parent)) {
        issues.push({
          file: type.path,
          message: `Unknown parent type ${parent}`,
          severity: 'error',
        });
        continue;
      }
      ancestors.add(parent);
      for (const ancestor of visit(parent, [...stack, name])) {
        ancestors.add(ancestor);
      }
    }
    visiting.delete(name);
    ancestorsByType.set(name, ancestors);
    return ancestors;
  };

  for (const name of types.keys()) {
    visit(name, []);
  }
  return ancestorsByType;
}

function computeTypeLock(name: string, types: Map<string, OntologyType>, ancestorsByType: Map<string, Set<string>>): EffectiveLockState {
  const type = types.get(name);
  if (!type?.lockIntent) {
    return { state: 'unlocked', reason: 'lock is not true' };
  }
  for (const ancestor of ancestorsByType.get(name) ?? []) {
    if (!types.get(ancestor)?.lockIntent) {
      return { state: 'incomplete', reason: `ancestor ${ancestor} is not locked` };
    }
  }
  return { state: 'locked' };
}

function entityTypeChain(entity: OntologyEntity, ancestorsByType: Map<string, Set<string>>): Set<string> {
  const chain = new Set<string>();
  for (const typeName of entity.instanceOf) {
    chain.add(typeName);
    for (const ancestor of ancestorsByType.get(typeName) ?? []) {
      chain.add(ancestor);
    }
  }
  return chain;
}

function computeEntityLock(entity: OntologyEntity, effectiveTypeLocks: Map<string, EffectiveLockState>): EffectiveLockState {
  if (!entity.lockIntent) {
    return { state: 'unlocked', reason: 'lock is not true' };
  }
  for (const typeName of entity.instanceOf) {
    const typeLock = effectiveTypeLocks.get(typeName);
    if (!typeLock || typeLock.state !== 'locked') {
      return { state: 'incomplete', reason: `type ${typeName} is not effectively locked` };
    }
  }
  return { state: 'locked' };
}

function hasValue(frontmatter: Record<string, unknown>, key: string): boolean {
  const value = frontmatter[key];
  if (value === undefined || value === null || value === '') {
    return false;
  }
  return !(Array.isArray(value) && value.length === 0);
}

function validateCardinality(
  file: string,
  property: string,
  definition: PropertyDefinition | RelationDefinition,
  value: unknown,
  issues: OntologyIssue[]
): void {
  if ((definition.cardinality === 'one' || definition.cardinality === 'one-to-one') && Array.isArray(value) && value.length > 1) {
    issues.push({
      file,
      message: `${property} allows one value but has ${value.length}`,
      property,
      severity: 'error',
    });
  }
}

function validateIndex(index: OntologyIndex): void {
  for (const entity of index.entities.values()) {
    const chain = entityTypeChain(entity, index.ancestorsByType);

    for (const typeName of entity.instanceOf) {
      const type = index.types.get(typeName);
      if (!type) {
        index.issues.push({ file: entity.path, message: `Unknown type ${typeName}`, severity: 'error' });
        continue;
      }
      if (type.abstract) {
        index.issues.push({ file: entity.path, message: `Cannot instantiate abstract type ${typeName}`, severity: 'error' });
      }
    }

    for (const typeName of chain) {
      const type = index.types.get(typeName);
      if (!type) {
        continue;
      }
      for (const disjoint of type.disjoint) {
        if (chain.has(disjoint)) {
          index.issues.push({
            file: entity.path,
            message: `Entity is both ${typeName} and disjoint type ${disjoint}`,
            severity: 'error',
          });
        }
      }
    }

    for (const typeName of entity.instanceOf) {
      for (const [property, definition] of collectInheritedMap(typeName, index, (type) => type.mustHave)) {
        if (!hasValue(entity.frontmatter, property)) {
          index.issues.push({
            file: entity.path,
            message: `Missing required property ${property}`,
            property,
            severity: 'error',
          });
        } else {
          validateCardinality(entity.path, property, definition, entity.frontmatter[property], index.issues);
        }
      }

      const cannotHave = new Set<string>();
      for (const ancestor of [...(index.ancestorsByType.get(typeName) ?? []), typeName]) {
        const type = index.types.get(ancestor);
        for (const property of type?.cannotHave ?? []) {
          cannotHave.add(property);
        }
      }
      for (const property of cannotHave) {
        if (hasValue(entity.frontmatter, property)) {
          index.issues.push({ file: entity.path, message: `Forbidden property ${property} is present`, property, severity: 'error' });
        }
      }

      for (const [property, relation] of collectInheritedMap(typeName, index, (type) => type.relations)) {
        validateRelation(index, entity, property, relation);
      }
    }
  }
}

function validateRelation(index: OntologyIndex, entity: OntologyEntity, property: string, relation: RelationDefinition): void {
  const value = entity.frontmatter[property];
  if (!hasValue(entity.frontmatter, property)) {
    return;
  }

  validateCardinality(entity.path, property, relation, value, index.issues);

  for (const targetName of extractLinkTargets(value)) {
    if (hasNegatedTarget(value, targetName)) {
      continue;
    }
    const target = index.entitiesByName.get(targetName);
    if (!target) {
      index.issues.push({ file: entity.path, message: `${property} points to unknown entity ${targetName}`, property, severity: 'warning', target: targetName });
      continue;
    }

    if (relation.range) {
      const targetChain = entityTypeChain(target, index.ancestorsByType);
      if (!targetChain.has(relation.range)) {
        index.issues.push({
          file: entity.path,
          message: `${property} target ${targetName} is not a ${relation.range}`,
          property,
          severity: 'error',
          target: targetName,
        });
      }
    }

    const inverseProperty = relation.symmetric ? property : relation.inverse;
    if (inverseProperty && !extractLinkTargets(target.frontmatter[inverseProperty]).includes(entity.name)) {
      index.issues.push({
        autofixable: true,
        file: entity.path,
        message: `${property} -> ${targetName} is missing inverse ${inverseProperty} on ${targetName}`,
        property,
        severity: 'warning',
        target: targetName,
      });
    }
  }
}

export async function buildOntologyIndex(app: App, settings: BuildIndexSettings): Promise<OntologyIndex> {
  const issues: OntologyIssue[] = [];
  const types = new Map<string, OntologyType>();
  const entities = new Map<string, OntologyEntity>();
  const entitiesByName = new Map<string, OntologyEntity>();

  for (const file of app.vault.getMarkdownFiles()) {
    if (isTypeFile(file, settings.typeFolder)) {
      const type = parseOntologyType(file.path, await app.vault.read(file));
      types.set(type.name, type);
      continue;
    }

    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    const entity = parseOntologyEntity(file.path, frontmatter ?? {});
    if (entity) {
      entities.set(entity.path, entity);
      entitiesByName.set(entity.name, entity);
    }
  }

  const ancestorsByType = computeAncestors(types, issues);
  const effectiveTypeLocks = new Map<string, EffectiveLockState>();
  for (const name of types.keys()) {
    effectiveTypeLocks.set(name, computeTypeLock(name, types, ancestorsByType));
  }

  const effectiveEntityLocks = new Map<string, EffectiveLockState>();
  for (const entity of entities.values()) {
    effectiveEntityLocks.set(entity.path, computeEntityLock(entity, effectiveTypeLocks));
  }

  const index: OntologyIndex = {
    ancestorsByType,
    cacheVersion: 1,
    effectiveEntityLocks,
    effectiveTypeLocks,
    entities,
    entitiesByName,
    generatedAt: new Date().toISOString(),
    issues,
    settings: { typeFolder: settings.typeFolder },
    types,
  };
  validateIndex(index);
  return index;
}

export function getInheritedMustHave(index: OntologyIndex, entity: OntologyEntity): Map<string, PropertyDefinition> {
  const result = new Map<string, PropertyDefinition>();
  for (const typeName of entity.instanceOf) {
    for (const [property, definition] of collectInheritedMap(typeName, index, (type) => type.mustHave)) {
      result.set(property, definition);
    }
  }
  return result;
}

export function getInheritedCanHave(index: OntologyIndex, entity: OntologyEntity): Map<string, PropertyDefinition> {
  const result = new Map<string, PropertyDefinition>();
  for (const typeName of entity.instanceOf) {
    for (const [property, definition] of collectInheritedMap(typeName, index, (type) => type.canHave)) {
      result.set(property, definition);
    }
  }
  return result;
}
