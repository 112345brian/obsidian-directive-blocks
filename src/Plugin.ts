import type { MarkdownPostProcessorContext } from 'obsidian';

import { Plugin as ObsidianPlugin } from 'obsidian';

import type { DirectiveBlocksAPI, DirectiveConfig, RenderOpts } from './DirectiveBlocksAPI.ts';
import type { DirectiveRenderDetail } from './ReadingViewRenderer.ts';
import type { PluginSettings } from './PluginSettings.ts';

import { calloutDirective } from './directives/callout.ts';
import { orderedDirective, romanDirective } from './directives/ordered.ts';
import { timelineDirective } from './directives/timeline.ts';
import { createDirectiveStateField } from './EditorExtensions/DirectiveStateField.ts';
import { exportToPdf } from './PandocExport.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';
import { processReadingView } from './ReadingViewRenderer.ts';

const DEFAULT_SETTINGS: PluginSettings = {
  enableLivePreview: true,
  enableReadingView: true,
  cssClassPrefix: 'directive',
};

export class Plugin extends ObsidianPlugin {
  public api!: DirectiveBlocksAPI;
  public pluginSettings: PluginSettings = { ...DEFAULT_SETTINGS };

  private readonly directives = new Map<string, DirectiveConfig>();

  public registerDirective(config: DirectiveConfig): void {
    this.directives.set(config.name, config);
  }

  public async savePluginSettings(): Promise<void> {
    await this.saveData(this.pluginSettings);
  }

  public override async onload(): Promise<void> {
    console.log('Directive Blocks loaded');

    this.pluginSettings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<PluginSettings>
    );

    this.api = {
      registerDirective: (config) => { this.registerDirective(config); },
      getRegisteredDirectives: () => Array.from(this.directives.keys()),
    };

    // Built-in directives
    this.registerDirective(orderedDirective);
    this.registerDirective(romanDirective);
    this.registerDirective(calloutDirective);
    this.registerDirective(timelineDirective);

    // directive-render events bubble up from wrapper elements
    this.registerDomEvent(
      document,
      'directive-render' as keyof DocumentEventMap,
      ((evt: CustomEvent<DirectiveRenderDetail>) => {
        void this.handleDirectiveRender(evt);
      }) as EventListener
    );

    // Reading View post processor
    this.registerMarkdownPostProcessor(
      (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        if (!this.pluginSettings.enableReadingView) return;
        const container = el.parentElement ?? el;
        void processReadingView(container, ctx, this.app, this.pluginSettings.cssClassPrefix);
      }
    );

    // Live Preview CM6 extension
    this.registerEditorExtension([
      createDirectiveStateField(() => this.pluginSettings.enableLivePreview),
    ]);

    // Pandoc export command
    this.addCommand({
      id: 'export-to-pdf',
      name: 'Export to PDF via Pandoc',
      callback: () => { void exportToPdf(this.app); },
    });

    this.addSettingTab(new PluginSettingsTab(this.app, this));
  }

  private async handleDirectiveRender(evt: CustomEvent<DirectiveRenderDetail>): Promise<void> {
    const { name, args, el, ctx, source } = evt.detail;
    const config = this.directives.get(name);
    if (!config) return;

    const opts: RenderOpts = { source, args, el, app: this.app, ctx };
    await config.render(opts);
  }
}
