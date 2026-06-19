export interface NoteLinkReference {
  end: number;
  start: number;
  title: string;
}

export interface NoteLinkTarget {
  path: string;
  title: string;
}

export interface ResolvedNoteLink extends NoteLinkReference {
  status: "resolved" | "broken" | "ambiguous";
  targetPath: string | null;
}

const NOTE_LINK_PATTERN = /\[\[([^\]\n]+)\]\]/g;

export function parseNoteLinks(content: string): NoteLinkReference[] {
  return [...content.matchAll(NOTE_LINK_PATTERN)]
    .map((match): NoteLinkReference | null => {
      const rawTitle = match[1]?.trim() ?? "";
      if (!rawTitle) return null;
      const start = match.index ?? 0;
      return {
        end: start + match[0].length,
        start,
        title: rawTitle
      };
    })
    .filter((link): link is NoteLinkReference => link !== null);
}

export function resolveNoteLinks(
  content: string,
  targets: NoteLinkTarget[]
): ResolvedNoteLink[] {
  const targetsByTitle = groupTargetsByTitle(targets);

  return parseNoteLinks(content).map((link) => {
    const matches =
      targetsByTitle.get(normalizeNoteLinkTitle(link.title)) ?? [];
    if (matches.length === 1) {
      return {
        ...link,
        status: "resolved",
        targetPath: matches[0]!.path
      };
    }
    if (matches.length > 1) {
      return {
        ...link,
        status: "ambiguous",
        targetPath: null
      };
    }
    return {
      ...link,
      status: "broken",
      targetPath: null
    };
  });
}

export function rewriteNoteLinksForRename(input: {
  content: string;
  fromTitle: string;
  toTitle: string;
}): string {
  const fromTitle = normalizeNoteLinkTitle(input.fromTitle);
  const toTitle = input.toTitle.trim();
  if (!fromTitle || !toTitle) return input.content;

  return input.content.replace(NOTE_LINK_PATTERN, (match, rawTitle: string) => {
    return normalizeNoteLinkTitle(rawTitle) === fromTitle
      ? `[[${toTitle}]]`
      : match;
  });
}

function groupTargetsByTitle(
  targets: NoteLinkTarget[]
): Map<string, NoteLinkTarget[]> {
  const grouped = new Map<string, NoteLinkTarget[]>();
  for (const target of targets) {
    const title = normalizeNoteLinkTitle(target.title);
    if (!title) continue;
    grouped.set(title, [...(grouped.get(title) ?? []), target]);
  }
  return grouped;
}

function normalizeNoteLinkTitle(value: string): string {
  return value.trim().toLocaleLowerCase();
}
