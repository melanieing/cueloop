export interface DfxpCue {
  startMs: number;
  endMs: number;
  text: string;
}

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(s: string): string {
  return s.replace(
    /&(?:amp|lt|gt|quot|apos|nbsp|#39);/g,
    (m) => ENTITY_MAP[m] ?? m,
  );
}

function parseTime(s: string): number {
  const trimmed = s.trim();
  if (trimmed.endsWith('t')) {
    return Math.round(parseInt(trimmed.slice(0, -1), 10) / 10000);
  }
  if (trimmed.endsWith('ms')) {
    return parseInt(trimmed.slice(0, -2), 10);
  }
  if (trimmed.endsWith('s')) {
    return Math.round(parseFloat(trimmed.slice(0, -1)) * 1000);
  }
  const clock = /^(\d+):(\d+):(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (clock) {
    const [, h, m, sec, frac] = clock;
    const fracMs = frac ? parseInt((frac + '000').slice(0, 3), 10) : 0;
    return (
      parseInt(h, 10) * 3600000 +
      parseInt(m, 10) * 60000 +
      parseInt(sec, 10) * 1000 +
      fracMs
    );
  }
  return 0;
}

export function parseDfxp(xml: string): DfxpCue[] {
  const cues: DfxpCue[] = [];
  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const inner = match[2];
    const beginMatch = /\bbegin\s*=\s*"([^"]+)"/.exec(attrs);
    const endMatch = /\bend\s*=\s*"([^"]+)"/.exec(attrs);
    if (!beginMatch || !endMatch) continue;

    const text = decodeEntities(
      inner
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .trim(),
    );
    if (!text) continue;

    cues.push({
      startMs: parseTime(beginMatch[1]),
      endMs: parseTime(endMatch[1]),
      text,
    });
  }
  return cues;
}
