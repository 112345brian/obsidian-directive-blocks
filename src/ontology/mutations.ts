import type { App, TFile } from 'obsidian';

import { Notice } from 'obsidian';

import type { OntologyIndex, OntologyIssue } from './types.ts';

import { getInheritedCanHave, getInheritedMustHave } from './indexer.ts';
import { extractAssertedLinkTargets, toWikiLink } from './links.ts';

export interface FixMissingInversesOptions {
  onlyAutoUpdate?: boolean;
}

function findFile(app: App, path: string): TFile | null {
  const file = app.vault.getAbstractFileByPath(path);
  return file && 'extension' in file && file.extension === 'md' ? file as TFile : null;
}

export async function scaffoldEntity(app: App, index: OntologyIndex, file: TFile): Promise<number> {
  const entity = index.entities.get(file.path);
  if (!entity) {
    new Notice('This note has no instance_of/type frontmatter.');
    return 0;
  }

  const properties = new Map([...getInheritedCanHave(index, entity), ...getInheritedMustHave(index, entity)]);
  let added = 0;
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    const data = frontmatter as Record<string, unknown>;
    for (const property of properties.keys()) {
      if (!(property in data)) {
        data[property] = null;
        added++;
      }
    }
  });
  return added;
}

function inverseIssueKey(issue: OntologyIssue): string {
  return `${issue.file}:${issue.property ?? ''}:${issue.target ?? ''}`;
}

export async function fixMissingInverses(app: App, index: OntologyIndex, options: FixMissingInversesOptions = {}): Promise<number> {
  const issues = index.issues.filter((issue) => issue.autofixable && (!options.onlyAutoUpdate || issue.autoUpdate));
  const uniqueIssues = [...new Map(issues.map((issue) => [inverseIssueKey(issue), issue])).values()];
  let fixed = 0;

  for (const issue of uniqueIssues) {
    if (!issue.property || !issue.target) {
      continue;
    }
    const sourceEntity = index.entities.get(issue.file);
    const targetEntity = index.entitiesByName.get(issue.target);
    const targetFile = targetEntity ? findFile(app, targetEntity.path) : null;
    if (!sourceEntity || !targetEntity || !targetFile) {
      continue;
    }

    const property = issue.property;
    const sourceValue = sourceEntity.frontmatter[property];
    const relationType = sourceEntity.instanceOf
      .flatMap((typeName) => [typeName, ...(index.ancestorsByType.get(typeName) ?? [])])
      .map((typeName) => index.types.get(typeName))
      .find((type) => type?.relations.has(property));
    const relation = relationType?.relations.get(property);
    const inverseProperty = relation?.symmetric ? property : relation?.inverse;
    if (!inverseProperty || !extractAssertedLinkTargets(sourceValue).includes(targetEntity.name)) {
      continue;
    }

    await app.fileManager.processFrontMatter(targetFile, (frontmatter) => {
      const data = frontmatter as Record<string, unknown>;
      const existing = data[inverseProperty];
      const existingTargets = extractAssertedLinkTargets(existing);
      if (existingTargets.includes(sourceEntity.name)) {
        return;
      }
      if (Array.isArray(existing)) {
        existing.push(toWikiLink(sourceEntity.name));
      } else if (existing === undefined || existing === null || existing === '') {
        data[inverseProperty] = [toWikiLink(sourceEntity.name)];
      } else {
        data[inverseProperty] = [existing, toWikiLink(sourceEntity.name)];
      }
      fixed++;
    });
  }

  return fixed;
}
