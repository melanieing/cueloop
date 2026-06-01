import { memo, useEffect, useRef, useState } from 'react';
import { db, type Line, type LineProgress } from '@/src/db';
import type { CueloopMessage } from '@/src/messages';
import { broadcastContentUpdate } from '@/src/lib/broadcastUpdate';
import { parseTimeToMs } from './InsertLineModal';

// 환경 독립적인 휴지통 아이콘 (이모지는 일부 환경에서 grayscale로 렌더링됨)
export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 3v1H4v2h16V4h-5V3H9zm-3 5v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8H6zm3 2h2v9H9v-9zm4 0h2v9h-2v-9z" />
    </svg>
  );
}

// 눈 가림(hide) 아이콘 — 목록에서 숨김 토글용 (TrashIcon과 동일하게 SVG로 통일)
export function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 5.27 3.28 4 20 20.72 18.73 22l-3.08-3.08A11.6 11.6 0 0 1 12 19.5C6.5 19.5 1.73 16 0 11c.86-2.46 2.5-4.55 4.6-5.96L2 5.27ZM12 8a3 3 0 0 1 3 3c0 .35-.06.68-.17.99L11 8.17c.31-.11.65-.17 1-.17Zm0-3.5c5.5 0 10.27 3.5 12 8.5a11.8 11.8 0 0 1-2.76 4.3l-2.85-2.85A5 5 0 0 0 12 7a4.8 4.8 0 0 0-1.06.12L8.97 5.15A11.6 11.6 0 0 1 12 4.5Z" />
    </svg>
  );
}

export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const milli = ms % 1000;
  const hh = h > 0 ? `${h}:` : '';
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const mmm = String(milli).padStart(3, '0');
  return `${hh}${mm}:${ss}.${mmm}`;
}

function progressBadge(
  progress: LineProgress | undefined,
): { color: string; star: boolean; count: number; candidate: boolean } {
  const count = progress?.listenCount ?? 0;
  const isMemorized = progress?.isMemorized === 1;
  let color = 'bg-zinc-700';
  if (count >= 100) color = 'bg-purple-500';
  else if (count >= 30) color = 'bg-blue-500';
  else if (count >= 10) color = 'bg-emerald-500';
  else if (count >= 1) color = 'bg-lime-500';
  // 외움 후보: 30회 이상 들었고 아직 외움 처리 안 한 라인
  const candidate = !isMemorized && count >= 30;
  return { color, star: isMemorized, count, candidate };
}

async function toggleMemorized(
  lineId: number,
  contentId: number,
  current: LineProgress | undefined,
): Promise<void> {
  const nextMemorized = current?.isMemorized === 1 ? 0 : 1;
  if (current) {
    await db.lineProgress.update(lineId, { isMemorized: nextMemorized });
  } else {
    await db.lineProgress.put({
      lineId,
      listenCount: 0,
      dictationAttempts: 0,
      dictationCorrect: 0,
      shadowCount: 0,
      isMemorized: nextMemorized,
    });
  }
  broadcastContentUpdate(contentId);
}

async function toggleNeedsReview(line: Line): Promise<void> {
  if (line.id == null) return;
  const next: 0 | 1 = line.needsReview === 1 ? 0 : 1;
  await db.lines.update(line.id, { needsReview: next });
  broadcastContentUpdate(line.contentId);
}

async function toggleStarred(line: Line): Promise<void> {
  if (line.id == null) return;
  const next: 0 | 1 = line.isStarred === 1 ? 0 : 1;
  await db.lines.update(line.id, { isStarred: next });
  broadcastContentUpdate(line.contentId);
}

async function toggleHidden(line: Line): Promise<void> {
  if (line.id == null) return;
  const next: 0 | 1 = line.isHidden === 1 ? 0 : 1;
  await db.lines.update(line.id, { isHidden: next });
  broadcastContentUpdate(line.contentId);
}

