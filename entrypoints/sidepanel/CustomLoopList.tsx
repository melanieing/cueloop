import { useState } from 'react';
import { db, type CustomLoop } from '@/src/db';
import type { CueloopMessage } from '@/src/messages';
import { broadcastContentUpdate } from '@/src/lib/broadcastUpdate';
import { useCustomLoops } from '@/src/hooks/useCustomLoops';
import { deriveLoopLabel } from '@/src/lib/customLoopLabel';
import { formatTime } from './LineRow';

interface Props {
  contentId: number | null;
  /** 지금 오버레이에서 반복 중인 구간 (없으면 null) */
  repeatingLoopId: number | null;
}

export function CustomLoopList({ contentId, repeatingLoopId }: Props) {
  const loops = useCustomLoops(contentId ?? undefined);
  const [expanded, setExpanded] = useState(true);

  if (contentId == null || !loops || loops.length === 0) return null;

  return (
    <div className="border-b border-zinc-700 bg-purple-900/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 text-left flex items-center justify-between text-sm text-zinc-200 hover:bg-purple-800/40 cursor-pointer"
      >
        <span>
          🔁 <span className="font-semibold">내 구간</span>{' '}
          <span className="text-zinc-500 ml-1">({loops.length})</span>
        </span>
        <span className="text-zinc-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="divide-y divide-zinc-800/60 max-h-72 overflow-auto">
          {loops.map((loop) => (
            <CustomLoopRow
              key={loop.id}
              loop={loop}
              contentId={contentId}
              isRepeating={loop.id != null && loop.id === repeatingLoopId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomLoopRow({
  loop,
  contentId,
  isRepeating,
}: {
  loop: CustomLoop;
  contentId: number;
  isRepeating: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // window.confirm/prompt 금지 — Chrome의 "이 페이지에서 추가 대화를 표시하지 않도록 하기"를
  // 한 번 체크하면 이후 confirm은 즉시 false, prompt는 즉시 null을 반환한다. 그러면 삭제·라벨
  // 수정이 아무 반응 없이 안 먹고 되돌릴 방법도 눈에 안 보인다 (troubleshooting #30).
  // → 확인/입력은 전부 패널 안에서 처리한다.
  const [mode, setMode] = useState<'idle' | 'confirm' | 'label'>('idle');
  const [labelDraft, setLabelDraft] = useState('');

  async function play() {
    if (loop.id == null) return;
    setError(null);
    const msg: CueloopMessage = {
      type: 'PLAY_CUSTOM_LOOP',
      payload: { loopId: loop.id },
    };
    try {
      const resp = (await browser.runtime.sendMessage(msg)) as
        | { ok?: boolean; error?: string }
        | undefined;
      if (!resp?.ok) {
        setError(resp?.error ?? '재생 실패');
      }
    } catch (err) {
      setError(String(err));
    }
  }

  async function startLabelEdit() {
    // 라벨이 없으면(이 기능 전에 만든 구간 포함) 첫 영어 자막을 기본값으로 채워준다.
    const initial =
      loop.label ??
      (await deriveLoopLabel(contentId, loop.startMs, loop.endMs)) ??
      '';
    setLabelDraft(initial);
    setMode('label');
  }

  async function saveLabel() {
    if (loop.id == null) return;
    const trimmed = labelDraft.trim();
    setBusy(true);
    try {
      await db.customLoops.update(loop.id, { label: trimmed || undefined });
      broadcastContentUpdate(contentId);
      setMode('idle');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (loop.id == null) return;
    setBusy(true);
    setError(null);
    try {
      const msg: CueloopMessage = {
        type: 'DELETE_CUSTOM_LOOP',
        payload: { loopId: loop.id },
      };
      await browser.runtime.sendMessage(msg);
      // 성공하면 useCustomLoops 갱신으로 이 행 자체가 사라진다.
    } catch (err) {
      setError(`삭제 실패: ${String(err)}`);
      window.setTimeout(() => setError(null), 4000);
    } finally {
      setBusy(false);
      setMode('idle');
    }
  }

  const isMastered = loop.listenCount >= 100;
  const counterColor = isMastered
    ? 'text-purple-300'
    : loop.listenCount >= 50
      ? 'text-emerald-400'
      : 'text-amber-300';

  return (
    <div
      className={
        isRepeating
          ? 'px-4 py-2.5 bg-purple-700/40 border-l-4 border-l-purple-300'
          : 'px-4 py-2.5 hover:bg-purple-800/40 border-l-4 border-l-purple-500/40'
      }
    >
      <div className="flex items-center gap-2 mb-1 text-xs font-mono">
        {isRepeating && (
          <span
            className="text-purple-200 not-italic animate-pulse"
            title="지금 반복 중"
          >
            🔁
          </span>
        )}
        <span className="text-zinc-500">{formatTime(loop.startMs)}</span>
        <span className="text-zinc-700">→</span>
        <span className="text-zinc-500">{formatTime(loop.endMs)}</span>
        <span className={`ml-auto font-bold ${counterColor}`}>
          🔁 {loop.listenCount}
        </span>
      </div>
      {loop.label ? (
        <div
          className={`text-sm mb-1.5 leading-snug ${
            isRepeating ? 'text-white font-semibold' : 'text-zinc-100'
          }`}
        >
          {loop.label}
        </div>
      ) : (
        <div className="text-xs text-zinc-500 italic mb-1.5">(라벨 없음)</div>
      )}
      {mode === 'label' ? (
        <div className="flex gap-1.5 items-center">
          <input
            autoFocus
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveLabel();
              else if (e.key === 'Escape') setMode('idle');
            }}
            placeholder="구간 라벨"
            className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-zinc-900 border border-zinc-600 rounded text-zinc-100"
          />
          <button
            type="button"
            onClick={() => void saveLabel()}
            disabled={busy}
            className="px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            취소
          </button>
        </div>
      ) : mode === 'confirm' ? (
        <div className="flex gap-1.5 items-center">
          <span className="text-xs text-red-200 flex-1 leading-snug">
            이 구간을 삭제할까요?
          </span>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="px-2 py-0.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded font-semibold disabled:opacity-50"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            취소
          </button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void play()}
            disabled={busy}
            className="px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
          >
            ▶ 재생
          </button>
          <button
            type="button"
            onClick={() => void startLabelEdit()}
            disabled={busy}
            className="px-2 py-0.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded disabled:opacity-50"
          >
            ✎ 라벨
          </button>
          <button
            type="button"
            onClick={() => setMode('confirm')}
            disabled={busy}
            className="px-2 py-0.5 text-xs bg-red-900 hover:bg-red-800 text-red-100 rounded disabled:opacity-50 ml-auto"
          >
            🗑
          </button>
        </div>
      )}
      {error && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded border border-red-700 bg-red-950/80 px-2 py-1 text-[11px] leading-snug text-red-200">
          <span className="shrink-0">⚠</span>
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 text-red-400 hover:text-red-100"
            title="닫기"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
