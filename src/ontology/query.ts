import type { OntologyEntity, OntologyIndex } from './types.ts';

import { extractLinkTargets, normalizeLinkTarget } from './links.ts';

interface QueryOptions {
  include: 'all' | 'incomplete' | 'locked';
}

interface ParsedTerm {
  key: string;
  negated: boolean;
  value: string;
}

function splitTerms(source: string): { options: QueryOptions; terms: ParsedTerm[] } {
  const options: QueryOptions = { include: 'locked' };
  const normalized = source
    .replace(/\r?\n/g, ' AND ')
    .replace(/\s+/g, ' ')
    .trim();
  const rawTerms = normalized.split(/\s+AND\s+/i).map((term) => term.trim()).filter(Boolean);
  const terms: ParsedTerm[] = [];

  for (const rawTerm of rawTerms) {
    const includeMatch = /^include:\s*(all|incomplete|locked)$/i.exec(rawTerm);
    const includeValue = includeMatch?.[1];
    if (includeValue) {
      options.include = includeValue.toLowerCase() as QueryOptions['include'];
      continue;
    }

    const negated = /^NOT\s+/i.test(rawTerm);
    const term = negated ? rawTerm.replace(/^NOT\s+/i, '') : rawTerm;
    const separator = term.indexOf(':');
    if (separator === -1) {
      continue;
    }
    terms.push({
      key: term.slice(0, separator).trim(),
      negated,
      value: term.slice(separator + 1).trim(),
    });
  }
  return { options, terms };
}

function entityTypeChain(index: OntologyIndex, entity: OntologyEntity): Set<string> {
  const chain = new Set<string>();
  for (const typeName of entity.instanceOf) {
    chain.add(typeName);
    for (const ancestor of index.ancestorsByType.get(typeName) ?? []) {
      chain.add(ancestor);
    }
  }
  return chain;
}

function matchesTerm(index: OntologyIndex, entity: OntologyEntity, term: ParsedTerm): boolean {
  const typeKeys = new Set(['type', 'instance_of']);
  if (typeKeys.has(term.key)) {
    const expected = normalizeLinkTarget(term.value);
    const matches = entityTypeChain(index, entity).has(expected);
    return term.negated ? !matches : matches;
  }

  const value = entity.frontmatter[term.key];
  if (/^EXISTS$/i.test(term.value)) {
    const matches = value !== undefined && value !== null && value !== '';
    return term.negated ? !matches : matches;
  }
  if (/^NOT EXISTS$/i.test(term.value)) {
    const matches = value === undefined || value === null || value === '';
    return term.negated ? !matches : matches;
  }

  const expected = normalizeLinkTarget(term.value);
  const linkMatches = extractLinkTargets(value).includes(expected);
  const scalarMatches = String(value ?? '') === term.value.replace(/^"|"$/g, '');
  const matches = linkMatches || scalarMatches;
  return term.negated ? !matches : matches;
}

export function runOntologyQuery(index: OntologyIndex, source: string): OntologyEntity[] {
  const { options, terms } = splitTerms(source);
  return [...index.entities.values()]
    .filter((entity) => {
      const lock = index.effectiveEntityLocks.get(entity.path)?.state ?? 'unlocked';
      if (options.include === 'locked' && lock !== 'locked') {
        return false;
      }
      if (options.include === 'incomplete' && lock === 'unlocked') {
        return false;
      }
      return terms.every((term) => matchesTerm(index, entity, term));
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
