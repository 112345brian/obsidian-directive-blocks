export interface DirectiveBlock {
  name: string;
  args: Record<string, unknown>;
  body: string;
  startLine: number;
  endLine: number;
}

const OPEN_RE = /^:::(\w[\w-]*)(?:\s+(.+))?$/;

/**
 * Parse top-level ::: fenced div blocks from raw Markdown.
 * Nesting is tracked so an inner ::: does not prematurely close an outer one.
 * Each returned block's `body` includes the raw text of any nested blocks.
 */
export function parseDirectiveBlocks(source: string): DirectiveBlock[] {
  const lines = source.split('\n');
  const results: DirectiveBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const openMatch = OPEN_RE.exec(line);

    if (!openMatch) {
      i++;
      continue;
    }

    const startLine = i;
    const name = openMatch[1]!;
    let args: Record<string, unknown> = {};

    if (openMatch[2]) {
      try {
        const parsed: unknown = JSON.parse(openMatch[2]);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>;
        }
      } catch {
        // non-JSON argument string — leave args empty
      }
    }

    const bodyLines: string[] = [];
    let depth = 1;
    i++;

    while (i < lines.length && depth > 0) {
      const inner = lines[i]!;
      if (OPEN_RE.test(inner)) {
        depth++;
        bodyLines.push(inner);
      } else if (inner === ':::') {
        depth--;
        if (depth > 0) {
          bodyLines.push(inner);
        }
      } else {
        bodyLines.push(inner);
      }
      i++;
    }

    // depth > 0 means EOF reached without a matching close fence — discard
    if (depth > 0) continue;

    results.push({
      name,
      args,
      body: bodyLines.join('\n'),
      startLine,
      endLine: i - 1,
    });
  }

  return results;
}
