import type { ContentMetadata, PlatformAdapter, SubtitleTrack } from './types';

export class NetflixAdapter implements PlatformAdapter {
  readonly id = 'netflix' as const;
  readonly hostPatterns = [/^https:\/\/(?:www\.)?netflix\.com\//];

  async waitForReady(): Promise<void> {
    throw new Error('NetflixAdapter.waitForReady: not implemented yet (Day 5)');
  }

  getVideoElement(): HTMLVideoElement | null {
    throw new Error('NetflixAdapter.getVideoElement: not implemented yet (Day 5)');
  }

  async getSubtitleTracks(): Promise<SubtitleTrack[]> {
    throw new Error('NetflixAdapter.getSubtitleTracks: not implemented yet (Day 3)');
  }

  hideNativeSubtitles(): void {
    throw new Error('NetflixAdapter.hideNativeSubtitles: not implemented yet (Day 5)');
  }

  getContentId(): string {
    throw new Error('NetflixAdapter.getContentId: not implemented yet (Day 3)');
  }

  async getContentMetadata(): Promise<ContentMetadata> {
    throw new Error('NetflixAdapter.getContentMetadata: not implemented yet (Day 3)');
  }
}
