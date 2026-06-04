import type { App, MarkdownPostProcessorContext, TFile } from 'obsidian';

import { parseDirectiveBlocks } from './parseDirectiveBlocks.ts';

export interface DirectiveRenderDetail {
  name: string;
  args: Record<string, unknown>;
  el: HTMLElement;
  ctx: MarkdownPostProcessorContext;
  source: string;
}

const INTERACTIVE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL']);

export function isInteractiveElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && INTERACTIVE_TAGS.has(target.tagName);
}

/**
 * Process the reading-view container once per render pass.
 * Finds <p> elements that contain ::: fencing, groups siblings into
 * directive blocks, and dispatches "directive-render" custom events.
 *
 * Names are matched case-insensitively (parseDirectiveBlocks already lowercases them).
 */
export async function processReadingView(
  containerEl: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  app: App,
  cssPrefix: string
): Promise<void> {
  if (containerEl.dataset['directiveBlocksProcessed']) return;
  containerEl.dataset['directiveBlocksProcessed'] = 'true';

  const file = app.vault.getAbstractFileByPath(ctx.sourcePath) as TFile | null;
  if (!file) return;

  const source = await app.vault.cachedRead(file);
  const blocks = parseDirectiveBlocks(source); // names already lowercased
  if (blocks.length === 0) return;

  const children = Array.from(containerEl.children) as HTMLElement[];
  const childTexts = children.map((el) => el.textContent?.trim().toLowerCase() ?? '');

  for (const block of blocks) {
    // Match the opening fence case-insensitively
    const openTextExact = `:::${block.name}${Object.keys(block.args).length ? ' ' + JSON.stringify(block.args) : ''}`;
    const openTextPlain = `:::${block.name}`;

    const openIdx = childTexts.findIndex(
      (t) => t === openTextExact.toLowerCase() || t === openTextPlain
    );
    if (openIdx === -1) continue;

    const closeIdx = childTexts.findIndex((t, i) => i > openIdx && t === ':::');
    if (closeIdx === -1) continue;

    const elements = children.slice(openIdx, closeIdx + 1);

    const wrapper = document.createElement('div');
    wrapper.className = `${cssPrefix}-block`;
    wrapper.dataset['directive'] = block.name;
    wrapper.dataset['directiveType'] = block.name;

    elements[0]!.replaceWith(wrapper);
    for (const el of elements.slice(1)) {
      el.remove();
    }

    const detail: DirectiveRenderDetail = {
      name: block.name,
      args: block.args,
      el: wrapper,
      ctx,
      source: block.body,
    };

    wrapper.dispatchEvent(
      new CustomEvent<DirectiveRenderDetail>('directive-render', {
        bubbles: true,
        detail,
      })
    );
  }
}
