import type { EditorState, Extension } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';

import { RangeSetBuilder, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

import { parseDirectiveBlocks } from '../parseDirectiveBlocks.ts';
import { DirectiveWidget } from './DirectiveWidget.ts';

function buildDecorations(state: EditorState, enableLivePreview: () => boolean): DecorationSet {
  if (!enableLivePreview()) return Decoration.none;

  const cursorHead = state.selection.main.head;
  const text = state.doc.toString();
  const blocks = parseDirectiveBlocks(text);
  const builder = new RangeSetBuilder<Decoration>();

  for (const block of blocks) {
    const lineCount = state.doc.lines;
    if (block.startLine + 1 > lineCount || block.endLine + 1 > lineCount) continue;

    const from = state.doc.line(block.startLine + 1).from;
    const to = state.doc.line(block.endLine + 1).to;

    // When cursor is inside the block, show raw source for editing
    if (cursorHead >= from && cursorHead <= to) continue;

    builder.add(
      from,
      to,
      Decoration.replace({
        widget: new DirectiveWidget(block),
        block: true,
      })
    );
  }

  return builder.finish();
}

/**
 * Factory that creates the directive StateField with access to the plugin
 * settings getter, so live-preview can be toggled without a full reload.
 */
export function createDirectiveStateField(enableLivePreview: () => boolean): Extension {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, enableLivePreview);
    },
    update(_old, tr) {
      if (!tr.docChanged && !tr.selection) return _old;
      return buildDecorations(tr.state, enableLivePreview);
    },
    provide(field) {
      return EditorView.decorations.from(field);
    },
  });
}
