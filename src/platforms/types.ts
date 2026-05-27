import type { PlatformId } from '../db';

export type { PlatformId };

export interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
}

export interface SubtitleTrack {
  language: string;
  label: string;
  cues: SubtitleCue[];
}

export interface ContentMetadata {
  title: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  durationSec?: number;
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly hostPatterns: RegExp[];

  waitForReady(): Promise<void>;

  getVideoElement(): HTMLVideoElement | null;

  getSubtitleTracks(): Promise<SubtitleTrack[]>;

  hideNativeSubtitles(): void;

  getContentId(): string;

  getContentMetadata(): Promise<ContentMetadata>;
}
