import { db, type Line } from '../db';
import { parseDfxp, type DfxpCue } from '../lib/dfxp';

interface NetflixTrackUrl {
  url: string;
}

interface NetflixDownloadFormat {
  urls?: NetflixTrackUrl[];
}

interface NetflixTimedTextTrack {
  language?: string;
  languageDescription?: string;
  ttDownloadables?: Record<string, NetflixDownloadFormat>;
  isForcedNarrative?: boolean;
  isNoneTrack?: boolean;
}

const FORMAT_PRIORITY = [
  'dfxp-ls-sdh',
  'imsc1.1',
  'simplesdh',
  'dfxp-isd',
  'webvtt-lssdh-ios8',
];

const TARGET_LANGUAGES = ['en', 'ko'] as const;
type TargetLanguage = (typeof TARGET_LANGUAGES)[number];

function classifyLanguage(lang: string | undefined): TargetLanguage | null {
  if (!lang) return null;
  const lower = lang.toLowerCase();
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('ko')) return 'ko';
  return null;
}

function pickDfxpUrl(track: NetflixTimedTextTrack): string | null {
  const downloads = track.ttDownloadables;
  if (!downloads) return null;
  for (const format of FORMAT_PRIORITY) {
    const url = downloads[format]?.urls?.[0]?.url;
    if (url) return url;
  }
  for (const fmt of Object.values(downloads)) {
    const url = fmt?.urls?.[0]?.url;
    if (url) return url;
  }
  return null;
}

function isPlaceholderTitle(title: string, movieId: string): boolean {
  return title === `Netflix ${movieId}` || title === movieId || title.trim() === '';
}

async function ensureContent(
  movieId: string,
  pageTitle?: string,
): Promise<number | null> {
  const existing = await db.contents
    .where('[platform+contentId]')
    .equals(['netflix', movieId])
    .first();
  if (existing?.id) {
    if (pageTitle && isPlaceholderTitle(existing.title, movieId)) {
      await db.contents.update(existing.id, { title: pageTitle });
      console.log(`[Cueloop] updated content title: ${movieId} → "${pageTitle}"`);
    }
    return existing.id;
  }
  const id = await db.contents.add({
    platform: 'netflix',
    contentId: movieId,
    title: pageTitle ?? `Netflix ${movieId}`,
    createdAt: Date.now(),
  });
  return typeof id === 'number' ? id : null;
}

async function fetchAndParseCues(
  url: string,
  lang: TargetLanguage,
  movieId: string,
): Promise<DfxpCue[]> {
  console.log(`[Cueloop] fetching ${lang} dfxp from`, url);
  try {
    const xml = await fetch(url, { credentials: 'include' }).then((r) => {
      if (!r.ok) throw new Error(`fetch failed HTTP ${r.status}`);
      return r.text();
    });
    const cues = parseDfxp(xml);
    if (cues.length === 0) {
      console.warn(`[Cueloop] parsed 0 cues from ${lang} track of ${movieId}`);
    }
    return cues;
  } catch (err) {
    console.error(`[Cueloop] failed to fetch/parse ${lang} track:`, err);
    return [];
  }
}

async function firstIngestWithMatching(
  contentDbId: number,
  enCues: DfxpCue[],
  koCues: DfxpCue[],
): Promise<void> {
  const sortedEn = [...enCues].sort((a, b) => a.startMs - b.startMs);
  const sortedKo = [...koCues].sort((a, b) => a.startMs - b.startMs);
  const usedKo = new Set<number>();
  let matchedCount = 0;

  const enLines: Line[] = sortedEn.map((en, i) => {
    let bestIdx = -1;
    let bestOverlap = 0;
    for (let j = 0; j < sortedKo.length; j++) {
      if (usedKo.has(j)) continue;
      const ko = sortedKo[j];
      if (ko.endMs < en.startMs || ko.startMs > en.endMs) continue;
      const overlap = Math.min(en.endMs, ko.endMs) - Math.max(en.startMs, ko.startMs);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIdx = j;
      }
    }
    let textKo = '';
    if (bestIdx >= 0) {
      usedKo.add(bestIdx);
      textKo = sortedKo[bestIdx].text;
      matchedCount++;
    }
    return {
      contentId: contentDbId,
      seq: i + 1,
      startMs: en.startMs,
      endMs: en.endMs,
      textEn: en.text,
      textKo,
      source: 'platform',
    };
  });

  const koOnlyLines: Line[] = sortedKo
    .map((ko, idx) => ({ ko, idx }))
    .filter(({ idx }) => !usedKo.has(idx))
    .map(({ ko }, i) => ({
      contentId: contentDbId,
      seq: enLines.length + i + 1,
      startMs: ko.startMs,
      endMs: ko.endMs,
      textEn: '',
      textKo: ko.text,
      source: 'platform',
    }));

  await db.lines.bulkAdd([...enLines, ...koOnlyLines]);
  console.log(
    `[Cueloop] first ingest: ${enLines.length} en lines (${matchedCount} with ko match) + ${koOnlyLines.length} ko-only lines`,
  );
}

