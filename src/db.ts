import Dexie, { type Table } from 'dexie';

export type PlatformId = 'netflix' | 'coupang' | 'tving' | 'disney_plus';

export interface Content {
  id?: number;
  platform: PlatformId;
  contentId: string;
  title: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  totalDurationSec?: number;
  createdAt: number;
}

export interface Line {
  id?: number;
  contentId: number;
  seq: number;
  startMs: number;
  endMs: number;
  textEn: string;
  textKo: string;
  note?: string;
  source: 'platform' | 'user';
  editedAt?: number;
  // 자막이 부정확한데 정확한 값을 찾지 못한 라인을 마크. 사용자 검토용 (검색/필터).
  needsReview?: 0 | 1;
  // 몰랐던 단어·표현이라 다시 볼 라인. 즐겨찾기/북마크 의미.
  isStarred?: 0 | 1;
  // 노래 가사·삽입곡 등 학습 대상 아닌 라인. 삭제 대신 목록에서만 숨김 (되돌리기 가능).
  isHidden?: 0 | 1;
}

export interface LineProgress {
  lineId: number;
  listenCount: number;
  dictationAttempts: number;
  dictationCorrect: number;
  shadowCount: number;
  isMemorized: 0 | 1;
  lastListenedAt?: number;
  lastDictatedAt?: number;
}

export interface CustomLoop {
  id?: number;
  contentId: number;
  startMs: number;
  endMs: number;
  label?: string;
  listenCount: number;
  isMemorized: 0 | 1;
  createdAt: number;
  lastListenedAt?: number;
}

export interface DailyGoal {
  date: string;
  targetMinutes: number;
  targetListens: number;
  achievedMinutes: number;
  achievedListens: number;
  completed: 0 | 1;
}

export interface Streak {
  id: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate?: string;
}

export interface Session {
  id?: number;
  contentId: number;
  startedAt: number;
  endedAt?: number;
  activeSeconds: number;
}

export interface Recording {
  id?: number;
  lineId: number;
  blob: Blob;
  durationMs: number;
  selfRating?: 1 | 2 | 3;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class CueloopDb extends Dexie {
  contents!: Table<Content, number>;
  lines!: Table<Line, number>;
  lineProgress!: Table<LineProgress, number>;
  customLoops!: Table<CustomLoop, number>;
  dailyGoals!: Table<DailyGoal, string>;
  streak!: Table<Streak, number>;
  sessions!: Table<Session, number>;
  recordings!: Table<Recording, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('cueloop');
    this.version(1).stores({
      contents: '++id, &[platform+contentId], platform, createdAt',
      lines: '++id, contentId, [contentId+seq], [contentId+startMs]',
      lineProgress: 'lineId, isMemorized, lastListenedAt',
      customLoops: '++id, contentId, [contentId+startMs], lastListenedAt',
      dailyGoals: 'date, completed',
      streak: 'id',
      sessions: '++id, contentId, startedAt',
      recordings: '++id, lineId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new CueloopDb();