function LineRowImpl({
  line,
  index,
  onJump,
  onLoop,
  onStopRepeat,
  onDelete,
  progress,
  isCurrent,
  isRepeating,
  isEditing,
  onEditStart,
  onEditEnd,
  selectionMode,
  isSelected,
  onSelectToggle,
}: {
  line: Line;
  index: number;
  onJump: (startMs: number) => void;
  onLoop: (lineId: number) => void;
  onStopRepeat: () => void;
  onDelete: (lineId: number, preview: string, contentId: number) => void;
  progress?: LineProgress;
  isCurrent?: boolean;
  isRepeating?: boolean;
  isEditing: boolean;
  onEditStart: (lineId: number) => void;
  onEditEnd: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  onSelectToggle: (lineId: number) => void;
}) {
  // 선택 모드 중엔 편집 모드 진입 막음 (선택 토글 우선)
  if (!isEditing || selectionMode) {
    return (
      <ReadOnlyRow
        line={line}
        index={index}
        onEnterEdit={() => {
          if (selectionMode) {
            if (line.id != null) onSelectToggle(line.id);
          } else if (line.id != null) {
            onEditStart(line.id);
          }
        }}
        onJump={onJump}
        onLoop={onLoop}
        onStopRepeat={onStopRepeat}
        onDelete={onDelete}
        progress={progress}
        isCurrent={isCurrent}
        isRepeating={isRepeating}
        selectionMode={selectionMode}
        isSelected={isSelected}
      />
    );
  }
  return (
    <EditRow
      line={line}
      index={index}
      onDone={onEditEnd}
      onDelete={onDelete}
    />
  );
}

export const LineRow = memo(LineRowImpl, (prev, next) => {
  return (
    prev.line === next.line &&
    prev.index === next.index &&
    prev.onJump === next.onJump &&
    prev.onLoop === next.onLoop &&
    prev.onStopRepeat === next.onStopRepeat &&
    prev.onDelete === next.onDelete &&
    prev.isCurrent === next.isCurrent &&
    prev.isRepeating === next.isRepeating &&
    prev.isEditing === next.isEditing &&
    prev.onEditStart === next.onEditStart &&
    prev.onEditEnd === next.onEditEnd &&
    prev.selectionMode === next.selectionMode &&
    prev.isSelected === next.isSelected &&
    prev.onSelectToggle === next.onSelectToggle &&
    (prev.progress?.listenCount ?? 0) === (next.progress?.listenCount ?? 0) &&
    (prev.progress?.isMemorized ?? 0) === (next.progress?.isMemorized ?? 0)
  );
});

