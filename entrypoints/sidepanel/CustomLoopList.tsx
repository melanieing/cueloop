import { useState } from 'react';
import { db, type CustomLoop } from '@/src/db';
import type { CueloopMessage } from '@/src/messages';
import { broadcastContentUpdate } from '@/src/lib/broadcastUpdate';
import { useCustomLoops } from '@/src/hooks/useCustomLoops';
import { formatTime } from './LineRow';

interface Props {
  contentId: number | null;
}

export function CustomLoopList({ contentId }: Props) {
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
            <CustomLoopRow key={loop.id} loop={loop} contentId={contentId} />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomLoopRow({ loop, contentId }: { loop: CustomLoop; contentId: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const e = resp?.error ?? '재생 실패';
        setError(e);
        window.setTimeout(() => setError(null), 4000);
      }
    } catch (err) {
      setError(String(err));
      window.setTimeout(() => setError(null), 4000);
    }
  }

  async function rename() {
    if (loop.id == null) return;
    const input = window.prompt('CustomLoop 라벨 입력', loop.label ?? '');
    if (input === null) return;
    const trimmed = input.trim();
    setBusy(true);
    try {
      await db.customLoops.update(loop.id, { label: trimmed || undefined });
      broadcastContentUpdate(contentId);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (loop.id == null) return;
    const tag = loop.label ? `\n"${loop.label}"` : '';
    if (
      !window.confirm(
        `이 구간을 삭제할까요?\n${formatTime(loop.startMs)} → ${formatTime(loop.endMs)}${tag}`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const msg: CueloopMessage = {
        type: 'DELETE_CUSTOM_LOOP',
        payload: { loopId: loop.id },
      };
      await browser.runtime.sendMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  const isMastered = loop.listenCount >= 100;
  const counterColor = isMastered
    ? 'text-purple-300'
    : loop.listenCount >= 50
      ? 'text-emerald-400'
      : 'text-amber-300';

  return (
    <div className="px-4 py-2.5 hover:bg-purple-800/40 border-l-4 border-l-purple-500/40">
      <div className="flex items-center gap-2 mb-1 text-xs font-mono">
        <span className="text-zinc-500">{formatTime(loop.startMs)}</span>
        <span className="text-zinc-700">→</span>
        <span className="text-zinc-500">{formatTime(loop.endMs)}</span>
        <span className={`ml-auto font-bold ${counterColor}`}>
          🔁 {loop.listenCount}
        </span>
      </div>
      {loop.label ? (
        <div className="text-sm text-zinc-100 mb-1.5 leading-snug">{loop.label}</div>
      ) : (
        <div className="text-xs text-zinc-500 italic mb-1.5">(라벨 없음)</div>
      )}
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
          onClick={() => void rename()}
          disabled={busy}
          className="px-2 py-0.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded disabled:opacity-50"
        >
          ✎ 라벨
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="px-2 py-0.5 text-xs bg-red-900 hover:bg-red-800 text-red-100 rounded disabled:opacity-50 ml-auto"
        >
          🗑
        </button>
      </div>
      {error && (
        <div className="mt-1 text-[10px] text-red-400">{error}</div>
      )}
    </div>
  );
}
