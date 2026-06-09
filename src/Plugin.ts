import type { MarkdownPostProcessorContext, TFile } from 'obsidian';

import { MarkdownRenderer, Notice, Plugin as ObsidianPlugin } from 'obsidian';

import type { OntologyIndex } from './ontology/types.ts';
import type { PluginSettings } from './PluginSettings.ts';

import { writeOntologyCache } from './ontology/cache.ts';
import { buildOntologyIndex } from './ontology/indexer.ts';
import { fixMissingInverses, scaffoldEntity } from './ontology/mutations.ts';
import { runOntologyQuery } from './ontology/query.ts';
import { PluginSettings as PluginSettingsClass } from './PluginSettings.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

const REBUILD_DEBOUNCE_MS = 800;

export class Plugin extends ObsidianPlugin {
  public index: null | OntologyIndex = null;
  public pluginSettings: PluginSettings = new PluginSettingsClass();

  private rebuildTimer: null | number = null;

  public override async onload(): Promise<void> {
    this.pluginSettings = Object.assign(new PluginSettingsClass(), await this.loadData());

    this.registerMarkdownCodeBlockProcessor('ontology-query', this.renderQueryBlock.bind(this));

    this.addCommand({
      callback: () => { void this.rebuildIndex(true); },
      id: 'rebuild-index',
      name: 'Rebuild ontology index',
    });

    this.addCommand({
      callback: () => { this.showValidationSummary(); },
      id: 'check-consistency',
      name: 'Check ontology consistency',
    });

    this.addCommand({
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          return false;
        }
        if (!checking) {
          void this.scaffoldActiveNote(file);
        }
        return true;
      },
      id: 'scaffold-active-note',
      name: 'Scaffold active ontology note',
    });

    this.addCommand({
      callback: () => { void this.fixInverses(); },
      id: 'fix-missing-inverses',
      name: 'Fix missing inverse relations',
    });

    this.registerEvent(this.app.vault.on('create', () => { this.scheduleRebuild(); }));
    this.registerEvent(this.app.vault.on('modify', () => { this.scheduleRebuild(); }));
    this.registerEvent(this.app.vault.on('delete', () => { this.scheduleRebuild(); }));
    this.addSettingTab(new PluginSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => { void this.rebuildIndex(false); });
  }

  public override onunload(): void {
    if (this.rebuildTimer !== null) {
      window.clearTimeout(this.rebuildTimer);
    }
  }

  public async savePluginSettings(): Promise<void> {
    await this.saveData(this.pluginSettings);
    await this.rebuildIndex(false);
  }

  public async rebuildIndex(showNotice: boolean): Promise<void> {
    this.index = await buildOntologyIndex(this.app, {
      typeFolder: this.pluginSettings.typeFolder,
    });
    await writeOntologyCache(this.app, this.pluginSettings.cachePath, this.index);

    if (showNotice) {
      new Notice(`Ontology index rebuilt: ${this.index.types.size} types, ${this.index.entities.size} entities, ${this.index.issues.length} issues.`);
    }
  }

  private async ensureIndex(): Promise<OntologyIndex> {
    if (!this.index) {
      await this.rebuildIndex(false);
    }
    return this.index!;
  }

  private scheduleRebuild(): void {
    if (this.rebuildTimer !== null) {
      window.clearTimeout(this.rebuildTimer);
    }
    this.rebuildTimer = window.setTimeout(() => {
      this.rebuildTimer = null;
      void this.rebuildIndex(false);
    }, REBUILD_DEBOUNCE_MS);
  }

  private async renderQueryBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
    const index = await this.ensureIndex();
    const querySource = this.pluginSettings.queryOnlyLocked && !/\binclude:\s*/i.test(source)
      ? `${source}\ninclude: locked`
      : source;
    const results = runOntologyQuery(index, querySource);

    el.empty();
    el.addClass('ontology-query-results');

    if (results.length === 0) {
      el.createEl('p', { cls: 'ontology-query-empty', text: 'No matching ontology notes.' });
      return;
    }

    const table = el.createEl('table');
    const header = table.createEl('thead').createEl('tr');
    header.createEl('th', { text: 'Note' });
    header.createEl('th', { text: 'Types' });
    header.createEl('th', { text: 'Lock' });

    const body = table.createEl('tbody');
    for (const entity of results) {
      const row = body.createEl('tr');
      const noteCell = row.createEl('td');
      await MarkdownRenderer.render(this.app, `[[${entity.name}]]`, noteCell, ctx.sourcePath, this);
      row.createEl('td', { text: entity.instanceOf.join(', ') });
      row.createEl('td', { text: index.effectiveEntityLocks.get(entity.path)?.state ?? 'unlocked' });
    }
  }

  private showValidationSummary(): void {
    if (!this.index) {
      new Notice('Ontology index is not ready yet.');
      return;
    }
    const errors = this.index.issues.filter((issue) => issue.severity === 'error').length;
    const warnings = this.index.issues.length - errors;
    new Notice(`Ontology consistency: ${errors} errors, ${warnings} warnings.`);
    console.table(this.index.issues);
  }

  private async scaffoldActiveNote(file: TFile): Promise<void> {
    const index = await this.ensureIndex();
    const added = await scaffoldEntity(this.app, index, file);
    new Notice(`Ontology scaffold added ${added} fields.`);
    await this.rebuildIndex(false);
  }

  private async fixInverses(): Promise<void> {
    const index = await this.ensureIndex();
    const fixed = await fixMissingInverses(this.app, index);
    new Notice(`Ontology fixed ${fixed} inverse relation entries.`);
    await this.rebuildIndex(false);
  }
}
