import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useContents } from '@/src/hooks/useContents';
import { useLines } from '@/src/hooks/useLines';
import { useLineProgressMap } from '@/src/hooks/useLineProgressMap';
import { useActiveTabContent } from '@/src/hooks/useActiveTabContent';
import { db, type Content } from '@/src/db';
import type { CueloopMessage } from '@/src/messages';
import { broadcastContentUpdate } from '@/src/lib/broadcastUpdate';
import { todayKey, getOrCreateTodayGoal } from '@/src/lib/dailyGoal';
import { LineRow } from './LineRow';
import { InsertLineModal } from './InsertLineModal';
import { CustomLoopList } from './CustomLoopList';

// === Streak (sidepanel-local, WXT 0.20 cross-entrypoint import 버그 회피용 inline) ===
// popup/App.tsx와 동일한 구현. db.settings의 __streak__ key 공유.
type Streak = {
  id: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate?: string;
};

const SETTING_STREAK_KEY = '__streak__';

function sideYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadStreak(): Promise<Streak> {
  const row = await db.settings.get(SETTING_STREAK_KEY);
  if (row) return row.value as Streak;
  const fresh: Streak = { id: 1, currentStreak: 0, longestStreak: 0 };
  await db.settings.put({ key: SETTING_STREAK_KEY, value: fresh });
  return fresh;
}

async function maintainStreakSide(): Promise<Streak> {
  const today = todayKey();
  const yesterday = sideYesterdayKey();
  const cur = await loadStreak();
  // safety bump — 오늘 dailyGoal completed=1인데 streak 처리 안 됐으면 즉시 bump
  if (cur.lastCompletedDate !== today) {
    const todayGoal = await db.dailyGoals.get(today);
    if (todayGoal?.completed === 1) {
      const nextCurrent =
        cur.lastCompletedDate === yesterday ? cur.currentStreak + 1 : 1;
      const next: Streak = {
        id: 1,
        currentStreak: nextCurrent,
        longestStreak: Math.max(cur.longestStreak, nextCurrent),
        lastCompletedDate: today,
      };
      await db.settings.put({ key: SETTING_STREAK_KEY, value: next });
      return next;
    }
  }
  if (
    cur.lastCompletedDate === today ||
    cur.lastCompletedDate === yesterday
  ) {
    return cur;
  }
  if (cur.currentStreak === 0) return cur;
  const next: Streak = { ...cur, currentStreak: 0 };
  await db.settings.put({ key: SETTING_STREAK_KEY, value: next });
  return next;
}

function ProgressBar({
  achieved,
  target,
  unit,
  label,
}: {
  achieved: number;
  target: number;
  unit: string;
  label: string;
}) {
  const pct = target > 0 ? Math.min(100, (achieved / target) * 100) : 0;
  const complete = achieved >= target;
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-zinc-300 font-medium">{label}</span>
        <span
          className={`text-xs font-mono ${complete ? 'text-emerald-400' : 'text-zinc-400'}`}
        >
          {Math.floor(achieved)} / {target} {unit}
          {complete && ' ✓'}
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            complete ? 'bg-emerald-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function displayName(c: Content): string {
  const idLabel = `Netflix ${c.contentId}`;
  if (c.title === idLabel || c.title === c.contentId) return idLabel;
  return `${c.title} (${idLabel})`;
}

