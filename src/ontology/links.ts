export function basenameWithoutExtension(path: string): string {
  const slashIndex = path.lastIndexOf('/');
  const fileName = slashIndex === -1 ? path : path.slice(slashIndex + 1);
  return fileName.replace(/\.md$/i, '');
}

export function normalizeLinkTarget(value: string): string {
  const trimmed = value.trim();
  const withoutNot = trimmed.startsWith('NOT ') ? trimmed.slice(4).trim() : trimmed;
  const wikiMatch = /^\[\[([^|\]#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/.exec(withoutNot);
  const wikiTarget = wikiMatch?.[1];
  if (wikiTarget) {
    return basenameWithoutExtension(wikiTarget.trim());
  }
  return basenameWithoutExtension(withoutNot.replace(/\.md$/i, ''));
}

export function extractLinkTargets(value: unknown): string[] {
  if (typeof value === 'string') {
    return [normalizeLinkTarget(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') {
        return [normalizeLinkTarget(item)];
      }
      if (item && typeof item === 'object' && 'target' in item) {
        return extractLinkTargets((item as { target: unknown }).target);
      }
      return [];
    });
  }
  if (value && typeof value === 'object' && 'target' in value) {
    return extractLinkTargets((value as { target: unknown }).target);
  }
  return [];
}

export function hasNegatedTarget(value: unknown, target: string): boolean {
  const matches = (candidate: unknown): boolean => {
    if (typeof candidate === 'string') {
      return candidate.trim().startsWith('NOT ') && normalizeLinkTarget(candidate) === target;
    }
    return false;
  };

  if (matches(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => matches(item));
  }
  return false;
}

export function toWikiLink(name: string): string {
  return `[[${name}]]`;
}