function ReadOnlyRow({
  line,
  index,
  onEnterEdit,
  onJump,
  onLoop,
  onStopRepeat,
  onDelete,
  progress,
  isCurrent,
  isRepeating,
  selectionMode,
  isSelected,
}: {
  line: Line;
  index: number;
  onEnterEdit: () => void;
  onJump: (startMs: number) => void;
  onLoop: (lineId: number) => void;
  onStopRepeat: () => void;
  onDelete: (lineId: number, preview: string, contentId: number) => void;
  progress?: LineProgress;
  isCurrent?: boolean;
  isRepeating?: boolean;
  selectionMode: boolean;
  isSelected: boolean;
}) {
  const isUserAdded = line.source === 'user';
  const wasEdited = !!line.editedAt;
  const needsReview = line.needsReview === 1;
  const isStarred = line.isStarred === 1;
  const isHidden = line.isHidden === 1;
  const badge = progressBadge(progress);
  // 좌측 border 우선순위: 검토(amber) > 중요(sky) > 사용자추가(purple)
  const leftBorder = needsReview
    ? 'border-l-4 border-l-amber-500'
    : isStarred
      ? 'border-l-4 border-l-sky-400'
      : isUserAdded
        ? 'border-l-4 border-l-purple-500'
        : '';
  return (
    <div
      className={`group px-4 py-3 border-b border-zinc-800 ${
        isSelected
          ? 'bg-zinc-700/40 ring-2 ring-zinc-400/60'
          : isCurrent
            ? 'bg-blue-900/40 ring-2 ring-blue-400/70'
            : 'hover:bg-zinc-900/50'
      } ${leftBorder} ${isHidden ? 'opacity-45' : ''}`}
    >
      <div
        className="flex items-baseline gap-2 mb-1 text-xs font-mono cursor-pointer text-zinc-400 hover:text-blue-400"
        onClick={(e) => {
          e.stopPropagation();
          onJump(line.startMs);
        }}
        title={
          badge.count > 0
            ? `들은 횟수: ${badge.count}${badge.star ? ' · 외움 ★' : ''}`
            : '아직 안 들음 — 클릭해서 이 시점부터 영상 재생'
        }
      >
        {selectionMode ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEnterEdit(); // selectionMode일 때 LineRowImpl이 onSelectToggle로 매핑됨
            }}
            className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 cursor-pointer ${
              isSelected
                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500'
                : 'bg-zinc-900 border-zinc-600 hover:border-zinc-400'
            }`}
            aria-label={isSelected ? '선택 해제' : '선택'}
            title={isSelected ? '선택 해제' : '이 라인 선택'}
          >
            {isSelected && <span className="text-[10px] leading-none">✓</span>}
          </button>
        ) : (
          <span
            className={`inline-block w-2 h-2 rounded-full ${badge.color} shrink-0`}
            aria-label={`progress ${badge.count}`}
          ></span>
        )}
        <span className="text-blue-500">▶</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isRepeating) {
              onStopRepeat();
            } else if (line.id != null) {
              onLoop(line.id);
            }
          }}
          className={`leading-none cursor-pointer ${
            isRepeating
              ? 'text-red-400 hover:text-red-300'
              : 'text-amber-400 hover:text-amber-300'
          }`}
          title={isRepeating ? '반복 정지' : '이 라인 반복 재생 (L 키와 동일)'}
        >
          {isRepeating ? '⏹' : '🔁'}
        </button>
        <span className="text-zinc-600">#{index + 1}</span>
        <span>{formatTime(line.startMs)}</span>
        <span className="text-zinc-700">→</span>
        <span>{formatTime(line.endMs)}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {badge.candidate && (
            <span
              className="text-[10px] text-amber-300 font-semibold animate-pulse"
              title="30회 이상 들음 — 외운 라인 후보. 외웠으면 ☐ 클릭해서 체크"
            >
              ✨ 외움?
            </span>
          )}
          {badge.count > 0 && (
            <span
              className="text-[10px] text-zinc-400 font-semibold"
              title={`100LS 카운터: ${badge.count}`}
            >
              {badge.count}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleNeedsReview(line);
            }}
            className={`text-sm leading-none px-1 cursor-pointer ${
              needsReview
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-zinc-600 hover:text-amber-400'
            }`}
            title={
              needsReview
                ? '검토 마크 해제 (자막 확인 완료)'
                : '자막이 부정확함 — 검토 필요로 마크'
            }
          >
            ⚠
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleStarred(line);
            }}
            className={`text-sm leading-none px-1 cursor-pointer ${
              isStarred
                ? 'text-sky-400 hover:text-sky-300'
                : 'text-zinc-600 hover:text-sky-400'
            }`}
            title={
              isStarred
                ? '중요 마크 해제'
                : '몰랐던 단어/표현 — 중요로 마크 (다시 볼 라인)'
            }
          >
            ★
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (line.id != null) {
                void toggleMemorized(line.id, line.contentId, progress);
              }
            }}
            className={`text-base leading-none px-1 cursor-pointer ${
              badge.star
                ? 'text-emerald-400 hover:text-emerald-300'
                : badge.candidate
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-zinc-600 hover:text-emerald-400'
            }`}
            title={badge.star ? '외움 해제' : badge.candidate ? '외움 후보 — 클릭해서 외움 완료' : '외움 완료로 체크'}
          >
            {badge.star ? '☑' : '☐'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleHidden(line);
            }}
            className={`leading-none px-1 cursor-pointer ${
              isHidden
                ? 'text-zinc-300 hover:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-300'
            }`}
            title={
              isHidden
                ? '숨김 해제 (목록에 다시 표시)'
                : '목록에서 숨기기 (노래 가사 등 — 삭제 아님)'
            }
          >
            <EyeOffIcon className="w-3.5 h-3.5 inline-block" />
          </button>
          {isUserAdded && (
            <span
              className="text-[10px] text-purple-300 bg-purple-950/60 border border-purple-800 rounded px-1.5 py-0.5"
              title="사용자가 추가한 라인"
            >
              사용자
            </span>
          )}
          {wasEdited && (
            <span
              className="text-amber-400 text-sm"
              title={`편집됨: ${new Date(line.editedAt!).toLocaleString('ko-KR')}`}
            >
              ✎
            </span>
          )}
          {!selectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (line.id == null) return;
                const preview = (line.textEn || line.textKo || '(빈 라인)').slice(0, 60);
                onDelete(line.id, preview, line.contentId);
              }}
              className="opacity-0 group-hover:opacity-70 hover:opacity-100! text-zinc-400 hover:text-red-400 cursor-pointer transition-opacity p-0.5"
              title="이 라인 삭제"
              tabIndex={-1}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </span>
      </div>
      <div
        className="cursor-text"
        onClick={onEnterEdit}
        title="클릭해서 텍스트 편집"
      >
        <div className="text-sm text-zinc-100 leading-snug whitespace-pre-wrap wrap-break-word">
          {line.textEn || <span className="text-zinc-600 italic">(no English)</span>}
        </div>
        <div className="text-sm text-zinc-400 leading-snug whitespace-pre-wrap wrap-break-word mt-1">
          {line.textKo || <span className="text-zinc-700 italic">(번역 없음)</span>}
        </div>
        {line.note && (
          <div className="text-xs text-amber-400/80 leading-snug whitespace-pre-wrap wrap-break-word mt-1">
            📝 {line.note}
          </div>
        )}
      </div>
    </div>
  );
}

function EditRow({
  line,
  index,
  onDone,
  onDelete,
}: {
  line: Line;
  index: number;
  onDone: () => void;
  onDelete: (lineId: number, preview: string, contentId: number) => void;
}) {
  const [textEn, setTextEn] = useState(line.textEn);
  const [textKo, setTextKo] = useState(line.textKo);
  const [note, setNote] = useState(line.note ?? '');
  const [startInput, setStartInput] = useState(formatTime(line.startMs));
  const [endInput, setEndInput] = useState(formatTime(line.endMs));
  const [needsReview, setNeedsReview] = useState<0 | 1>(line.needsReview === 1 ? 1 : 0);
  const [isStarred, setIsStarred] = useState<0 | 1>(line.isStarred === 1 ? 1 : 0);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // preventScroll: true — focus 시 브라우저 native scroll 차단
    // (EditRow mount의 큰 layout 변경과 자동 scrollIntoView가 한 frame에 충돌해 freeze 유발)
    firstFieldRef.current?.focus({ preventScroll: true });
    firstFieldRef.current?.select();
  }, []);

  const dirty =
    textEn !== line.textEn ||
    textKo !== line.textKo ||
    (note || '') !== (line.note ?? '') ||
    startInput !== formatTime(line.startMs) ||
    endInput !== formatTime(line.endMs) ||
    needsReview !== (line.needsReview === 1 ? 1 : 0) ||
    isStarred !== (line.isStarred === 1 ? 1 : 0);

  async function save() {
    if (!line.id || !dirty) {
      onDone();
      return;
    }
    const newStartMs = parseTimeToMs(startInput);
    const newEndMs = parseTimeToMs(endInput);
    if (newStartMs == null || newEndMs == null) {
      setTimeError('시각 형식이 올바르지 않습니다 (예: 01:23.456 또는 ms 숫자)');
      return;
    }
    if (newEndMs <= newStartMs) {
      setTimeError('종료 시각은 시작 시각보다 커야 합니다');
      return;
    }
    setTimeError(null);
    setBusy(true);
    try {
      await db.lines.update(line.id, {
        textEn,
        textKo,
        note: note.trim() || undefined,
        startMs: newStartMs,
        endMs: newEndMs,
        needsReview,
        isStarred,
        editedAt: Date.now(),
      });
      broadcastContentUpdate(line.contentId);
    } finally {
      setBusy(false);
      onDone();
    }
  }

  function requestDelete() {
    if (line.id == null) return;
    const preview = (line.textEn || line.textKo || '(빈 라인)').slice(0, 60);
    // 편집창 닫고 사이드패널의 in-page confirm 모달로 위임 (ReadOnlyRow hover trash와 동일 UX)
    onDone();
    onDelete(line.id, preview, line.contentId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onDone();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  }

  async function fillFromVideo(target: 'start' | 'end') {
    const msg: CueloopMessage = {
      type: 'GET_CURRENT_VIDEO_TIME',
      payload: { contentId: line.contentId },
    };
    try {
      const resp = (await browser.runtime.sendMessage(msg)) as
        | { ok?: boolean; timeMs?: number; error?: string }
        | undefined;
      if (resp?.ok && typeof resp.timeMs === 'number') {
        const formatted = formatTime(resp.timeMs);
        if (target === 'start') setStartInput(formatted);
        else setEndInput(formatted);
        setTimeError(null);
      } else {
        setTimeError(resp?.error ?? '영상 시각을 가져올 수 없음');
      }
    } catch (err) {
      setTimeError(String(err));
    }
  }

  return (
    <div
      className="px-4 py-3 border-b border-zinc-700 bg-zinc-900 ring-1 ring-blue-500/40"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-1.5 mb-2 text-xs text-zinc-500 font-mono flex-wrap">
        <span className="text-zinc-600">#{index + 1}</span>
        <input
          type="text"
          value={startInput}
          onChange={(e) => {
            setStartInput(e.target.value);
            setTimeError(null);
          }}
          className="w-24 bg-zinc-950 text-zinc-200 rounded px-1.5 py-0.5 border border-zinc-700 focus:border-blue-500 focus:outline-none"
          title="시작 시각 (MM:SS.mmm 또는 ms)"
        />
        <button
          type="button"
          onClick={() => void fillFromVideo('start')}
          className="px-1.5 py-0.5 text-[10px] bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800 text-blue-200 rounded cursor-pointer"
          title="영상의 현재 재생 시각을 시작 시각으로"
        >
          ⏱ 지금
        </button>
        <span className="text-zinc-700">→</span>
        <input
          type="text"
          value={endInput}
          onChange={(e) => {
            setEndInput(e.target.value);
            setTimeError(null);
          }}
          className="w-24 bg-zinc-950 text-zinc-200 rounded px-1.5 py-0.5 border border-zinc-700 focus:border-blue-500 focus:outline-none"
          title="종료 시각 (MM:SS.mmm 또는 ms)"
        />
        <button
          type="button"
          onClick={() => void fillFromVideo('end')}
          className="px-1.5 py-0.5 text-[10px] bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800 text-blue-200 rounded cursor-pointer"
          title="영상의 현재 재생 시각을 종료 시각으로"
        >
          ⏱ 지금
        </button>
        <span className="ml-auto text-blue-400">편집 중</span>
      </div>
      {timeError && (
        <div className="text-[11px] text-red-400 mb-2">⚠ {timeError}</div>
      )}
      <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
        English
      </label>
      <textarea
        ref={firstFieldRef}
        value={textEn}
        onChange={(e) => setTextEn(e.target.value)}
        className="w-full bg-zinc-950 text-zinc-100 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none resize-y min-h-30"
        rows={6}
      />
      <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1 mt-2">
        한국어
      </label>
      <textarea
        value={textKo}
        onChange={(e) => setTextKo(e.target.value)}
        className="w-full bg-zinc-950 text-zinc-100 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none resize-y min-h-30"
        rows={6}
        placeholder="한국어 자막을 입력하세요"
      />
      <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1 mt-2">
        메모 (옵션)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full bg-zinc-950 text-zinc-100 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none resize-y min-h-12"
        rows={2}
        placeholder="단어 뜻, 발음 팁, 학습 메모..."
      />
      <label className="flex items-center gap-2 mt-3 cursor-pointer text-xs text-zinc-300 select-none">
        <input
          type="checkbox"
          checked={needsReview === 1}
          onChange={(e) => setNeedsReview(e.target.checked ? 1 : 0)}
          className="w-4 h-4 accent-amber-500 cursor-pointer"
        />
        <span>
          <span className="text-amber-300">⚠ 자막이 부정확함</span>
          <span className="text-zinc-500 ml-1">— 정확히 들리지 않을 때 검토용 마크</span>
        </span>
      </label>
      <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-zinc-300 select-none">
        <input
          type="checkbox"
          checked={isStarred === 1}
          onChange={(e) => setIsStarred(e.target.checked ? 1 : 0)}
          className="w-4 h-4 accent-sky-500 cursor-pointer"
        />
        <span>
          <span className="text-sky-300">★ 중요 (즐겨찾기)</span>
          <span className="text-zinc-500 ml-1">— 몰랐던 단어/표현, 다시 볼 라인</span>
        </span>
      </label>
      <div className="flex gap-2 mt-3 items-center flex-wrap">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {busy ? '...' : '저장 (Ctrl+Enter)'}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded disabled:opacity-50"
        >
          취소 (Esc)
        </button>
        <button
          type="button"
          onClick={requestDelete}
          disabled={busy}
          className="px-3 py-1 text-xs bg-red-900 hover:bg-red-800 text-red-100 rounded disabled:opacity-50 ml-auto cursor-pointer inline-flex items-center gap-1"
          title="라인 삭제"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          삭제
        </button>
      </div>
      {line.editedAt && (
        <div className="text-[10px] text-zinc-500 mt-2">
          마지막 편집: {new Date(line.editedAt).toLocaleString('ko-KR')}
        </div>
      )}
    </div>
  );
}
