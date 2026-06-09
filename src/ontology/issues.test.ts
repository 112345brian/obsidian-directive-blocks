import { describe, expect, it } from 'vitest';

import type { OntologyIssue } from './types.ts';

import { filterIssues, summarizeIssues } from './issues.ts';

const issues: OntologyIssue[] = [
  {
    file: 'A.md',
    message: 'Missing required property',
    severity: 'error',
  },
  {
    autofixable: true,
    file: 'B.md',
    message: 'Missing inverse',
    severity: 'warning',
  },
];

describe('ontology issue helpers', () => {
  it('summarizes severity counts', () => {
    expect(summarizeIssues(issues)).toEqual({
      errors: 1,
      total: 2,
      warnings: 1,
    });
  });

  it('filters by file, severity, and autofixability', () => {
    expect(filterIssues(issues, { severity: 'error' }).map((issue) => issue.file)).toEqual(['A.md']);
    expect(filterIssues(issues, { file: 'B.md', autofixable: true }).map((issue) => issue.message)).toEqual(['Missing inverse']);
  });
});
