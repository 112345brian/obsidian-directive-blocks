import { exec } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { App, TFile } from 'obsidian';

import { Notice } from 'obsidian';

import { parseDirectiveBlocks } from './parseDirectiveBlocks.ts';

const execAsync = promisify(exec);

function blockToMarkdown(body: string, name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'ordered': {
      const items = body
        .split('\n')
        .map((l) => l.replace(/^[-*+]\s+/, '').trim())
        .filter(Boolean);
      return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    }
    case 'roman': {
      const items = body
        .split('\n')
        .map((l) => l.replace(/^[-*+]\s+/, '').trim())
        .filter(Boolean);
      // roman lists → numbered with a note
      return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    }
    case 'callout': {
      const type = (args['type'] as string | undefined) ?? 'info';
      const title = (args['title'] as string | undefined) ?? type;
      const lines = body.split('\n').map((l) => `> ${l}`);
      return `> **${title}** *(${type})*\n${lines.join('\n')}`;
    }
    case 'timeline': {
      const EVENT_RE = /^(\d{4}-\d{2}-\d{2}):\s*(.+)$/;
      return body
        .split('\n')
        .map((line) => {
          const m = EVENT_RE.exec(line.replace(/^[-*+]\s+/, '').trim());
          return m ? `**${m[1]}**: ${m[2]}` : line;
        })
        .join('\n');
    }
    default:
      return body;
  }
}

function preprocessSource(source: string): string {
  const blocks = parseDirectiveBlocks(source);
  if (blocks.length === 0) return source;

  const lines = source.split('\n');

  // Process in reverse so line indices stay stable
  for (const block of [...blocks].reverse()) {
    const replacement = blockToMarkdown(block.body, block.name, block.args);
    lines.splice(block.startLine, block.endLine - block.startLine + 1, ...replacement.split('\n'));
  }

  return lines.join('\n');
}

export async function exportToPdf(app: App): Promise<void> {
  const activeFile = app.workspace.getActiveFile();
  if (!(activeFile instanceof Object && 'path' in activeFile)) {
    new Notice('No active file to export.');
    return;
  }

  const file = activeFile as TFile;
  const rawSource = await app.vault.read(file);
  const processed = preprocessSource(rawSource);

  const tmpFile = join(tmpdir(), `directive-export-${Date.now()}.md`);
  const baseName = file.basename;
  const vaultRoot = (app.vault.adapter as { basePath?: string }).basePath ?? '.';
  const outFile = join(vaultRoot, `${baseName}.pdf`);

  writeFileSync(tmpFile, processed, 'utf-8');

  try {
    await execAsync(`pandoc "${tmpFile}" -o "${outFile}"`);
    new Notice(`Exported to ${baseName}.pdf`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    new Notice(`Pandoc export failed: ${msg}`);
  } finally {
    rmSync(tmpFile, { force: true });
  }
}
