import { useEffect, useMemo, useRef, useState } from 'react';
import type { Line } from '@/src/db';
import type { CueloopMessage } from '@/src/messages';

interface OverlayProps {
  video: HTMLVideoElement;
}

function currentMovieIdFromUrl(): string | null {
  const m = location.pathname.match(/^\/watch\/(\d+)/);
  return m ? m[1] : null;
}

function formatTime(ms: number): string {
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

async function fetchLinesFor(movieId: string): Promise<Line[]> {
  const msg: CueloopMessage = {
    type: 'GET_LINES_FOR_MOVIE',
    payload: { movieId },
  };
  try {
    const resp = (await browser.runtime.sendMessage(msg)) as
      | { ok?: boolean; lines?: Line[] }
      | undefined;
    return resp?.lines ?? [];
  } catch {
    return [];
  }
}

function incrementListen(lineId: number): void {
  const msg: CueloopMessage = {
    type: 'INCREMENT_LINE_LISTEN',
    payload: { lineId },
  };
  void browser.runtime.sendMessage(msg).catch(() => {});
}

function incrementCustomLoopListen(loopId: number): void {
  const msg: CueloopMessage = {
    type: 'INCREMENT_CUSTOM_LOOP_LISTEN',
    payload: { loopId },
  };
  void browser.runtime.sendMessage(msg).catch(() => {});
}

async function addCustomLoop(
  movieId: string,
  startMs: number,
  endMs: number,
): Promise<number | null> {
  const msg: CueloopMessage = {
    type: 'ADD_CUSTOM_LOOP',
    payload: { movieId, startMs, endMs },
  };
  try {
    const resp = (await browser.runtime.sendMessage(msg)) as
      | { ok?: boolean; loopId?: number }
      | undefined;
    return resp?.ok && resp.loopId != null ? resp.loopId : null;
  } catch {
    return null;
  }
}

async function updateCustomLoopLabel(loopId: number, label: string): Promise<void> {
  const msg: CueloopMessage = {
    type: 'UPDATE_CUSTOM_LOOP_LABEL',
    payload: { loopId, label },
  };
  await browser.runtime.sendMessage(msg).catch(() => {});
}

function netflixSeek(startMs: number): void {
  const id = `overlay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  window.dispatchEvent(
    new CustomEvent('cueloop/jump', { detail: { id, startMs } }),
  );
}

function computeDisplayEndMs(lines: Line[], idx: number): number {
  if (idx < 0 || idx >= lines.length) return 0;
  const line = lines[idx];
  if (idx === lines.length - 1) return line.endMs + 5000;
  return lines[idx + 1].startMs;
}

function findCurrentLineIdx(lines: Line[], timeMs: number): number {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let candidateIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].startMs <= timeMs) {
      candidateIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (candidateIdx === -1) return -1;
  const displayEndMs = computeDisplayEndMs(lines, candidateIdx);
  if (timeMs > displayEndMs) return -1;
  return candidateIdx;
}

function findCurrentLine(lines: Line[], timeMs: number): Line | null {
  const idx = findCurrentLineIdx(lines, timeMs);
  return idx === -1 ? null : lines[idx];
}

function isTypingInInput(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

// 라인 반복 종료 시점은 line.endMs(사용자가 편집한 값)를 직접 사용.
// 자막 *표시* 연장(line.endMs ~ 다음 라인 startMs)은 findCurrentLineIdx에서 별도 처리.
type RepeatingLine = { kind: 'line'; line: Line };
type RepeatingCustom = {
  kind: 'custom';
  loopId: number;
  startMs: number;
  endMs: number;
  label?: string;
};
type Repeating = RepeatingLine | RepeatingCustom;

export function Overlay({ video }: OverlayProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [currentLine, setCurrentLine] = useState<Line | null>(null);
  const [showKorean, setShowKorean] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastText, setToastText] = useState('');
  const [repeating, setRepeating] = useState<Repeating | null>(null);
  const [repeatCount, setRepeatCount] = useState(0);
  const [pendingStartMs, setPendingStartMs] = useState<number | null>(null);

  const linesRef = useRef<Line[]>([]);
  const currentLineRef = useRef<Line | null>(null);
  const repeatingRef = useRef<Repeating | null>(null);
  const repeatCountRef = useRef(0);
  const lastSeekAtRef = useRef(0);
  const lastLineIdRef = useRef<number | undefined>(undefined);
  const pendingStartMsRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLines(trigger: string) {
      const movieId = currentMovieIdFromUrl();
      if (!movieId) return;
      console.log(`[Cueloop overlay] loadLines (trigger=${trigger}) for movie`, movieId);
      const fetched = await fetchLinesFor(movieId);
      if (cancelled) return;
      console.log(`[Cueloop overlay] fetched ${fetched.length} lines`);
      linesRef.current = fetched;
      setLines(fetched);
      const timeMs = Math.floor(video.currentTime * 1000);
      const newCurrent = findCurrentLine(fetched, timeMs);
      currentLineRef.current = newCurrent;
      setCurrentLine(newCurrent ? { ...newCurrent } : null);
      lastLineIdRef.current = newCurrent?.id;
      // 라인 반복 중이면 라인 갱신 또는 해제
      const rep = repeatingRef.current;
      if (rep?.kind === 'line' && rep.line.id != null) {
        const updatedIdx = fetched.findIndex((l) => l.id === rep.line.id);
        if (updatedIdx !== -1) {
          repeatingRef.current = {
            kind: 'line',
            line: fetched[updatedIdx],
          };
          setRepeating(repeatingRef.current);
        } else {
          repeatingRef.current = null;
          repeatCountRef.current = 0;
          setRepeating(null);
          setRepeatCount(0);
        }
      }
    }
    void loadLines('mount');

    const handler = (msg: unknown) => {
      const m = msg as CueloopMessage;
      if (m?.type === 'CONTENTS_UPDATED') {
        console.log('[Cueloop overlay] received CONTENTS_UPDATED, refetching');
        void loadLines('broadcast');
      } else if (m?.type === 'PLAY_CUSTOM_LOOP_IN_TAB') {
        const { loopId, startMs, endMs, label } = m.payload;
        const newRep: RepeatingCustom = { kind: 'custom', loopId, startMs, endMs, label };
        repeatingRef.current = newRep;
        repeatCountRef.current = 0;
        setRepeating(newRep);
        setRepeatCount(0);
        lastSeekAtRef.current = performance.now();
        netflixSeek(startMs);
      } else if (m?.type === 'PLAY_LINE_LOOP_IN_TAB') {
        const { lineId, startMs } = m.payload;
        const sorted = linesRef.current;
        const idx = sorted.findIndex((l) => l.id === lineId);
        if (idx === -1) return;
        const line = sorted[idx];
        const newRep: RepeatingLine = { kind: 'line', line };
        repeatingRef.current = newRep;
        repeatCountRef.current = 0;
        setRepeating(newRep);
        setRepeatCount(0);
        lastSeekAtRef.current = performance.now();
        netflixSeek(startMs);
      } else if (m?.type === 'STOP_REPEAT_IN_TAB') {
        repeatingRef.current = null;
        repeatCountRef.current = 0;
        setRepeating(null);
        setRepeatCount(0);
      } else if (m?.type === 'OVERLAY_SHORTCUT_IN_TAB') {
        // 사이드패널이 forward한 단축키 — 기존 keydown listener가 재처리하도록 fake event dispatch.
        // capture phase listener라 즉시 같은 처리 진입.
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: m.payload.key,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => {
      cancelled = true;
      browser.runtime.onMessage.removeListener(handler);
    };
  }, [video]);

  // rAF + video.timeupdate 동시 사용 — 다른 창에 포커스 옮겨도(background window)
  // Chrome이 rAF를 1fps로 throttle하지만 video.timeupdate는 ~250ms 간격으로 정상 fire되어
  // 반복 유지됨. cancel 임계치도 800ms → 2500ms로 완화해서 throttle 환경에서도
  // 잘못된 cancel 안 발생.
  useEffect(() => {
    function checkRepeat(timeMs: number) {
      const rep = repeatingRef.current;
      if (rep == null) return;
      const now = performance.now();
      const seekCooldownActive = now - lastSeekAtRef.current < 250;
      const startMs = rep.kind === 'line' ? rep.line.startMs : rep.startMs;
      const endMs = rep.kind === 'line' ? rep.line.endMs : rep.endMs;
      if (
        !seekCooldownActive &&
        (timeMs < startMs - 200 || timeMs > endMs + 2500)
      ) {
        repeatingRef.current = null;
        repeatCountRef.current = 0;
        setRepeating(null);
        setRepeatCount(0);
      } else if (timeMs >= endMs && !seekCooldownActive) {
        repeatCountRef.current += 1;
        setRepeatCount(repeatCountRef.current);
        if (rep.kind === 'line' && rep.line.id != null) {
          incrementListen(rep.line.id);
        } else if (rep.kind === 'custom') {
          incrementCustomLoopListen(rep.loopId);
        }
        netflixSeek(startMs);
        lastSeekAtRef.current = now;
      }
    }

    function onTimeUpdate() {
      checkRepeat(Math.floor(video.currentTime * 1000));
    }
    video.addEventListener('timeupdate', onTimeUpdate);

    let raf = 0;
    function tick() {
      const sorted = linesRef.current;
      const timeMs = Math.floor(video.currentTime * 1000);

      checkRepeat(timeMs);

      if (sorted.length > 0) {
        const line = findCurrentLine(sorted, timeMs);
        const lineId = line?.id;
        if (lineId !== lastLineIdRef.current) {
          lastLineIdRef.current = lineId;
          currentLineRef.current = line;
          setCurrentLine(line);
          // 사이드패널 등 다른 컨텍스트에 현재 라인 알림 (자동 스크롤용)
          if (lineId != null) {
            const notify: CueloopMessage = {
              type: 'CURRENT_LINE_CHANGED',
              payload: { lineId },
            };
            void browser.runtime.sendMessage(notify).catch(() => {});
          }
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [video]);

  // repeating 상태 변경 시 사이드패널에 알림 (라인 반복일 때만 lineId, 그 외는 null)
  useEffect(() => {
    const lineId =
      repeating?.kind === 'line' ? (repeating.line.id ?? null) : null;
    const msg: CueloopMessage = {
      type: 'REPEATING_LINE_CHANGED',
      payload: { lineId },
    };
    browser.runtime.sendMessage(msg).catch(() => {});
  }, [repeating]);

  // 일일 학습 시간 측정 — 영상 재생 중 + 탭 visible + window focus 모두 충족할 때만 1초씩 누적.
  // 10초마다 batch로 background에 SESSION_TICK 전송 (SW wake-up 부담 최소화).
  // 페이지 hide/unload 시 잔여 카운터 즉시 flush.
  useEffect(() => {
    let pendingSeconds = 0;
    async function flush() {
      if (pendingSeconds === 0) return;
      const sec = pendingSeconds;
      pendingSeconds = 0;
      const msg: CueloopMessage = {
        type: 'SESSION_TICK',
        payload: { seconds: sec },
      };
      await browser.runtime.sendMessage(msg).catch(() => {});
    }
    const interval = window.setInterval(() => {
      if (
        !video.paused &&
        !video.ended &&
        !document.hidden &&
        document.hasFocus()
      ) {
        pendingSeconds += 1;
        if (pendingSeconds >= 10) void flush();
      }
    }, 1000);
    const onHide = () => {
      void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [video]);

  function showToast(text: string) {
    setToastText(text);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 1400);
  }

  function startLineRepeat() {
    const cur = currentLineRef.current;
    if (repeatingRef.current?.kind === 'line') {
      repeatingRef.current = null;
      repeatCountRef.current = 0;
      setRepeating(null);
      setRepeatCount(0);
      showToast('🔁 라인 반복 OFF (L)');
      return;
    }
    if (!cur?.id) {
      showToast('현재 자막 라인 없음');
      return;
    }
    const sorted = linesRef.current;
    const idx = sorted.findIndex((l) => l.id === cur.id);
    if (idx === -1) {
      showToast('라인을 찾을 수 없음');
      return;
    }
    repeatingRef.current = { kind: 'line', line: cur };
    repeatCountRef.current = 0;
    setRepeating(repeatingRef.current);
    setRepeatCount(0);
    lastSeekAtRef.current = performance.now();
    showToast('🔁 라인 반복 시작 (L)');
    netflixSeek(cur.startMs);
  }

  function markA() {
    const ms = Math.floor(video.currentTime * 1000);
    pendingStartMsRef.current = ms;
    setPendingStartMs(ms);
    showToast(`A 마킹: ${formatTime(ms)}`);
  }

  async function markBAndStart() {
    const start = pendingStartMsRef.current;
    const end = Math.floor(video.currentTime * 1000);
    if (start === null) {
      showToast('A를 먼저 누르세요');
      return;
    }
    if (end <= start + 100) {
      showToast('B가 A보다 충분히 뒤에 있어야 합니다');
      return;
    }
    const movieId = currentMovieIdFromUrl();
    if (!movieId) {
      showToast('영화 식별 실패');
      return;
    }
    const loopId = await addCustomLoop(movieId, start, end);
    if (loopId == null) {
      showToast('CustomLoop 저장 실패 (영화 자막 먼저 수집 필요)');
      return;
    }
    const newRep: RepeatingCustom = {
      kind: 'custom',
      loopId,
      startMs: start,
      endMs: end,
    };
    repeatingRef.current = newRep;
    repeatCountRef.current = 0;
    setRepeating(newRep);
    setRepeatCount(0);
    pendingStartMsRef.current = null;
    setPendingStartMs(null);
    lastSeekAtRef.current = performance.now();
    showToast(`🔁 CustomLoop 시작 ${formatTime(start)}-${formatTime(end)}`);
    netflixSeek(start);
  }

  async function labelCustomLoop() {
    const rep = repeatingRef.current;
    if (rep?.kind !== 'custom') {
      showToast('활성 CustomLoop이 없음 (B로 먼저 생성)');
      return;
    }
    // window.prompt는 main thread blocking. 그 동안 video.currentTime이 흐르면
    // rAF tick이 prompt 닫힌 후 endMs+800 초과 감지 → 자동 해제 발동.
    // 방지: prompt 동안 cooldown 무한대로 설정 + 닫힌 후 startMs로 재 seek.
    lastSeekAtRef.current = Number.MAX_SAFE_INTEGER / 2;
    const input = window.prompt('CustomLoop 라벨 입력', rep.label ?? '');
    // prompt 닫혔으니 startMs로 seek + 정상 cooldown 복원
    netflixSeek(rep.startMs);
    lastSeekAtRef.current = performance.now();
    if (input === null) {
      return;
    }
    const trimmed = input.trim();
    await updateCustomLoopLabel(rep.loopId, trimmed);
    const updated: RepeatingCustom = { ...rep, label: trimmed || undefined };
    repeatingRef.current = updated;
    setRepeating(updated);
    showToast(trimmed ? `라벨: "${trimmed}"` : '라벨 삭제됨');
  }

  function jumpToPreviousLine() {
    const sorted = linesRef.current;
    if (sorted.length === 0) return;
    const timeMs = Math.floor(video.currentTime * 1000);
    const curIdx = findCurrentLineIdx(sorted, timeMs);
    let targetIdx: number;
    if (curIdx === -1) {
      // 현재 어떤 라인 안에도 없음 → timeMs 이전의 마지막 라인
      let lo = 0;
      let hi = sorted.length - 1;
      targetIdx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (sorted[mid].startMs < timeMs) {
          targetIdx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
    } else {
      targetIdx = curIdx - 1;
    }
    if (targetIdx < 0) {
      showToast('첫 라인입니다');
      return;
    }
    lastSeekAtRef.current = performance.now();
    netflixSeek(sorted[targetIdx].startMs);
  }

  function jumpToNextLine() {
    const sorted = linesRef.current;
    if (sorted.length === 0) return;
    const timeMs = Math.floor(video.currentTime * 1000);
    const curIdx = findCurrentLineIdx(sorted, timeMs);
    let targetIdx: number;
    if (curIdx === -1) {
      // 현재 어떤 라인 안에도 없음 → timeMs 이후의 첫 라인
      targetIdx = sorted.findIndex((l) => l.startMs > timeMs);
      if (targetIdx === -1) {
        showToast('마지막 라인입니다');
        return;
      }
    } else {
      targetIdx = curIdx + 1;
      if (targetIdx >= sorted.length) {
        showToast('마지막 라인입니다');
        return;
      }
    }
    lastSeekAtRef.current = performance.now();
    netflixSeek(sorted[targetIdx].startMs);
  }

  function replayCurrentLine() {
    const cur = currentLineRef.current;
    if (!cur) {
      showToast('현재 자막 라인 없음');
      return;
    }
    lastSeekAtRef.current = performance.now();
    netflixSeek(cur.startMs);
  }

  function nudgeSeek(deltaMs: number) {
    const target = Math.max(0, Math.floor(video.currentTime * 1000) + deltaMs);
    lastSeekAtRef.current = performance.now();
    netflixSeek(target);
  }

  // 단축키
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInInput()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'h') {
        e.preventDefault();
        e.stopPropagation();
        setShowKorean((prev) => {
          const next = !prev;
          showToast(`한국어 자막: ${next ? 'ON' : 'OFF'} (H)`);
          return next;
        });
      } else if (key === 'l') {
        e.preventDefault();
        e.stopPropagation();
        startLineRepeat();
      } else if (key === 'a') {
        e.preventDefault();
        e.stopPropagation();
        markA();
      } else if (key === 'b') {
        e.preventDefault();
        e.stopPropagation();
        void markBAndStart();
      } else if (key === 's') {
        e.preventDefault();
        e.stopPropagation();
        void labelCustomLoop();
      } else if (key === 'r') {
        e.preventDefault();
        e.stopPropagation();
        replayCurrentLine();
      } else if (key === 'arrowleft') {
        e.preventDefault();
        e.stopPropagation();
        nudgeSeek(-2000);
      } else if (key === 'arrowright') {
        e.preventDefault();
        e.stopPropagation();
        nudgeSeek(2000);
      } else if (key === 'arrowup') {
        e.preventDefault();
        e.stopPropagation();
        jumpToPreviousLine();
      } else if (key === 'arrowdown') {
        e.preventDefault();
        e.stopPropagation();
        jumpToNextLine();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  const visible = !!currentLine && (currentLine.textEn.trim() || currentLine.textKo.trim());

  const koLineCount = useMemo(
    () => lines.filter((l) => l.textKo.trim()).length,
    [lines],
  );

  const repeatingKind = repeating?.kind;
  const counterColor =
    repeatCount >= 100
      ? '#a78bfa'
      : repeatCount >= 50
        ? '#34d399'
        : repeatingKind === 'custom'
          ? '#c4b5fd'
          : '#fde68a';
  const counterPrefix = repeatingKind === 'custom' ? '🔁 [Custom] ' : '🔁 ';
  const customLabel = repeating?.kind === 'custom' ? repeating.label : undefined;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2147483646,
          pointerEvents: 'none',
          maxWidth: '85vw',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95)',
        }}
      >
        {lines.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
            Cueloop · 자막 없음 (DB에 이 영화 데이터 없음)
          </div>
        ) : visible ? (
          <>
            {currentLine.textEn.trim() && (
              <div
                style={{
                  color: '#ffffff',
                  fontSize: '3.375rem',
                  fontWeight: 700,
                  lineHeight: 1.25,
                  whiteSpace: 'pre-wrap',
                  marginBottom: '0.5rem',
                }}
              >
                {currentLine.textEn}
              </div>
            )}
            {showKorean && currentLine.textKo.trim() && (
              <div
                style={{
                  color: '#fde68a',
                  fontSize: '2.625rem',
                  fontWeight: 600,
                  lineHeight: 1.25,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {currentLine.textKo}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', fontFamily: 'monospace' }}>
            · {lines.length} cues ({koLineCount} 한)
          </div>
        )}
      </div>

      {repeating != null && (
        <div
          style={{
            position: 'fixed',
            bottom: '4%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2147483646,
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.75)',
            color: counterColor,
            padding: '10px 28px',
            borderRadius: '999px',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '2.75rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            textShadow: '0 0 6px rgba(0,0,0,0.95)',
          }}
        >
          {counterPrefix}{repeatCount} / 100
          {customLabel && (
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.7)',
                marginTop: '2px',
              }}
            >
              {customLabel}
            </div>
          )}
        </div>
      )}

      {pendingStartMs != null && repeating == null && (
        <div
          style={{
            position: 'fixed',
            bottom: '4%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2147483646,
            pointerEvents: 'none',
            background: 'rgba(139, 92, 246, 0.85)',
            color: '#fff',
            padding: '8px 22px',
            borderRadius: '999px',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
          }}
        >
          A: {formatTime(pendingStartMs)} → B를 눌러 끝점 마킹
        </div>
      )}

      {!showKorean && (
        <div
          style={{
            position: 'fixed',
            top: '12px',
            right: '12px',
            zIndex: 2147483646,
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.6)',
            color: 'rgba(253, 230, 138, 0.7)',
            padding: '3px 8px',
            borderRadius: '4px',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '0.7rem',
            fontWeight: 600,
          }}
        >
          한국어 OFF (H)
        </div>
      )}

      {toastVisible && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2147483647,
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.85)',
            color: '#fde68a',
            padding: '8px 18px',
            borderRadius: '6px',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '1rem',
            fontWeight: 600,
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
        >
          {toastText}
        </div>
      )}
    </>
  );
}
