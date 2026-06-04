import { describe, expect, it } from 'vitest';

import { parseDirectiveBlocks } from './parseDirectiveBlocks.ts';

describe('parseDirectiveBlocks', () => {
  it('returns empty array for plain Markdown', () => {
    expect(parseDirectiveBlocks('# Hello\nsome text')).toEqual([]);
  });

  it('parses a simple block with no args', () => {
    const src = ':::ordered\n- a\n- b\n:::';
    const [block] = parseDirectiveBlocks(src);
    expect(block).toMatchObject({
      name: 'ordered',
      args: {},
      body: '- a\n- b',
      startLine: 0,
      endLine: 3,
    });
  });

  it('parses a block with JSON args', () => {
    const src = ':::callout {"type":"info","title":"Note"}\nContent\n:::';
    const [block] = parseDirectiveBlocks(src);
    expect(block).toMatchObject({
      name: 'callout',
      args: { type: 'info', title: 'Note' },
      body: 'Content',
    });
  });

  it('ignores invalid JSON args and leaves args empty', () => {
    const src = ':::foo invalid json\nbody\n:::';
    const [block] = parseDirectiveBlocks(src);
    expect(block?.args).toEqual({});
  });

  it('handles nested blocks without premature close', () => {
    const src = ':::outer\n:::inner\ncontent\n:::\n:::\n';
    const [outer] = parseDirectiveBlocks(src);
    expect(outer?.name).toBe('outer');
    expect(outer?.body).toBe(':::inner\ncontent\n:::');
  });

  it('parses multiple top-level blocks', () => {
    const src = ':::a\nbodyA\n:::\n:::b\nbodyB\n:::';
    const blocks = parseDirectiveBlocks(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.name).toBe('a');
    expect(blocks[1]?.name).toBe('b');
  });

  it('ignores unclosed blocks', () => {
    const src = ':::unclosed\nbody without closing';
    expect(parseDirectiveBlocks(src)).toEqual([]);
  });

  it('body does not include the opening or closing fence lines', () => {
    const src = ':::demo\nline1\nline2\n:::';
    const [block] = parseDirectiveBlocks(src);
    expect(block?.body).toBe('line1\nline2');
  });

  it('handles hyphenated directive names', () => {
    const src = ':::my-directive\nbody\n:::';
    const [block] = parseDirectiveBlocks(src);
    expect(block?.name).toBe('my-directive');
  });

  it('normalizes directive names to lowercase', () => {
    const src = ':::Callout\nbody\n:::';
    const [block] = parseDirectiveBlocks(src);
    expect(block?.name).toBe('callout');
  });

  it('preserves correct line numbers with leading content', () => {
    const src = 'preamble\n:::block\nbody\n:::';
    const [block] = parseDirectiveBlocks(src);
    expect(block?.startLine).toBe(1);
    expect(block?.endLine).toBe(3);
  });
});
