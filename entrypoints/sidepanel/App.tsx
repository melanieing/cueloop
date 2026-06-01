import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useContents } from '@/src/hooks/useContents';
import { useLines } from '@/src/hooks/useLines';
import { useLineProgressMap } from '@/src/hooks/useLineProgressMap';
import { useActiveTabContent } from '@/src/hooks/useActiveTabContent';
import { db, type Content } from '@/src/db';
import type { CueloopMessage } from '@/src/messages';
import { broadcastContentUpdate } from '@/src/lib/broadcastUpdate';
import { todayKey, readTodayGoal } from '@/src/lib/dailyGoal';
import { LineRow, TrashIcon, EyeOffIcon } from './LineRow';
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

// 읽기 전용 — useLiveQuery에서 쓰기가 일어나면 재실행 cascade로 render 폭주(흰 화면)
// 가 나므로 표시용은 쓰기 없는 이 함수를 쓴다. 최초 생성은 maintainStreakSide(effect) 담당.
async function loadStreakReadonly(): Promise<Streak> {
  const row = await db.settings.get(SETTING_STREAK_KEY);
  if (row) return row.value as Streak;
  return { id: 1, currentStreak: 0, longestStreak: 0 };
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
  const [showOnlyNeedsReview, setShowOnlyNeedsReview] = useState(false);
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [progressOpen, setProgressOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Content | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 라인 단일 삭제 (hover 🗑) confirm 모달
  const [deleteLineTarget, setDeleteLineTarget] = useState<{
    id: number;
    preview: string;
    contentId: number;
  } | null>(null);
  // 다중 선택 모드
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // 진도/스트릭 — popup이 더 이상 안 열리므로 사이드패널이 책임.
  // 모달 열렸을 때만 query (성능 + 무한 re-subscribe 방지). 닫혀있으면 fetch 안 함.
  // 둘 다 읽기 전용 — useLiveQuery 콜백에서 DB 쓰면 재실행 cascade로 흰 화면 발생.
  const todayGoal = useLiveQuery(
    async () => (progressOpen ? readTodayGoal() : undefined),
    [progressOpen],
  );
  // streak는 헤더 버튼에 항상 숫자 표시해야 하므로 항상 fetch
  const streak = useLiveQuery(async () => loadStreakReadonly(), []);

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
      'h', 'e', 'l', 'a', 'b', 's', 'r', ' ',
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

  // 단일 라인 삭제 요청 (hover 🗑 클릭)
  const requestDeleteLine = useCallback(
    (lineId: number, preview: string, contentId: number) => {
      setDeleteLineTarget({ id: lineId, preview, contentId });
    },
    [],
  );

  async function confirmDeleteLine() {
    if (!deleteLineTarget) return;
    const { id, contentId } = deleteLineTarget;
    try {
      await db.lines.delete(id);
      await db.lineProgress.delete(id);
      broadcastContentUpdate(contentId);
    } catch (err) {
      setJumpError(`라인 삭제 실패: ${String(err)}`);
      setTimeout(() => setJumpError(null), 4000);
    } finally {
      setDeleteLineTarget(null);
    }
  }

  // 선택 모드 토글
  function toggleSelectionMode() {
    setSelectionMode((prev) => {
      if (prev) setSelectedLineIds(new Set());
      return !prev;
    });
  }

  const handleSelectToggle = useCallback((lineId: number) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  function selectAllVisible() {
    if (!lines) return;
    const ids = new Set<number>();
    const src = displayLines ?? lines;
    for (const l of src) {
      if (l.id != null) ids.add(l.id);
    }
    setSelectedLineIds(ids);
  }

  function deselectAll() {
    setSelectedLineIds(new Set());
  }

  async function bulkDeleteSelected() {
    if (selectedLineIds.size === 0 || effectiveContentId == null) return;
    setBulkDeleting(true);
    try {
      const ids = [...selectedLineIds];
      await db.transaction('rw', [db.lines, db.lineProgress, db.recordings], async () => {
        await db.lines.bulkDelete(ids);
        await db.lineProgress.bulkDelete(ids);
        await db.recordings.where('lineId').anyOf(ids).delete();
      });
      broadcastContentUpdate(effectiveContentId);
      setSelectedLineIds(new Set());
      setConfirmBulkDelete(false);
      // 삭제 후 선택 모드 자동 종료 — 일괄 삭제 완료가 자연스러운 흐름의 끝
      setSelectionMode(false);
    } catch (err) {
      setJumpError(`일괄 삭제 실패: ${String(err)}`);
      setTimeout(() => setJumpError(null), 4000);
    } finally {
      setBulkDeleting(false);
    }
  }

  // 선택한 라인 일괄 숨김 — 삭제와 달리 되돌리기 가능하므로 confirm 없이 즉시.
  async function bulkHideSelected() {
    if (selectedLineIds.size === 0 || effectiveContentId == null) return;
    setBulkDeleting(true);
    try {
      const ids = [...selectedLineIds];
      await db.transaction('rw', [db.lines], async () => {
        for (const id of ids) {
          await db.lines.update(id, { isHidden: 1 });
        }
      });
      broadcastContentUpdate(effectiveContentId);
      setSelectedLineIds(new Set());
      setSelectionMode(false);
    } catch (err) {
      setJumpError(`일괄 숨김 실패: ${String(err)}`);
      setTimeout(() => setJumpError(null), 4000);
    } finally {
      setBulkDeleting(false);
    }
  }

  // 선택 모드 중 ESC로 해제
  useEffect(() => {
    if (!selectionMode) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // 일반 ESC가 이미 다른 곳에서 잡힐 수 있으므로 capture로 우선 처리
        e.preventDefault();
        e.stopPropagation();
        setSelectionMode(false);
        setSelectedLineIds(new Set());
      }
    }
    document.addEventListener('keydown', onEsc, true);
    return () => document.removeEventListener('keydown', onEsc, true);
  }, [selectionMode]);

  // 콘텐츠 + 연관 데이터(lines/lineProgress/customLoops/sessions/recordings) cascade 삭제.
  // dailyGoals/streak은 콘텐츠 무관(날짜 기준)이라 보존.
  async function confirmDeleteContent() {
    const target = deleteTarget;
    if (target?.id == null) return;
    const contentId = target.id;
    setDeleting(true);
    try {
      await db.transaction(
        'rw',
        [db.contents, db.lines, db.lineProgress, db.customLoops, db.sessions, db.recordings],
        async () => {
          const lns = await db.lines.where('contentId').equals(contentId).toArray();
          const lineIds = lns
            .map((l) => l.id)
            .filter((x): x is number => x != null);
          if (lineIds.length > 0) {
            await db.lineProgress.bulkDelete(lineIds);
            await db.recordings.where('lineId').anyOf(lineIds).delete();
          }
          await db.lines.where('contentId').equals(contentId).delete();
          await db.customLoops.where('contentId').equals(contentId).delete();
          await db.sessions.where('contentId').equals(contentId).delete();
          await db.contents.delete(contentId);
        },
      );
      // 삭제된 게 현재 manual 선택이었으면 자동 연동으로 복귀
      if (manualSelectedId === contentId) setManualSelectedId(null);
      broadcastContentUpdate(contentId);
    } catch (err) {
      setJumpError(`삭제 실패: ${String(err)}`);
      setTimeout(() => setJumpError(null), 4000);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const memorizedCount = useMemo(() => {
    if (!lines) return 0;
    let n = 0;
    for (const l of lines) {
      if (l.id != null && progressMap.get(l.id)?.isMemorized === 1) n++;
    }
    return n;
  }, [lines, progressMap]);

  const needsReviewCount = useMemo(() => {
    if (!lines) return 0;
    let n = 0;
    for (const l of lines) {
      if (l.needsReview === 1) n++;
    }
    return n;
  }, [lines]);

  const starredCount = useMemo(() => {
    if (!lines) return 0;
    let n = 0;
    for (const l of lines) {
      if (l.isStarred === 1) n++;
    }
    return n;
  }, [lines]);

  const hiddenCount = useMemo(() => {
    if (!lines) return 0;
    let n = 0;
    for (const l of lines) {
      if (l.isHidden === 1) n++;
    }
    return n;
  }, [lines]);

  // 마지막 마크 해제 시 해당 필터 자동 OFF — 빈 화면 + 토글 사라지는 trap 방지
  useEffect(() => {
    if (showOnlyNeedsReview && needsReviewCount === 0) {
      setShowOnlyNeedsReview(false);
    }
  }, [showOnlyNeedsReview, needsReviewCount]);
  useEffect(() => {
    if (showOnlyStarred && starredCount === 0) {
      setShowOnlyStarred(false);
    }
  }, [showOnlyStarred, starredCount]);
  useEffect(() => {
    if (showHidden && hiddenCount === 0) {
      setShowHidden(false);
    }
  }, [showHidden, hiddenCount]);

  // 필터링 — 숨김 제외(기본) + 외움 숨김 + 검토만 + 중요만 (AND 조합)
  const displayLines = useMemo(() => {
    if (!lines) return lines;
    let result = lines;
    // 숨긴 라인은 기본 제외. showHidden ON이면 (흐리게) 포함.
    if (!showHidden) {
      result = result.filter((l) => l.isHidden !== 1);
    }
    if (hideMemorized) {
      result = result.filter((l) => {
        if (l.id == null) return true;
        return progressMap.get(l.id)?.isMemorized !== 1;
      });
    }
    if (showOnlyNeedsReview) {
      result = result.filter((l) => l.needsReview === 1);
    }
    if (showOnlyStarred) {
      result = result.filter((l) => l.isStarred === 1);
    }
    return result;
  }, [lines, showHidden, hideMemorized, showOnlyNeedsReview, showOnlyStarred, progressMap]);

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
  const editedCount = lines?.filter((l) => l.editedAt).length ?? 0;
  const userAddedCount = lines?.filter((l) => l.source === 'user').length ?? 0;
  // 숨긴 라인 제외한 실제 학습 대상 라인 수 + 외움 비율 (분모 = 학습 대상)
  const studyLines = Math.max(0, totalLines - hiddenCount);
  const memorizedPercent =
    studyLines > 0 ? Math.round((memorizedCount / studyLines) * 100) : 0;

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
            onClick={() => {
              if (currentContent) setDeleteTarget(currentContent);
            }}
            disabled={effectiveContentId == null}
            className="px-2 py-1.5 text-xs bg-zinc-800 hover:bg-red-900 text-zinc-300 hover:text-red-100 border border-zinc-700 hover:border-red-800 rounded disabled:opacity-50 whitespace-nowrap cursor-pointer inline-flex items-center"
            title="이 콘텐츠 + 모든 학습 데이터 삭제"
          >
            <TrashIcon className="w-4 h-4" />
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
              onClick={toggleSelectionMode}
              className={`text-[10px] rounded px-1.5 py-0.5 border cursor-pointer inline-flex items-center gap-1 ${
                selectionMode
                  ? 'text-zinc-200 bg-zinc-700 border-zinc-600 hover:bg-zinc-600'
                  : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
              }`}
              title={selectionMode ? '선택 모드 해제 (ESC)' : '여러 라인을 한 번에 선택해서 숨김/삭제'}
            >
              {selectionMode ? '✕ 선택 종료' : '☑ 여러 줄 선택'}
            </button>
            {memorizedCount > 0 && (
              <button
                type="button"
                onClick={() => setHideMemorized((v) => !v)}
                className={`text-[10px] rounded px-1.5 py-0.5 border cursor-pointer ${
                  hideMemorized
                    ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800 hover:bg-emerald-900/60'
                    : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                }`}
                title={hideMemorized ? `외운 ${memorizedCount}개 숨김 중 — 클릭해서 다시 표시` : `외운 라인 ${memorizedCount}개 — 클릭해서 숨기기`}
              >
                {hideMemorized ? `🙈 외움 ${memorizedCount} 숨김` : `☑ 외움 ${memorizedCount}`}
              </button>
            )}
            {(needsReviewCount > 0 || showOnlyNeedsReview) && (
              <button
                type="button"
                onClick={() => setShowOnlyNeedsReview((v) => !v)}
                className={`text-[10px] rounded px-1.5 py-0.5 border cursor-pointer ${
                  showOnlyNeedsReview
                    ? 'text-amber-200 bg-amber-900/60 border-amber-700 hover:bg-amber-800/60'
                    : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                }`}
                title={
                  showOnlyNeedsReview
                    ? `검토 필요 ${needsReviewCount}개만 표시 중 — 클릭해서 전체 보기`
                    : `검토 필요 라인 ${needsReviewCount}개 — 클릭해서 이것만 보기`
                }
              >
                ⚠ 검토 {needsReviewCount}
                {showOnlyNeedsReview ? '만' : ''}
              </button>
            )}
            {(starredCount > 0 || showOnlyStarred) && (
              <button
                type="button"
                onClick={() => setShowOnlyStarred((v) => !v)}
                className={`text-[10px] rounded px-1.5 py-0.5 border cursor-pointer ${
                  showOnlyStarred
                    ? 'text-sky-200 bg-sky-900/60 border-sky-700 hover:bg-sky-800/60'
                    : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                }`}
                title={
                  showOnlyStarred
                    ? `중요 ${starredCount}개만 표시 중 — 클릭해서 전체 보기`
                    : `중요로 마크한 라인 ${starredCount}개 — 클릭해서 이것만 보기`
                }
              >
                ★ 중요 {starredCount}
                {showOnlyStarred ? '만' : ''}
              </button>
            )}
            {(hiddenCount > 0 || showHidden) && (
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className={`text-[10px] rounded px-1.5 py-0.5 border cursor-pointer ${
                  showHidden
                    ? 'text-zinc-200 bg-zinc-700 border-zinc-600 hover:bg-zinc-600'
                    : 'text-zinc-400 bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                }`}
                title={
                  showHidden
                    ? `숨긴 ${hiddenCount}개도 보는 중 (흐리게) — 클릭해서 다시 감추기`
                    : `숨긴 라인 ${hiddenCount}개 — 클릭해서 보기/해제`
                }
              >
                🙈 숨김 {hiddenCount}
                {showHidden ? ' 보는 중' : ''}
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
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-400 min-w-0 truncate">
            {hiddenCount > 0 ? (
              <>
                {studyLines.toLocaleString()} lines
                <span className="text-zinc-500"> (전체 {totalLines.toLocaleString()})</span>
              </>
            ) : (
              <>{totalLines.toLocaleString()} lines</>
            )}
            <span className="text-emerald-400/90 ml-2">
              · ☑외움 {memorizedCount} ({memorizedPercent}%)
            </span>
            {editedCount > 0 && (
              <span className="text-amber-400/80 ml-2">· ✎편집 {editedCount}</span>
            )}
            {userAddedCount > 0 && (
              <span className="text-purple-300 ml-2">· 👤추가 {userAddedCount}</span>
            )}
          </p>
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="text-[10px] rounded px-1.5 py-0.5 border text-zinc-400 bg-zinc-900 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 cursor-pointer"
              title="단축키 목록 보기"
            >
              ⌨ 단축키
            </button>
            <button
              type="button"
              onClick={() => setProgressOpen(true)}
              className="text-[10px] rounded px-1.5 py-0.5 border text-amber-300 bg-zinc-900 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 cursor-pointer"
              title="오늘 진도 + 스트릭 보기"
            >
              🔥 {streak?.currentStreak ?? 0}
            </button>
          </div>
        </div>
      </header>

      {selectionMode && (
        <div className="px-4 py-2 border-b border-zinc-700 bg-zinc-800/60 text-xs flex items-center gap-2 flex-wrap">
          <span className="text-zinc-100 font-semibold">
            ✓ {selectedLineIds.size}개 선택됨
          </span>
          <button
            type="button"
            onClick={selectAllVisible}
            className="px-2 py-0.5 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded cursor-pointer"
          >
            전체
          </button>
          <button
            type="button"
            onClick={deselectAll}
            disabled={selectedLineIds.size === 0}
            className="px-2 py-0.5 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded cursor-pointer disabled:opacity-50"
          >
            해제
          </button>
          <button
            type="button"
            onClick={() => void bulkHideSelected()}
            disabled={selectedLineIds.size === 0 || bulkDeleting}
            className="ml-auto px-3 py-0.5 text-zinc-100 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
            title="선택한 라인을 목록에서 숨김 (되돌리기 가능)"
          >
            <EyeOffIcon className="w-3.5 h-3.5" />
            선택 숨김
          </button>
          <button
            type="button"
            onClick={() => setConfirmBulkDelete(true)}
            disabled={selectedLineIds.size === 0}
            className="px-3 py-0.5 text-white bg-red-700 hover:bg-red-600 rounded cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
            title="선택한 라인을 영구 삭제 (되돌리기 불가)"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            선택 삭제
          </button>
        </div>
      )}

      <CustomLoopList contentId={effectiveContentId ?? null} />

      {insertOpen && effectiveContentId != null && (
        <InsertLineModal
          contentId={effectiveContentId}
          defaultStartMs={insertDefaultStart}
          defaultEndMs={insertDefaultEnd}
          onClose={() => setInsertOpen(false)}
        />
      )}

      {shortcutsOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">⌨ 단축키</h3>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 text-lg leading-none cursor-pointer"
                title="닫기"
              >
                ×
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mb-4 leading-relaxed">
              영상 화면 또는 사이드패널에 포커스가 있을 때 동작 (라인 편집 중일 땐 일반 입력 우선).
            </p>
            <table className="text-xs w-full">
              <tbody className="text-zinc-300">
                {[
                  ['H', '한국어 자막 ON/OFF'],
                  ['E', 'English 자막 ON/OFF (둘 다 OFF면 shadowing)'],
                  ['L', '현재 라인 반복 시작/정지'],
                  ['SPACE', '영상 재생 / 일시정지'],
                  ['A', 'CustomLoop 시작점 마킹'],
                  ['B', 'CustomLoop 끝점 (자동 저장 + 반복)'],
                  ['S', '진행 중 CustomLoop에 라벨 저장'],
                  ['↑ / ↓', '이전 / 다음 라인'],
                  ['← / →', '2초 뒤로 / 앞으로'],
                  ['R', '현재 라인 처음부터 다시'],
                  ['ESC', '선택 모드 해제 / 편집 취소'],
                ].map(([key, desc]) => (
                  <tr key={key} className="border-b border-zinc-800/60 last:border-0">
                    <td className="py-1.5 pr-3 w-28">
                      <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded font-mono text-xs">
                        {key}
                      </kbd>
                    </td>
                    <td className="py-1.5 text-zinc-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteLineTarget && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteLineTarget(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-3">🗑 라인 삭제</h3>
            <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
              "<span className="text-amber-300">{deleteLineTarget.preview}</span>"
            </p>
            <p className="text-xs text-zinc-500 mb-5">
              이 라인과 해당 진도 데이터가 삭제됩니다. 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteLineTarget(null)}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteLine()}
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded cursor-pointer"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkDelete && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => !bulkDeleting && setConfirmBulkDelete(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-3">🗑 일괄 삭제</h3>
            <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
              선택한 <strong className="text-red-400">{selectedLineIds.size}개</strong>의 라인과 진도 데이터가 삭제됩니다.
            </p>
            <p className="text-xs text-zinc-500 mb-5">⚠ 되돌릴 수 없습니다.</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded cursor-pointer disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void bulkDeleteSelected()}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded cursor-pointer disabled:opacity-50"
              >
                {bulkDeleting ? '삭제 중...' : `삭제 (${selectedLineIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-3">🗑 콘텐츠 삭제</h3>
            <p className="text-sm text-zinc-300 mb-2">
              <span className="font-mono text-amber-300 break-all">
                {displayName(deleteTarget)}
              </span>
            </p>
            <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
              이 콘텐츠의 <strong className="text-red-400">자막 · 진도 · 외움 ·
              CustomLoop · 세션</strong> 데이터가 모두 삭제됩니다.
              {deleteTarget.id === effectiveContentId && totalLines > 0 && (
                <span className="block text-xs text-zinc-500 mt-1">
                  (현재 라인 {totalLines.toLocaleString()}개 + 진도 포함)
                </span>
              )}
            </p>
            <p className="text-xs text-zinc-500 mb-5">
              ⚠ 이 작업은 되돌릴 수 없습니다. 일일 목표·스트릭은 영향받지 않습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded cursor-pointer disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteContent()}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded cursor-pointer disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
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
          📺 현재 라인으로 이동
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
                onDelete={requestDeleteLine}
                progress={line.id != null ? progressMap.get(line.id) : undefined}
                isCurrent={line.id === currentLineId}
                isRepeating={line.id === repeatingLineId}
                isEditing={editingLineId === line.id}
                onEditStart={handleEditStart}
                onEditEnd={handleEditEnd}
                selectionMode={selectionMode}
                isSelected={line.id != null && selectedLineIds.has(line.id)}
                onSelectToggle={handleSelectToggle}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
