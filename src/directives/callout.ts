import type { App, Component } from 'obsidian';

import { MarkdownRenderer } from 'obsidian';

import type { DirectiveConfig } from '../DirectiveBlocksAPI.ts';

const CALLOUT_ICONS: Record<string, string> = {
  danger: '🚨',
  info: 'ℹ️',
  tip: '💡',
  warning: '⚠️',
};

export const calloutDirective: DirectiveConfig = {
  name: 'callout',
  async render({ args, source, el, app, ctx }) {
    const type = ((args['type'] as string | undefined) ?? 'info').toLowerCase();
    const title = (args['title'] as string | undefined) ?? type;
    const icon = CALLOUT_ICONS[type] ?? 'ℹ️';

    el.addClass('directive-callout', `directive-callout-${type}`);
    el.dataset['calloutType'] = type; // enables [data-callout-type="info"] CSS targeting

    const header = el.createEl('div', { cls: 'directive-callout-header' });
    header.createEl('span', { cls: 'directive-callout-icon', text: icon });
    header.createEl('span', { cls: 'directive-callout-title', text: title });

    const body = el.createEl('div', { cls: 'directive-callout-body' });

    // MarkdownRenderer.render signature: (app, markdown, el, sourcePath, component)
    await MarkdownRenderer.render(
      app as App,
      source,
      body,
      ctx.sourcePath,
      // MarkdownRenderer.render expects a Component; ctx satisfies the interface
      ctx as unknown as Component
    );
  },
};
