import { describe, expect, it } from 'vitest';

import type { OntologyIndex } from './types.ts';

import { runOntologyQuery } from './query.ts';

function makeIndex(): OntologyIndex {
  return {
    ancestorsByType: new Map([
      ['Philosopher', new Set(['Person'])],
      ['Rationalist', new Set(['Philosopher', 'Person'])],
      ['Person', new Set()],
    ]),
    cacheVersion: 1,
    effectiveEntityLocks: new Map([
      ['Spinoza.md', { state: 'locked' }],
      ['Draft.md', { state: 'incomplete' }],
    ]),
    effectiveTypeLocks: new Map(),
    entities: new Map([
      ['Spinoza.md', {
        frontmatter: {
          influenced_by: ['[[Descartes]]'],
          instance_of: '[[Rationalist]]',
          lock: true,
        },
        instanceOf: ['Rationalist'],
        lockIntent: true,
        name: 'Spinoza',
        path: 'Spinoza.md',
      }],
      ['Draft.md', {
        frontmatter: {
          instance_of: '[[Philosopher]]',
          lock: true,
        },
        instanceOf: ['Philosopher'],
        lockIntent: true,
        name: 'Draft',
        path: 'Draft.md',
      }],
    ]),
    entitiesByName: new Map(),
    generatedAt: '2026-06-09T00:00:00.000Z',
    issues: [],
    settings: { typeFolder: '_types' },
    types: new Map(),
  };
}

describe('runOntologyQuery', () => {
  it('matches inherited type chains for locked entities by default', () => {
    const results = runOntologyQuery(makeIndex(), 'type: Person');
    expect(results.map((entity) => entity.name)).toEqual(['Spinoza']);
  });

  it('supports relation filters and include widening', () => {
    const relationResults = runOntologyQuery(makeIndex(), 'type: Philosopher AND influenced_by: [[Descartes]]');
    expect(relationResults.map((entity) => entity.name)).toEqual(['Spinoza']);

    const widenedResults = runOntologyQuery(makeIndex(), 'type: Philosopher AND include: incomplete');
    expect(widenedResults.map((entity) => entity.name)).toEqual(['Draft', 'Spinoza']);
  });
});
