import type { DirectiveConfig } from '../DirectiveBlocksAPI.ts';

function parseListItems(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.replace(/^[-*+]\s+/, '').trim())
    .filter((line) => line.length > 0);
}

export const orderedDirective: DirectiveConfig = {
  name: 'ordered',
  async render({ source, el }) {
    const items = parseListItems(source);
    const ol = el.createEl('ol');
    for (const item of items) {
      ol.createEl('li', { text: item });
    }
  },
};

export const romanDirective: DirectiveConfig = {
  name: 'roman',
  async render({ source, el }) {
    const items = parseListItems(source);
    const ol = el.createEl('ol');
    ol.style.listStyleType = 'lower-roman';
    for (const item of items) {
      ol.createEl('li', { text: item });
    }
  },
};
