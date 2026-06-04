import type { App, MarkdownPostProcessorContext, TFile } from 'obsidian';

import { parseDirectiveBlocks } from './parseDirectiveBlocks.ts';

export interface DirectiveRenderDetail {
  name: string;
  args: Record<string, unknown>;
  el: HTMLElement;
  ctx: MarkdownPostProcessorContext;
  source: string;
}

/**
 * Process the reading-view container once per render pass.
 * Finds <p> elements that contain ::: fencing, groups siblings into
 * directive blocks, and dispatches "directive-render" custom events.
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
  const blocks = parseDirectiveBlocks(source);
  if (blocks.length === 0) return;

  // Collect all child paragraphs with their text content
  const children = Array.from(containerEl.children) as HTMLElement[];

  // Map each child to the raw text it likely represents
  const childTexts = children.map((el) => el.textContent?.trim() ?? '');

  for (const block of blocks) {
    const openText = `:::${block.name}${Object.keys(block.args).length ? ' ' + JSON.stringify(block.args) : ''}`;

    // Find the child element that corresponds to the opening fence
    const openIdx = childTexts.findIndex((t) => t === openText || t === `:::${block.name}`);
    if (openIdx === -1) continue;

    // Find the child element that is the closing fence
    const closeIdx = childTexts.findIndex((t, i) => i > openIdx && t === ':::');
    if (closeIdx === -1) continue;

    // Gather all elements between open and close (inclusive)
    const elements = children.slice(openIdx, closeIdx + 1);

    // Build the wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = `${cssPrefix}-block`;
    wrapper.dataset['directive'] = block.name;

    // Replace the opening element with the wrapper and remove the rest
    elements[0]!.replaceWith(wrapper);
    for (const el of elements.slice(1)) {
      el.remove();
    }

    // Dispatch the render event so registered handlers can populate the wrapper
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
