import type { App, Component } from 'obsidian';
import type { EditorState, Extension } from '@codemirror/state';
import type { DecorationSet, PluginSpec, PluginValue, ViewUpdate } from '@codemirror/view';

import { MarkdownRenderer } from 'obsidian';
import { EditorSelection, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';

import type { DirectiveBlock } from '../parseDirectiveBlocks.ts';

import { parseDirectiveBlocks } from '../parseDirectiveBlocks.ts';

const INTERACTIVE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL']);

/**
 * Wraps an already-rendered DOM node.
 * eq() returns true when given the same node reference, so CM6 reuses the
 * existing DOM element instead of calling toDOM() and blowing away rendered content.
 */
class PrerenderedWidget extends WidgetType {
  public constructor(private readonly node: HTMLElement) {
    super();
  }

  public override eq(other: WidgetType): boolean {
    return other instanceof PrerenderedWidget && other.node === this.node;
  }

  public toDOM(): HTMLElement {
    return this.node;
  }

  public override ignoreEvent(): boolean {
    return false; // let our click listener on the node fire
  }
}

interface CachedNode {
  node: HTMLElement;
  hash: string;
}

class DirectiveViewPlugin implements PluginValue {
  public decorations: DecorationSet = Decoration.none;

  // startLine → { node, content-hash }
  // Nodes are reused across CM6 update cycles; only recreated when content changes.
  private readonly cache = new Map<number, CachedNode>();

  public constructor(
    private readonly view: EditorView,
    private readonly app: App,
    private readonly component: Component,
    private readonly enableLivePreview: () => boolean
  ) {
    this.decorations = this.buildDecorations(view.state);
  }

  public update(update: ViewUpdate): void {
    if (!update.docChanged && !update.selectionSet) return;
    this.decorations = this.buildDecorations(update.state);
  }

  public destroy(): void {
    this.cache.clear();
  }

  private buildDecorations(state: EditorState): DecorationSet {
    if (!this.enableLivePreview()) return Decoration.none;

    const cursor = state.selection.main.head;
    const blocks = parseDirectiveBlocks(state.doc.toString());
    const builder = new RangeSetBuilder<Decoration>();

    // Evict cache entries for blocks that have been deleted
    const activeLines = new Set(blocks.map((b) => b.startLine));
    for (const line of this.cache.keys()) {
      if (!activeLines.has(line)) this.cache.delete(line);
    }

    for (const block of blocks) {
      const lineCount = state.doc.lines;
      if (block.startLine + 1 > lineCount || block.endLine + 1 > lineCount) continue;

      const from = state.doc.line(block.startLine + 1).from;
      const to = state.doc.line(block.endLine + 1).to;

      // Cursor inside the block → collapse decoration so user can edit source
      if (cursor >= from && cursor <= to) continue;

      const hash = `${block.name}\0${JSON.stringify(block.args)}\0${block.body}`;
      const cached = this.cache.get(block.startLine);

      let node: HTMLElement;
      if (cached && cached.hash === hash) {
        node = cached.node;
      } else {
        node = this.createPlaceholder(block);
        this.cache.set(block.startLine, { node, hash });
        void this.renderAsync(block, node);
      }

      // Keep fromPos current so the click handler always jumps to the right line,
      // even if content was inserted above the block since the node was created.
      node.dataset['fromPos'] = String(from);

      builder.add(from, to, Decoration.replace({
        widget: new PrerenderedWidget(node),
        block: true,
      }));
    }

    return builder.finish();
  }

  private createPlaceholder(block: DirectiveBlock): HTMLElement {
    const el = document.createElement('div');
    el.className = 'directive-block-widget';
    el.dataset['directive'] = block.name;
    el.dataset['directiveType'] = block.name;
    el.setAttribute('aria-label', `Directive: ${block.name}`);

    const header = el.createEl('div', { cls: 'directive-block-widget-header' });
    header.createEl('span', { cls: 'directive-block-widget-name', text: block.name });
    if (Object.keys(block.args).length > 0) {
      header.createEl('span', {
        cls: 'directive-block-widget-args',
        text: JSON.stringify(block.args),
      });
    }

    el.createEl('div', {
      cls: 'directive-block-widget-body directive-block-widget-loading',
      text: 'Rendering…',
    });

    el.addEventListener('click', (evt) => {
      if (evt.target instanceof HTMLElement && INTERACTIVE_TAGS.has(evt.target.tagName)) return;
      const pos = parseInt(el.dataset['fromPos'] ?? '0', 10);
      this.view.dispatch({ selection: EditorSelection.cursor(pos) });
      this.view.focus();
    });

    return el;
  }

  private async renderAsync(block: DirectiveBlock, el: HTMLElement): Promise<void> {
    const bodyEl = el.querySelector<HTMLElement>('.directive-block-widget-body');
    if (!bodyEl || !el.isConnected) return;

    bodyEl.empty();
    bodyEl.removeClass('directive-block-widget-loading');

    await MarkdownRenderer.render(this.app, block.body, bodyEl, '', this.component);
  }
}

const pluginSpec: PluginSpec<DirectiveViewPlugin> = {
  decorations: (p) => p.decorations,
};

export function createDirectiveViewPlugin(
  app: App,
  component: Component,
  enableLivePreview: () => boolean
): Extension {
  return ViewPlugin.define(
    (view) => new DirectiveViewPlugin(view, app, component, enableLivePreview),
    pluginSpec
  );
}
