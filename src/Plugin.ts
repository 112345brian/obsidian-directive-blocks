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

/** Parse the optional JSON args line at the top of a code-block directive body. */
function parseCodeBlockSource(raw: string): { args: Record<string, unknown>; body: string } {
  const firstNewline = raw.indexOf('\n');
  const firstLine = firstNewline === -1 ? raw : raw.slice(0, firstNewline);
  const rest = firstNewline === -1 ? '' : raw.slice(firstNewline + 1);

  if (firstLine.trimStart().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(firstLine.trim());
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { args: parsed as Record<string, unknown>, body: rest };
      }
    } catch {
      // not valid JSON — treat the first line as body content
    }
  }
  return { args: {}, body: raw };
}

export class Plugin extends ObsidianPlugin {
  public api!: DirectiveBlocksAPI;
  public pluginSettings: PluginSettings = { ...DEFAULT_SETTINGS };

  private readonly directives = new Map<string, DirectiveConfig>();

  /**
   * Register a directive. Also registers a code-block processor for
   * ```directive-{name}``` blocks, which is more reliable than DOM text-matching.
   */
  public registerDirective(config: DirectiveConfig): void {
    const name = config.name.toLowerCase();
    this.directives.set(name, { ...config, name });

    // Code-block syntax: ```directive-{name}```
    // First line (optional): JSON args object. Remaining lines: body.
    this.registerMarkdownCodeBlockProcessor(
      `directive-${name}`,
      async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        if (!this.pluginSettings.enableReadingView) return;
        const { args, body } = parseCodeBlockSource(source);

        el.className = `${this.pluginSettings.cssClassPrefix}-block`;
        el.dataset['directive'] = name;
        el.dataset['directiveType'] = name;

        const opts: RenderOpts = { source: body, args, el, app: this.app, ctx };
        await config.render(opts);
      }
    );
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

    // Built-in directives (also registers their code-block processors)
    this.registerDirective(orderedDirective);
    this.registerDirective(romanDirective);
    this.registerDirective(calloutDirective);
    this.registerDirective(timelineDirective);

    // directive-render events bubble up from ::: fenced-div wrapper elements
    this.registerDomEvent(
      document,
      'directive-render' as keyof DocumentEventMap,
      ((evt: CustomEvent<DirectiveRenderDetail>) => {
        void this.handleDirectiveRender(evt);
      }) as EventListener
    );

    // Reading View post-processor (for ::: fenced-div syntax)
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
    const config = this.directives.get(name.toLowerCase());
    if (!config) return;

    const opts: RenderOpts = { source, args, el, app: this.app, ctx };
    await config.render(opts);
  }
}
