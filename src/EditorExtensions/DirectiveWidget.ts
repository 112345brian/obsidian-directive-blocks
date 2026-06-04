import type { EditorView } from '@codemirror/view';

import { EditorSelection } from '@codemirror/state';
import { WidgetType } from '@codemirror/view';

import type { DirectiveBlock } from '../parseDirectiveBlocks.ts';

export class DirectiveWidget extends WidgetType {
  public constructor(private readonly block: DirectiveBlock) {
    super();
  }

  public override eq(other: WidgetType): boolean {
    return (
      other instanceof DirectiveWidget &&
      other.block.startLine === this.block.startLine &&
      other.block.name === this.block.name &&
      other.block.body === this.block.body
    );
  }

  public toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('div');
    el.className = 'directive-block-widget';
    el.dataset['directive'] = this.block.name;
    el.setAttribute('aria-label', `Directive: ${this.block.name}`);

    const header = el.createEl('div', { cls: 'directive-block-widget-header' });
    header.createEl('span', { cls: 'directive-block-widget-name', text: this.block.name });

    if (Object.keys(this.block.args).length > 0) {
      header.createEl('span', {
        cls: 'directive-block-widget-args',
        text: JSON.stringify(this.block.args),
      });
    }

    const body = el.createEl('div', { cls: 'directive-block-widget-body' });
    const preview = this.block.body.slice(0, 200);
    body.setText(preview + (this.block.body.length > 200 ? '…' : ''));

    el.addEventListener('click', () => {
      const line = view.state.doc.line(this.block.startLine + 1);
      view.dispatch({ selection: EditorSelection.cursor(line.from) });
      view.focus();
    });

    return el;
  }
}
