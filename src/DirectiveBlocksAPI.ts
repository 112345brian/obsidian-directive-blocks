import type { App, MarkdownPostProcessorContext } from 'obsidian';

export interface RenderOpts {
  source: string;
  args: Record<string, unknown>;
  el: HTMLElement;
  app: App;
  ctx: MarkdownPostProcessorContext;
}

export interface DirectiveConfig {
  name: string;
  render: (opts: RenderOpts) => Promise<void>;
}

export interface DirectiveBlocksAPI {
  registerDirective(config: DirectiveConfig): void;
  getRegisteredDirectives(): string[];
}
