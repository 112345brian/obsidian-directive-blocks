import type { DirectiveConfig } from '../DirectiveBlocksAPI.ts';

interface TimelineEvent {
  date: string;
  description: string;
}

const EVENT_RE = /^(\d{4}-\d{2}-\d{2}):\s*(.+)$/;

function parseTimelineEvents(body: string): TimelineEvent[] {
  return body
    .split('\n')
    .map((line) => {
      const m = EVENT_RE.exec(line.replace(/^[-*+]\s+/, '').trim());
      if (!m) return null;
      return { date: m[1]!, description: m[2]! };
    })
    .filter((e): e is TimelineEvent => e !== null);
}

export const timelineDirective: DirectiveConfig = {
  name: 'timeline',
  async render({ source, el }) {
    const events = parseTimelineEvents(source);
    el.addClass('directive-timeline');

    const list = el.createEl('ul', { cls: 'directive-timeline-list' });

    for (const event of events) {
      const item = list.createEl('li', { cls: 'directive-timeline-item' });
      item.createEl('span', { cls: 'directive-timeline-dot' });
      const content = item.createEl('div', { cls: 'directive-timeline-content' });
      content.createEl('time', { cls: 'directive-timeline-date', text: event.date });
      content.createEl('p', { cls: 'directive-timeline-desc', text: event.description });
    }
  },
};
