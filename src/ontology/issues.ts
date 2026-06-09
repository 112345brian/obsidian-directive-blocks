import type { OntologyIssue } from './types.ts';

export interface IssueFilter {
  autofixable?: boolean;
  file?: string;
  severity?: OntologyIssue['severity'];
}

export interface IssueSummary {
  errors: number;
  total: number;
  warnings: number;
}

export function filterIssues(issues: OntologyIssue[], filter: IssueFilter = {}): OntologyIssue[] {
  return issues.filter((issue) => {
    if (filter.severity && issue.severity !== filter.severity) {
      return false;
    }
    if (filter.file && issue.file !== filter.file) {
      return false;
    }
    if (filter.autofixable !== undefined && Boolean(issue.autofixable) !== filter.autofixable) {
      return false;
    }
    return true;
  });
}

export function summarizeIssues(issues: OntologyIssue[]): IssueSummary {
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  return {
    errors,
    total: issues.length,
    warnings: issues.length - errors,
  };
}
