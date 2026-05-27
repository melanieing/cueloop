import { NetflixAdapter } from './netflix';
import type { PlatformAdapter } from './types';

const adapters: PlatformAdapter[] = [new NetflixAdapter()];

export function detectAdapter(url: string): PlatformAdapter | null {
  return adapters.find((a) => a.hostPatterns.some((p) => p.test(url))) ?? null;
}

export type {
  PlatformAdapter,
  PlatformId,
  SubtitleTrack,
  SubtitleCue,
  ContentMetadata,
} from './types';