export default function App() {
  const contents = useContents();
  const activeContentId = useActiveTabContent();
  const [manualSelectedId, setManualSelectedId] = useState<number | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [jumpError, setJumpError] = useState<string | null>(null);
  // ref 대신 state로 — div가 조건부 렌더라서 useEffect dep로 정확히 트리거되게
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const followingActive = manualSelectedId === null;
  const effectiveContentId = useMemo(() => {
    if (manualSelectedId != null) return manualSelectedId;
    return activeContentId ?? contents?.[0]?.id ?? null;
  }, [manualSelectedId, activeContentId, contents]);

  const lines = useLines(effectiveContentId ?? undefined);
  const progressMap = useLineProgressMap(effectiveContentId ?? undefined);
  const [currentLineId, setCurrentLineId] = useState<number | null>(null);
  const [repeatingLineId, setRepeatingLineId] = useState<number | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [hideMemorized, setHideMemorized] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [progressOpen, setProgressOpen] = useState(false);

  // 진도/스트릭 — popup이 더 이상 안 열리므로 사이드패널이 책임.
  // 모달 열렸을 때만 query (성능 + 무한 re-subscribe 방지). 닫혀있으면 fetch 안 함.
  const todayGoal = useLiveQuery(
    async () => (progressOpen ? getOrCreateTodayGoal() : undefined),
    [progressOpen],
  );
  // streak는 헤더 버튼에 항상 숫자 표시해야 하므로 항상 fetch
  const streak = useLiveQuery(async () => loadStreak(), []);

  // mount 시 maintainStreak (popup이 했던 safety bump 역할 인수)
  useEffect(() => {
    void maintainStreakSide().catch(() => {});
  }, []);

  const handleEditStart = useCallback((lineId: number) => {
    setEditingLineId(lineId);
    // 편집 시작 시 자동 스크롤 토글 자동 OFF — 편집 중 자동 스크롤로 화면 흔들림 방지.
    // 사용자가 명시적으로 다시 ON해야 자동 스크롤 재개.
    setAutoScrollEnabled(false);
  }, []);

  const handleEditEnd = useCallback(() => {
    setEditingLineId(null);
  }, []);

  // overlay → CURRENT_LINE_CHANGED 받아서 자동 스크롤 + 하이라이트
  useEffect(() => {
    function handler(msg: unknown) {
      const m = msg as CueloopMessage;
      if (m?.type === 'CURRENT_LINE_CHANGED') {
        setCurrentLineId(m.payload.lineId);
      } else if (m?.type === 'REPEATING_LINE_CHANGED') {
        setRepeatingLineId(m.payload.lineId);
      }
    }
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  // 사이드패널에 focus 있을 때도 단축키 사용 가능하게 forward.
  // 단, input/textarea/select에 focus 있거나 편집 모드일 땐 그 입력을 우선.
  useEffect(() => {
    const HANDLED_KEYS = new Set([
      'h', 'l', 'a', 'b', 's', 'r',
      'arrowleft', 'arrowright', 'arrowup', 'arrowdown',
    ]);
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // input/textarea/select/contentEditable에 focus 있으면 무시 (그 입력 우선)
      const ae = document.activeElement as HTMLElement | null;
      if (ae) {
        const tag = ae.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (ae.isContentEditable) return;
      }
      // 라인 편집 중이면 무시
      if (editingLineId != null) return;
      // 제목 편집 중이면 무시
      if (editingTitle) return;
      const key = e.key.toLowerCase();
      if (!HANDLED_KEYS.has(key)) return;
      e.preventDefault();
      e.stopPropagation();
      const msg: CueloopMessage = {
        type: 'OVERLAY_SHORTCUT',
        payload: { key: e.key },
      };
      browser.runtime.sendMessage(msg).catch(() => {});
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [editingLineId, editingTitle]);

  // currentLineId 변경 시 해당 라인으로 스크롤
  // 토글이 켜져 있고 + 편집 중 아닐 때만 (편집 중엔 reflow 충돌 freeze 방지)
  useEffect(() => {
    if (!autoScrollEnabled) return;
    if (editingLineId != null) return;
    if (currentLineId == null || !scrollEl) return;
    const el = scrollEl.querySelector(`[data-line-id="${currentLineId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLineId, autoScrollEnabled, editingLineId, scrollEl]);

  function jumpToCurrentLine() {
    if (currentLineId != null && scrollEl) {
      const el = scrollEl.querySelector(`[data-line-id="${currentLineId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  const handleJump = useCallback(
    async (startMs: number) => {
      if (effectiveContentId == null) return;
      const msg: CueloopMessage = {
        type: 'JUMP_TO_LINE',
        payload: { contentId: effectiveContentId, startMs },
      };
      try {
        const resp = (await browser.runtime.sendMessage(msg)) as
          | { ok?: boolean; error?: string }
          | undefined;
        if (!resp?.ok) {
          setJumpError(resp?.error ?? 'jump 실패');
          setTimeout(() => setJumpError(null), 4000);
        } else {
          setJumpError(null);
        }
      } catch (err) {
        setJumpError(String(err));
        setTimeout(() => setJumpError(null), 4000);
      }
    },
    [effectiveContentId],
  );

  const handleLoop = useCallback(async (lineId: number) => {
    const msg: CueloopMessage = {
      type: 'PLAY_LINE_LOOP',
      payload: { lineId },
    };
    try {
      const resp = (await browser.runtime.sendMessage(msg)) as
        | { ok?: boolean; error?: string }
        | undefined;
      if (!resp?.ok) {
        setJumpError(resp?.error ?? '반복 시작 실패');
        setTimeout(() => setJumpError(null), 4000);
      }
    } catch (err) {
      setJumpError(String(err));
      setTimeout(() => setJumpError(null), 4000);
    }
  }, []);

  const handleStopRepeat = useCallback(async () => {
    const msg: CueloopMessage = { type: 'STOP_REPEAT' };
    try {
      await browser.runtime.sendMessage(msg);
    } catch (err) {
      setJumpError(String(err));
      setTimeout(() => setJumpError(null), 4000);
    }
  }, []);

  const memorizedCount = useMemo(() => {
    if (!lines) return 0;
    let n = 0;
    for (const l of lines) {
      if (l.id != null && progressMap.get(l.id)?.isMemorized === 1) n++;
    }
    return n;
  }, [lines, progressMap]);

  // 외움 필터링이 켜져 있으면 외운 라인은 표시에서 제외
  const displayLines = useMemo(() => {
    if (!lines || !hideMemorized) return lines;
    return lines.filter((l) => {
      if (l.id == null) return true;
      return progressMap.get(l.id)?.isMemorized !== 1;
    });
  }, [lines, hideMemorized, progressMap]);

  if (contents === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <h1 className="text-2xl font-bold mb-2">Cueloop</h1>
        <p className="text-sm text-zinc-400">로딩 중...</p>
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <h1 className="text-2xl font-bold mb-2">Cueloop</h1>
        <p className="text-sm text-zinc-400">
          아직 학습 콘텐츠가 없습니다. Netflix에서 영상을 재생하면 자막이 자동 수집됩니다.
        </p>
      </div>
    );
  }

  const totalLines = lines?.length ?? 0;
  const koFilled = lines?.filter((l) => l.textKo.trim().length > 0).length ?? 0;
  const editedCount = lines?.filter((l) => l.editedAt).length ?? 0;
  const userAddedCount = lines?.filter((l) => l.source === 'user').length ?? 0;
  const koPercent = totalLines > 0 ? Math.round((koFilled / totalLines) * 100) : 0;

  const lastEndMs = lines && lines.length > 0 ? lines[lines.length - 1].endMs : 0;
  const insertDefaultStart = lastEndMs + 1000;
  const insertDefaultEnd = lastEndMs + 4000;

  const currentContent = contents.find((c) => c.id === effectiveContentId);
  const idLabel = currentContent
    ? `Netflix ${currentContent.contentId}`
    : '';
  const hasCustomTitle =
    !!currentContent &&
    currentContent.title !== idLabel &&
    currentContent.title !== currentContent.contentId;

  function startEditTitle() {
    if (!currentContent) return;
    setTitleDraft(hasCustomTitle ? currentContent.title : '');
    setEditingTitle(true);
  }

  async function saveTitle() {
    if (!currentContent?.id) {
      setEditingTitle(false);
      return;
    }
    const trimmed = titleDraft.trim();
    const nextTitle = trimmed.length > 0 ? trimmed : idLabel;
    await db.contents.update(currentContent.id, { title: nextTitle });
    broadcastContentUpdate(currentContent.id);
    setEditingTitle(false);
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      <header className="p-4 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
        <div className="flex gap-2 mb-2">
          <select
            value={effectiveContentId ?? ''}
            onChange={(e) => {
              const newId = Number(e.target.value);
              // active 영상을 선택한 경우엔 manual 모드 진입하지 않고 자동 연동 유지
              if (newId === activeContentId) {
                setManualSelectedId(null);
              } else {
                setManualSelectedId(newId);
              }
            }}
            className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            {contents.map((c) => (
              <option key={c.id} value={c.id}>
                {displayName(c)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={startEditTitle}
            disabled={effectiveContentId == null}
            className={`px-2 py-1.5 text-xs rounded disabled:opacity-50 whitespace-nowrap cursor-pointer border ${
              hasCustomTitle
                ? 'text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border-zinc-700'
                : 'text-amber-300 bg-amber-950/40 hover:bg-amber-900/40 border-amber-800 animate-pulse'
            }`}
            title={hasCustomTitle ? '제목 편집' : '아직 ID만 — 클릭해서 영화 제목 입력'}
          >
            ✎ 제목
          </button>
          <button
            type="button"
            onClick={() => setInsertOpen(true)}
            disabled={effectiveContentId == null}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50 whitespace-nowrap cursor-pointer"
            title="새 라인 추가"
          >
            + 새 라인
          </button>
        </div>
        {editingTitle && currentContent && (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveTitle();
                else if (e.key === 'Escape') setEditingTitle(false);
              }}
              placeholder={`이 영상 제목 (예: Set It Up) — ${idLabel}`}
              className="flex-1 min-w-0 bg-zinc-950 border border-blue-600 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void saveTitle()}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded whitespace-nowrap cursor-pointer"
              title="저장 (Enter)"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditingTitle(false)}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded whitespace-nowrap cursor-pointer"
              title="취소 (Esc)"
            >
              취소
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 mb-1">
          {followingActive ? (
            <span
              className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-900 rounded px-1.5 py-0.5"
              title={activeContentId != null ? '현재 보는 영상과 자동 연동 중' : '현재 보는 영상이 데이터베이스에 없음 — 최근 콘텐츠 표시'}
            >
              📺 자동 연동{activeContentId == null ? ' (대기)' : ''}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setManualSelectedId(null)}
              className="text-[10px] text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded px-1.5 py-0.5"
              title="active Netflix 탭 따라가기로 복귀"
            >
              📺 현재 영상으로
            </button>
          )}
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => setProgressOpen(true)}
              className="text-[10px] rounded px-1.5 py-0.5 border text-emerald-300 bg-emerald-950/60 border-emerald-800 hover:bg-emerald-900/60 cursor-pointer"
              title="오늘 진도 + 스트릭 보기"
            >
              🔥 {streak?.currentStreak ?? 0}
            </button>
            {memorizedCount > 0 && (
              <button
                type="button"
                onClick={() => setHideMemorized((v) => !v)}
                className={`text-[10px] rounded px-1.5 py-0.5 border ${
                  hideMemorized
                    ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800 hover:bg-emerald-900/60'
                    : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                }`}
                title={hideMemorized ? `외운 ${memorizedCount}개 숨김 중 — 클릭해서 다시 표시` : `외운 라인 ${memorizedCount}개 — 클릭해서 숨기기`}
              >
                {hideMemorized ? `🙈 외움 ${memorizedCount} 숨김` : `☑ 외움 ${memorizedCount}`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAutoScrollEnabled((v) => !v)}
              className={`text-[10px] rounded px-1.5 py-0.5 border ${
                autoScrollEnabled
                  ? 'text-blue-300 bg-blue-950/60 border-blue-800 hover:bg-blue-900/60'
                  : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
              }`}
              title={autoScrollEnabled ? '자동 스크롤 켜짐 — 클릭해서 끄기' : '자동 스크롤 꺼짐 — 클릭해서 켜기'}
            >
              📌 자동 스크롤 {autoScrollEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-400">
          {totalLines.toLocaleString()} lines · 한국어 {koPercent}% ({koFilled})
          {editedCount > 0 && (
            <span className="text-amber-400/80 ml-2">· ✎편집 {editedCount}</span>
          )}
          {userAddedCount > 0 && (
            <span className="text-purple-300 ml-2">· 👤추가 {userAddedCount}</span>
          )}
        </p>
      </header>

      <CustomLoopList contentId={effectiveContentId ?? null} />

      {insertOpen && effectiveContentId != null && (
        <InsertLineModal
          contentId={effectiveContentId}
          defaultStartMs={insertDefaultStart}
          defaultEndMs={insertDefaultEnd}
          onClose={() => setInsertOpen(false)}
        />
      )}

      {progressOpen && todayGoal && streak && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setProgressOpen(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">오늘 진도</h3>
              <button
                type="button"
                onClick={() => setProgressOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 text-lg leading-none cursor-pointer"
                title="닫기"
              >
                ×
              </button>
            </div>

            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl">🔥</span>
                <span className="text-2xl font-bold text-amber-400">
                  {streak.currentStreak}
                </span>
                <span className="text-xs text-zinc-400">일 연속</span>
              </div>
              {streak.longestStreak > streak.currentStreak && (
                <span
                  className="text-[10px] text-zinc-500"
                  title="최장 연속 기록"
                >
                  최장 {streak.longestStreak}일
                </span>
              )}
            </div>

            <p className="text-[10px] text-zinc-500 mb-2">{todayKey()} 오늘 진도</p>

            <ProgressBar
              label="학습 시간"
              achieved={todayGoal.achievedMinutes}
              target={todayGoal.targetMinutes}
              unit="분"
            />
            <ProgressBar
              label="100LS 카운트"
              achieved={todayGoal.achievedListens}
              target={todayGoal.targetListens}
              unit="회"
            />

            {todayGoal.completed === 1 ? (
              <div className="mt-3 text-center text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900 rounded py-1.5">
                🎉 오늘 목표 달성!
              </div>
            ) : (
              <div className="mt-3 text-center text-[10px] text-zinc-500">
                두 항목 모두 100%면 스트릭 +1
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setProgressOpen(false);
                void browser.runtime.openOptionsPage();
              }}
              className="block w-full mt-4 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded cursor-pointer"
            >
              ⚙ 목표 변경 (설정 페이지)
            </button>
          </div>
        </div>
      )}

      {jumpError && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-950/90 border border-red-800 text-red-100 text-xs rounded p-2 shadow-lg z-50">
          ⚠ {jumpError}
        </div>
      )}

      {!autoScrollEnabled && currentLineId != null && (
        <button
          type="button"
          onClick={jumpToCurrentLine}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-full px-4 py-2 shadow-lg z-40 flex items-center gap-1.5"
          title="현재 재생 중인 라인으로 이동"
        >
          📺 현재 라인으로 ↓
        </button>
      )}

      <div ref={setScrollEl} className="flex-1 overflow-auto">
        {lines === undefined ? (
          <div className="p-4 text-sm text-zinc-500">라인 로딩 중...</div>
        ) : lines.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">자막 없음</div>
        ) : (
          (displayLines ?? lines).map((line, idx) => (
            <div
              key={line.id ?? `idx-${idx}`}
              data-line-id={line.id ?? ''}
              className="[content-visibility:auto] [contain-intrinsic-size:auto_100px]"
            >
              <LineRow
                line={line}
                index={idx}
                onJump={handleJump}
                onLoop={handleLoop}
                onStopRepeat={handleStopRepeat}
                progress={line.id != null ? progressMap.get(line.id) : undefined}
                isCurrent={line.id === currentLineId}
                isRepeating={line.id === repeatingLineId}
                isEditing={editingLineId === line.id}
                onEditStart={handleEditStart}
                onEditEnd={handleEditEnd}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
