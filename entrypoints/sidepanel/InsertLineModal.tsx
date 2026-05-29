import { useEffect, useRef, useState } from 'react';
import { db, type Line } from '@/src/db';
import type { CueloopMessage } from '@/src/messages';
import { broadcastContentUpdate } from '@/src/lib/broadcastUpdate';
import { formatTime } from './LineRow';

export function parseTimeToMs(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!m) return null;
  const [, h = '0', mm, ss, mmm = '0'] = m;
  const ms = parseInt(mmm.padEnd(3, '0').slice(0, 3), 10);
  return (
    parseInt(h, 10) * 3600000 +
    parseInt(mm, 10) * 60000 +
    parseInt(ss, 10) * 1000 +
    ms
  );
}

interface Props {
  contentId: number;
  defaultStartMs: number;
  defaultEndMs: number;
  onClose: () => void;
}

export function InsertLineModal({ contentId, defaultStartMs, defaultEndMs, onClose }: Props) {
  const [startInput, setStartInput] = useState(formatTime(defaultStartMs));
  const [endInput, setEndInput] = useState(formatTime(defaultEndMs));
  const [textEn, setTextEn] = useState('');
  const [textKo, setTextKo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    firstFieldRef.current?.select();
  }, []);

  async function fillFromVideo(target: 'start' | 'end') {
    const msg: CueloopMessage = {
      type: 'GET_CURRENT_VIDEO_TIME',
      payload: { contentId },
    };
    try {
      const resp = (await browser.runtime.sendMessage(msg)) as
        | { ok?: boolean; timeMs?: number; error?: string }
        | undefined;
      if (resp?.ok && typeof resp.timeMs === 'number') {
        const formatted = formatTime(resp.timeMs);
        if (target === 'start') setStartInput(formatted);
        else setEndInput(formatted);
        setError(null);
      } else {
        setError(resp?.error ?? '영상 시각을 가져올 수 없음');
      }
    } catch (err) {
      setError(String(err));
    }
  }

  async function save() {
    const startMs = parseTimeToMs(startInput);
    const endMs = parseTimeToMs(endInput);
    if (startMs == null || endMs == null) {
      setError('시간 형식이 잘못됐어요. 예: 01:23.456 또는 ms 숫자');
      return;
    }
    if (endMs <= startMs) {
      setError('끝 시간이 시작 시간보다 커야 합니다');
      return;
    }
    if (!textEn.trim() && !textKo.trim()) {
      setError('영어 또는 한국어 자막 중 하나는 입력해주세요');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const newLine: Omit<Line, 'id'> = {
        contentId,
        seq: 0,
        startMs,
        endMs,
        textEn: textEn.trim(),
        textKo: textKo.trim(),
        note: note.trim() || undefined,
        source: 'user',
        editedAt: Date.now(),
      };
      await db.lines.add(newLine as Line);
      broadcastContentUpdate(contentId);
      onClose();
    } catch (err) {
      setError(`저장 실패: ${String(err)}`);
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-zinc-100 mb-3">새 라인 추가</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Netflix가 놓친 대사나 추가하고 싶은 학습 구간을 직접 입력하세요.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
              시작
            </label>
            <div className="flex gap-1">
              <input
                ref={firstFieldRef}
                type="text"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-950 text-zinc-100 text-sm font-mono rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                placeholder="01:23.456"
              />
              <button
                type="button"
                onClick={() => void fillFromVideo('start')}
                className="px-1.5 py-0.5 text-[10px] bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800 text-blue-200 rounded cursor-pointer whitespace-nowrap"
                title="영상의 현재 재생 시각을 시작 시각으로"
              >
                ⏱ 지금
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
              끝
            </label>
            <div className="flex gap-1">
              <input
                type="text"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-950 text-zinc-100 text-sm font-mono rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                placeholder="01:25.000"
              />
              <button
                type="button"
                onClick={() => void fillFromVideo('end')}
                className="px-1.5 py-0.5 text-[10px] bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800 text-blue-200 rounded cursor-pointer whitespace-nowrap"
                title="영상의 현재 재생 시각을 종료 시각으로"
              >
                ⏱ 지금
              </button>
            </div>
          </div>
        </div>

        <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
          English
        </label>
        <textarea
          value={textEn}
          onChange={(e) => setTextEn(e.target.value)}
          className="w-full bg-zinc-950 text-zinc-100 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none mb-2"
          rows={2}
        />

        <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
          한국어
        </label>
        <textarea
          value={textKo}
          onChange={(e) => setTextKo(e.target.value)}
          className="w-full bg-zinc-950 text-zinc-100 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none mb-2"
          rows={2}
        />

        <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
          메모 (옵션)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full bg-zinc-950 text-zinc-100 text-sm rounded px-2 py-1.5 border border-zinc-700 focus:border-blue-500 focus:outline-none"
        />

        {error && (
          <div className="mt-3 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded p-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-4 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded disabled:opacity-50"
          >
            취소 (Esc)
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {saving ? '저장 중...' : '추가 (Ctrl+Enter)'}
          </button>
        </div>
      </div>
    </div>
  );
}
