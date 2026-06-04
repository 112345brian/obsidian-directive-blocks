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
    containerEl.createEl('h2', { text: 'Directive Blocks Settings' });

    new Setting(containerEl)
      .setName('Live Preview rendering')
      .setDesc('Render directive blocks as widgets in the editor live preview.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.pluginSettings.enableLivePreview)
          .onChange(async (value) => {
            this.plugin.pluginSettings.enableLivePreview = value;
            await this.plugin.savePluginSettings();
          })
      );

    new Setting(containerEl)
      .setName('Reading View rendering')
      .setDesc('Render directive blocks in Reading View.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.pluginSettings.enableReadingView)
          .onChange(async (value) => {
            this.plugin.pluginSettings.enableReadingView = value;
            await this.plugin.savePluginSettings();
          })
      );

    new Setting(containerEl)
      .setName('CSS class prefix')
      .setDesc('Prefix applied to directive block wrapper classes (default: "directive").')
      .addText((text) =>
        text
          .setPlaceholder('directive')
          .setValue(this.plugin.pluginSettings.cssClassPrefix)
          .onChange(async (value) => {
            this.plugin.pluginSettings.cssClassPrefix = value.trim() || 'directive';
            await this.plugin.savePluginSettings();
          })
      );

    const registeredNames = this.plugin.api.getRegisteredDirectives();
    new Setting(containerEl)
      .setName('Registered directives')
      .setDesc(registeredNames.length > 0 ? registeredNames.join(', ') : '(none)');
  }
}