const MATCH_TOLERANCE_MS = 200;

function findClosestLine(cueStartMs: number, sortedCandidates: Line[]): Line | undefined {
  if (sortedCandidates.length === 0) return undefined;
  let lo = 0;
  let hi = sortedCandidates.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedCandidates[mid].startMs < cueStartMs) lo = mid + 1;
    else hi = mid;
  }
  let best: Line | undefined;
  let bestDiff = Infinity;
  for (const idx of [lo, lo - 1]) {
    const c = sortedCandidates[idx];
    if (!c) continue;
    const diff = Math.abs(c.startMs - cueStartMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return bestDiff <= MATCH_TOLERANCE_MS ? best : undefined;
}

async function mergeCues(
  lang: TargetLanguage,
  cues: DfxpCue[],
  existing: Line[],
): Promise<number> {
  const sortedCandidates = existing
    .filter((l) => l.source === 'platform' && !l.editedAt)
    .sort((a, b) => a.startMs - b.startMs);
  let updated = 0;
  for (const cue of cues) {
    const match = findClosestLine(cue.startMs, sortedCandidates);
    if (!match?.id) continue;
    const patch: Partial<Line> = {};
    if (lang === 'en' && match.textEn !== cue.text) patch.textEn = cue.text;
    if (lang === 'ko' && match.textKo !== cue.text) patch.textKo = cue.text;
    if (Object.keys(patch).length > 0) {
      await db.lines.update(match.id, patch);
      updated++;
    }
  }
  return updated;
}

export async function ingestNetflixTracks(
  movieId: string,
  rawTracks: unknown[],
  pageTitle?: string,
): Promise<void> {
  const contentDbId = await ensureContent(movieId, pageTitle);
  if (contentDbId == null) {
    console.warn('[Cueloop] could not resolve content row for', movieId);
    return;
  }

  const tracks = (rawTracks as NetflixTimedTextTrack[]).filter(
    (t) => !t.isForcedNarrative && !t.isNoneTrack && t.ttDownloadables,
  );

  const enTrack = tracks.find((t) => classifyLanguage(t.language) === 'en');
  const koTrack = tracks.find((t) => classifyLanguage(t.language) === 'ko');

  const enUrl = enTrack ? pickDfxpUrl(enTrack) : null;
  const koUrl = koTrack ? pickDfxpUrl(koTrack) : null;

  const enCues = enUrl ? await fetchAndParseCues(enUrl, 'en', movieId) : [];
  const koCues = koUrl ? await fetchAndParseCues(koUrl, 'ko', movieId) : [];

  if (enCues.length === 0 && koCues.length === 0) {
    console.warn(`[Cueloop] no usable cues for ${movieId}, skipping`);
    return;
  }

  const existing = await db.lines.where('contentId').equals(contentDbId).toArray();

  if (existing.length === 0) {
    await firstIngestWithMatching(contentDbId, enCues, koCues);
    return;
  }

  if (enCues.length > 0) {
    const updated = await mergeCues('en', enCues, existing);
    console.log(`[Cueloop] re-ingest en: ${updated} updated (${existing.length} existing)`);
  }
  if (koCues.length > 0) {
    const updated = await mergeCues('ko', koCues, existing);
    console.log(`[Cueloop] re-ingest ko: ${updated} updated (${existing.length} existing)`);
  }
}
