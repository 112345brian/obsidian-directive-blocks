import type { App } from 'obsidian';

import { PluginSettingTab, Setting } from 'obsidian';

import type { Plugin } from './Plugin.ts';

export class PluginSettingsTab extends PluginSettingTab {
  public constructor(app: App, private readonly plugin: Plugin) {
    super(app, plugin);
  }

  public override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Obsidian Ontology' });

    new Setting(containerEl)
      .setName('Type folder')
      .setDesc('Markdown folder containing ontology type definitions.')
      .addText((text) =>
        text
          .setPlaceholder('_types')
          .setValue(this.plugin.pluginSettings.typeFolder)
          .onChange(async (value) => {
            this.plugin.pluginSettings.typeFolder = value.trim() || '_types';
            await this.plugin.savePluginSettings();
          })
      );

    new Setting(containerEl)
      .setName('Cache path')
      .setDesc('Vault-relative JSON cache path.')
      .addText((text) =>
        text
          .setPlaceholder('.obsidian/ontology-cache.json')
          .setValue(this.plugin.pluginSettings.cachePath)
          .onChange(async (value) => {
            this.plugin.pluginSettings.cachePath = value.trim() || '.obsidian/ontology-cache.json';
            await this.plugin.savePluginSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default locked query results')
      .setDesc('Keep ontology-query results aligned with the trusted locked-state default.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.pluginSettings.queryOnlyLocked)
          .onChange(async (value) => {
            this.plugin.pluginSettings.queryOnlyLocked = value;
            await this.plugin.savePluginSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto-update inverse relations')
      .setDesc('Reserved for automatic inverse writes after save; command-based fixing is always available.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.pluginSettings.autoUpdateInverses)
          .onChange(async (value) => {
            this.plugin.pluginSettings.autoUpdateInverses = value;
            await this.plugin.savePluginSettings();
          })
      );

    new Setting(containerEl)
      .setName('Validation threshold')
      .setDesc('Entity count where validation should be treated as urgent.')
      .addText((text) =>
        text
          .setValue(String(this.plugin.pluginSettings.validationThreshold))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            this.plugin.pluginSettings.validationThreshold = Number.isFinite(parsed) ? parsed : 100;
            await this.plugin.savePluginSettings();
          })
      );
  }
}
