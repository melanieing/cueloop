import { memo, useEffect, useRef, useState } from 'react';
import { db, type Line, type LineProgress } from '@/src/db';
import { broadcastContentUpdate } from '@/src/lib/broadcastUpdate';
import { parseTimeToMs } from './InsertLineModal';

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

function LineRowImpl({
  line,
  index,
  onJump,
  onLoop,
  onStopRepeat,
  progress,
  isCurrent,
  isRepeating,
  isEditing,
  onEditStart,
  onEditEnd,
}: {
  line: Line;
  index: number;
  onJump: (startMs: number) => void;
  onLoop: (lineId: number) => void;
  onStopRepeat: () => void;
  progress?: LineProgress;
  isCurrent?: boolean;
  isRepeating?: boolean;
  isEditing: boolean;
  onEditStart: (lineId: number) => void;
  onEditEnd: () => void;
}) {
  if (!isEditing) {
    return (
      <ReadOnlyRow
        line={line}
        index={index}
        onEnterEdit={() => {
          if (line.id != null) onEditStart(line.id);
        }}
        onJump={onJump}
        onLoop={onLoop}
        onStopRepeat={onStopRepeat}
        progress={progress}
        isCurrent={isCurrent}
        isRepeating={isRepeating}
      />
    );
  }
  return <EditRow line={line} index={index} onDone={onEditEnd} />;
}

export const LineRow = memo(LineRowImpl, (prev, next) => {
  return (
    prev.line === next.line &&
    prev.index === next.index &&
    prev.onJump === next.onJump &&
    prev.onLoop === next.onLoop &&
    prev.onStopRepeat === next.onStopRepeat &&
    prev.isCurrent === next.isCurrent &&
    prev.isRepeating === next.isRepeating &&
    prev.isEditing === next.isEditing &&
    prev.onEditStart === next.onEditStart &&
    prev.onEditEnd === next.onEditEnd &&
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
  progress,
  isCurrent,
  isRepeating,
}: {
  line: Line;
  index: number;
  onEnterEdit: () => void;
  onJump: (startMs: number) => void;
  onLoop: (lineId: number) => void;
  onStopRepeat: () => void;
  progress?: LineProgress;
  isCurrent?: boolean;
  isRepeating?: boolean;
}) {
  const isUserAdded = line.source === 'user';
  const wasEdited = !!line.editedAt;
  const badge = progressBadge(progress);
  return (
    <div
      className={`px-4 py-3 border-b border-zinc-800 ${
        isCurrent ? 'bg-blue-900/40 ring-2 ring-blue-400/70' : 'hover:bg-zinc-900/50'
      } ${isUserAdded ? 'border-l-4 border-l-purple-500' : ''}`}
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
        <span
          className={`inline-block w-2 h-2 rounded-full ${badge.color} shrink-0`}
          aria-label={`progress ${badge.count}`}
        ></span>
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
              if (line.id != null) {
                void toggleMemorized(line.id, line.contentId, progress);
              }
            }}
            className={`text-base leading-none px-1 ${
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
}: {
  line: Line;
  index: number;
  onDone: () => void;
}) {
  const [textEn, setTextEn] = useState(line.textEn);
  const [textKo, setTextKo] = useState(line.textKo);
  const [note, setNote] = useState(line.note ?? '');
  const [startInput, setStartInput] = useState(formatTime(line.startMs));
  const [endInput, setEndInput] = useState(formatTime(line.endMs));
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
    endInput !== formatTime(line.endMs);

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
        editedAt: Date.now(),
      });
      broadcastContentUpdate(line.contentId);
    } finally {
      setBusy(false);
      onDone();
    }
  }

  async function remove() {
    if (!line.id) return;
    const preview = (line.textEn || line.textKo || '(빈 라인)').slice(0, 40);
    if (!confirm(`#${index + 1} 라인을 삭제할까요?\n\n"${preview}..."\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    setBusy(true);
    try {
      await db.lines.delete(line.id);
      broadcastContentUpdate(line.contentId);
    } finally {
      setBusy(false);
      onDone();
    }
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

  return (
    <div
      className="px-4 py-3 border-b border-zinc-700 bg-zinc-900 ring-1 ring-blue-500/40"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500 font-mono">
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
        className="w-full bg-zinc-950 text-zinc-100 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none resize-y min-h-10"
        rows={2}
      />
      <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1 mt-2">
        한국어
      </label>
      <textarea
        value={textKo}
        onChange={(e) => setTextKo(e.target.value)}
        className="w-full bg-zinc-950 text-zinc-100 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none resize-y min-h-10"
        rows={2}
        placeholder="한국어 자막을 입력하세요"
      />
      <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1 mt-2">
        메모 (옵션)
      </label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full bg-zinc-950 text-zinc-100 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none"
        placeholder="단어 뜻, 발음 팁, 학습 메모..."
      />
      <div className="flex gap-2 mt-3 items-center flex-wrap">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {busy ? '...' : dirty ? '저장 (Ctrl+Enter)' : '닫기'}
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
          onClick={() => void remove()}
          disabled={busy}
          className="px-3 py-1 text-xs bg-red-900 hover:bg-red-800 text-red-100 rounded disabled:opacity-50 ml-auto"
          title="라인 삭제"
        >
          🗑 삭제
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
