import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DailyGoal } from '@/src/db';
import { todayKey } from '@/src/lib/dailyGoal';

const BACKUP_TABLES = [
  'contents',
  'lines',
  'lineProgress',
  'customLoops',
  'dailyGoals',
  'sessions',
  'settings',
] as const;

interface BackupPayload {
  app: 'cueloop';
  version: string;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

async function exportBackup(): Promise<void> {
  const tables: Record<string, unknown[]> = {};
  for (const name of BACKUP_TABLES) {
    const table = db[name] as unknown as { toArray: () => Promise<unknown[]> };
    tables[name] = await table.toArray();
  }
  const payload: BackupPayload = {
    app: 'cueloop',
    version: '0.2.0',
    exportedAt: new Date().toISOString(),
    tables,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cueloop-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importBackup(file: File): Promise<{ tableCounts: Record<string, number> }> {
  const text = await file.text();
  const data = JSON.parse(text) as Partial<BackupPayload>;
  if (data.app !== 'cueloop' || !data.tables) {
    throw new Error('Cueloop 백업 파일이 아닙니다.');
  }
  const tableCounts: Record<string, number> = {};
  // Dexie transaction — clear + bulkPut을 원자적으로
  await db.transaction(
    'rw',
    [
      db.contents,
      db.lines,
      db.lineProgress,
      db.customLoops,
      db.dailyGoals,
      db.sessions,
      db.settings,
    ],
    async () => {
      for (const name of BACKUP_TABLES) {
        const rows = data.tables?.[name];
        if (!Array.isArray(rows)) continue;
        const table = db[name] as unknown as {
          clear: () => Promise<void>;
          bulkPut: (rows: unknown[]) => Promise<unknown>;
        };
        await table.clear();
        if (rows.length > 0) {
          await table.bulkPut(rows);
        }
        tableCounts[name] = rows.length;
      }
    },
  );
  return { tableCounts };
}

export const SETTING_KEYS = {
  dailyTargetMinutes: 'dailyTargetMinutes',
  dailyTargetListens: 'dailyTargetListens',
} as const;

export const DEFAULTS = {
  dailyTargetMinutes: 30,
  dailyTargetListens: 50,
};

async function setSetting(key: string, value: number): Promise<void> {
  await db.settings.put({ key, value });
  // 오늘 dailyGoal row가 있으면 즉시 sync — 사용자가 옵션 바꾸자마자 반영.
  const existing = await db.dailyGoals.get(todayKey());
  if (!existing) return;
  let next: DailyGoal = existing;
  if (key === SETTING_KEYS.dailyTargetMinutes) {
    next = { ...next, targetMinutes: value };
  } else if (key === SETTING_KEYS.dailyTargetListens) {
    next = { ...next, targetListens: value };
  } else {
    return;
  }
  next.completed =
    next.achievedMinutes >= next.targetMinutes &&
    next.achievedListens >= next.targetListens
      ? 1
      : 0;
  await db.dailyGoals.put(next);
}

export default function App() {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const targetMinutes = useLiveQuery(async () => {
    const s = await db.settings.get(SETTING_KEYS.dailyTargetMinutes);
    return (s?.value as number | undefined) ?? DEFAULTS.dailyTargetMinutes;
  });
  const targetListens = useLiveQuery(async () => {
    const s = await db.settings.get(SETTING_KEYS.dailyTargetListens);
    return (s?.value as number | undefined) ?? DEFAULTS.dailyTargetListens;
  });

  async function handleExport() {
    setBackupError(null);
    setBackupStatus(null);
    try {
      await exportBackup();
      setBackupStatus('백업 파일 다운로드 완료');
      setTimeout(() => setBackupStatus(null), 4000);
    } catch (err) {
      setBackupError(String(err));
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    setBackupError(null);
    setBackupStatus(null);
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 다시 선택 가능하도록
    if (file) setPendingImportFile(file);
  }

  async function confirmImport() {
    if (!pendingImportFile) return;
    setImporting(true);
    try {
      const { tableCounts } = await importBackup(pendingImportFile);
      const summary = Object.entries(tableCounts)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      setBackupStatus(`복원 완료 — ${summary}`);
      setPendingImportFile(null);
    } catch (err) {
      setBackupError(`복원 실패: ${String(err)}`);
      setPendingImportFile(null);
    } finally {
      setImporting(false);
    }
  }

  if (targetMinutes === undefined || targetListens === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <p className="text-sm text-zinc-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Cueloop 설정</h1>
      <p className="text-sm text-zinc-500 mb-8">
        v0.2 — 사용법 + 일일 목표 + 백업 / 복원
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">🎯 시작하기</h2>

        <ol className="space-y-3 text-sm text-zinc-300 leading-relaxed list-decimal list-inside marker:text-blue-400 marker:font-semibold">
          <li>
            <strong className="text-zinc-100">사이드패널 열기</strong> —
            Netflix watch 페이지에서 Chrome 우상단의{' '}
            <span className="inline-block px-1.5 py-0.5 bg-purple-950/40 border border-purple-800 rounded text-xs">
              🎬 Cueloop 아이콘
            </span>
            을 <strong>한 번 클릭</strong>하면 사이드패널이 열립니다.
            (한 번 더 클릭하면 닫힘 — 토글)
          </li>
          <li>
            <strong className="text-zinc-100">자막 자동 캡처</strong> —
            Netflix에서 영상을 재생하면 영어/한국어 자막이 자동으로 캡처되어
            사이드패널에 라인 단위로 보입니다. 영상 위에는 듀얼 자막
            오버레이가 자동 표시됩니다.
          </li>
          <li>
            <strong className="text-zinc-100">제목 입력</strong> — 사이드패널
            상단 <span className="px-1 py-0.5 bg-amber-950/40 border border-amber-800 rounded text-xs text-amber-300">✎ 제목</span>
            {' '}버튼을 클릭해서 영상 제목을 입력해두면 드롭다운에서 찾기
            편합니다 (Netflix가 제목을 제공하지 않아 직접 입력 필요).
          </li>
          <li>
            <strong className="text-zinc-100">A-B 반복 학습 (100LS)</strong> —
            사이드패널에서 라인의{' '}
            <span className="text-amber-300">🔁</span> 아이콘을 클릭하거나
            영상에서{' '}
            <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
              L
            </kbd>
            {' '}키를 누르면 현재 라인을 자동 반복합니다. 들은 횟수가 진도
            dot 색상으로 표시됩니다 (라임 → 에메랄드 → 파랑 → 보라).
          </li>
          <li>
            <strong className="text-zinc-100">CustomLoop (임의 구간 반복)</strong>
            {' '}— 자막 cue 경계가 아닌 임의 구간을 반복하고 싶으면:{' '}
            <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
              A
            </kbd>
            {' '}로 시작점 마킹 →{' '}
            <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
              B
            </kbd>
            {' '}로 끝점 마킹 →{' '}
            <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
              S
            </kbd>
            {' '}로 라벨 저장.
          </li>
          <li>
            <strong className="text-zinc-100">자막 편집</strong> — 사이드패널의
            라인 텍스트를 클릭하면 편집 모드로 진입. 영어/한국어/메모/시작
            시각/종료 시각 모두 수정 가능.{' '}
            <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
              Ctrl+Enter
            </kbd>
            {' '}저장,{' '}
            <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
              Esc
            </kbd>
            {' '}취소.
          </li>
          <li>
            <strong className="text-zinc-100">외움 처리</strong> — 라인의{' '}
            <span className="text-emerald-300">☐</span> 체크박스로 외움 토글.
            30회 이상 들은 라인은{' '}
            <span className="text-amber-300">✨ 외움?</span> 후보로 자동 강조됩니다.
          </li>
          <li>
            <strong className="text-zinc-100">일일 목표 + 스트릭</strong> —
            아래에서 목표 설정. 학습 시간 + 100LS 카운트 둘 다 달성하는 날마다{' '}
            <span className="text-amber-400">🔥 스트릭</span>이 +1. 확장 아이콘에
            연속 일수가 emerald 배지로 표시됩니다.
          </li>
        </ol>

        <details className="mt-5 bg-zinc-900/60 border border-zinc-800 rounded p-3">
          <summary className="text-sm font-semibold text-zinc-200 cursor-pointer">
            ⌨ 단축키 전체 목록 (Netflix 페이지에서 사용)
          </summary>
          <table className="mt-3 text-xs w-full">
            <tbody className="text-zinc-300">
              {[
                ['H', '한국어 자막 표시/숨김 토글'],
                ['L', '현재 라인 반복 시작/정지'],
                ['A', 'CustomLoop 시작점 마킹'],
                ['B', 'CustomLoop 끝점 마킹 (자동 저장 + 반복 시작)'],
                ['S', '진행 중인 CustomLoop에 라벨 저장'],
                ['↑ / ↓', '이전 / 다음 라인'],
                ['← / →', '2초 뒤로 / 앞으로'],
                ['R', '현재 라인 처음부터 다시'],
              ].map(([key, desc]) => (
                <tr key={key} className="border-b border-zinc-800/60 last:border-0">
                  <td className="py-1.5 pr-3 w-32">
                    <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded font-mono">
                      {key}
                    </kbd>
                  </td>
                  <td className="py-1.5 text-zinc-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">📊 일일 목표</h2>
        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
          매일 달성하고 싶은 학습 시간과 100LS 카운트. 둘 다 채우면 그 날 목표 달성 → 스트릭 +1.
          <br />
          (입력 즉시 저장됩니다.)
        </p>

        <label className="block mb-5">
          <span className="text-sm text-zinc-200 font-medium">학습 시간 (분/일)</span>
          <input
            type="number"
            min={1}
            value={targetMinutes}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value) || 0);
              void setSetting(SETTING_KEYS.dailyTargetMinutes, v);
            }}
            className="block w-32 mt-1.5 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-100 focus:border-blue-500 focus:outline-none"
          />
          <span className="block text-[11px] text-zinc-500 mt-1">
            영상 재생 + 탭 포커스 + 보이는 상태일 때만 측정됩니다.
          </span>
        </label>

        <label className="block">
          <span className="text-sm text-zinc-200 font-medium">100LS 카운트 (회/일)</span>
          <input
            type="number"
            min={1}
            value={targetListens}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value) || 0);
              void setSetting(SETTING_KEYS.dailyTargetListens, v);
            }}
            className="block w-32 mt-1.5 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-100 focus:border-blue-500 focus:outline-none"
          />
          <span className="block text-[11px] text-zinc-500 mt-1">
            라인 또는 CustomLoop이 반복으로 1회 카운트될 때마다 누적.
          </span>
        </label>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">📦 백업 / 복원</h2>

        <div className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-900/50 rounded p-3 mb-4 leading-relaxed">
          <p className="font-semibold mb-1">⚠ 데이터는 어디에 저장되나요?</p>
          <p className="mb-2">
            Cueloop의 모든 학습 데이터는 <strong>이 브라우저 안 (IndexedDB)</strong>에만 저장됩니다.
            외부 서버 전송 0. 다음 경우 데이터가 사라질 수 있어요:
          </p>
          <ul className="list-disc list-inside space-y-0.5 mb-2 text-amber-200/80">
            <li>확장 프로그램을 삭제(uninstall)할 때</li>
            <li>브라우저 데이터를 전체 삭제할 때 (chrome://settings/clearBrowserData)</li>
            <li>다른 PC / 다른 브라우저 프로필로 옮길 때</li>
            <li>컴퓨터를 재설치하거나 디스크가 망가질 때</li>
          </ul>
          <p>
            <strong>👉 정기적으로 "백업 내보내기"로 JSON 파일을 안전한 곳(클라우드/USB)에 보관하세요.</strong>
            새 환경에서는 "백업 불러오기"로 모든 데이터를 한 번에 복원할 수 있습니다.
          </p>
        </div>

        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
          내보내기/불러오기는 자막 · 진도 · 외움 · CustomLoop · 일일 목표 · 스트릭 · 세션을 포함합니다.
          녹음 데이터(v0.3+)는 포함되지 않습니다.
        </p>

        <div className="flex flex-wrap gap-3 mb-3">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
          >
            📥 백업 내보내기 (JSON 다운로드)
          </button>
          <label className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 rounded cursor-pointer">
            📤 백업 불러오기...
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFilePick}
              className="hidden"
            />
          </label>
        </div>

        {backupStatus && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-900 rounded px-3 py-2">
            ✓ {backupStatus}
          </div>
        )}
        {backupError && (
          <div className="text-xs text-red-300 bg-red-950/40 border border-red-900 rounded px-3 py-2">
            ⚠ {backupError}
          </div>
        )}

        <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
          ⚠ 복원은 현재 데이터를 모두 덮어씁니다. 복원 전에 한 번 export로
          현재 상태를 백업하는 것을 권장합니다.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">❓ 자주 묻는 질문</h2>
        <div className="space-y-3">
          <details className="bg-zinc-900/60 border border-zinc-800 rounded p-3">
            <summary className="text-sm font-medium text-zinc-200 cursor-pointer">
              콘텐츠를 어떻게 구분하나요? 같은 영화인데 진도가 0이 됐어요.
            </summary>
            <div className="text-xs text-zinc-400 mt-2 leading-relaxed space-y-2">
              <p>
                Cueloop은 Netflix 영상의 고유 번호(<span className="font-mono text-zinc-300">netflix.com/watch/<strong>70283145</strong></span>{' '}
                같은 숫자)로 콘텐츠를 구분합니다. 영화 1편 또는 시리즈의 에피소드
                1화마다 고유한 번호가 있습니다.
              </p>
              <p>
                <strong className="text-zinc-200">시청목록에서 빼거나 복습하려고
                다시 봐도 이 번호는 바뀌지 않아서</strong> 진도·외움·CustomLoop이
                그대로 이어집니다.
              </p>
              <p>
                단, Netflix가 콘텐츠를 내렸다가 재계약으로 다시 올리거나, 다른
                국가 카탈로그·다른 버전(감독판 등)이면 번호가 달라질 수 있고,
                그땐 별개 콘텐츠로 보입니다 (드문 경우).
              </p>
            </div>
          </details>

          <details className="bg-zinc-900/60 border border-zinc-800 rounded p-3">
            <summary className="text-sm font-medium text-zinc-200 cursor-pointer">
              select 박스에 쓰레기 콘텐츠가 쌓여요.
            </summary>
            <div className="text-xs text-zinc-400 mt-2 leading-relaxed space-y-2">
              <p>
                브라우즈 페이지에서 썸네일에 마우스만 올려도 미리보기가 재생되며
                자막이 잡히던 문제는 수정됐습니다. 이제{' '}
                <strong className="text-zinc-200">실제로 재생 페이지
                (/watch/…)에 들어간 콘텐츠만</strong> 추가됩니다.
              </p>
              <p>
                이미 쌓인 항목은 사이드패널 상단 select 박스 옆{' '}
                <span className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded">🗑</span>{' '}
                버튼으로 콘텐츠 + 학습 데이터를 함께 삭제할 수 있습니다.
              </p>
            </div>
          </details>

          <details className="bg-zinc-900/60 border border-zinc-800 rounded p-3">
            <summary className="text-sm font-medium text-zinc-200 cursor-pointer">
              제목이 "Netflix 12345"처럼 보여요.
            </summary>
            <div className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Netflix가 재생 페이지에선 제목 정보를 제공하지 않습니다. 사이드패널
              상단 <span className="px-1 py-0.5 bg-amber-950/40 border border-amber-800 rounded text-amber-300">✎ 제목</span>{' '}
              버튼으로 한 번 직접 입력하면 이후 그 제목으로 표시됩니다.
            </div>
          </details>

          <details className="bg-zinc-900/60 border border-zinc-800 rounded p-3">
            <summary className="text-sm font-medium text-zinc-200 cursor-pointer">
              단축키가 안 들어요.
            </summary>
            <div className="text-xs text-zinc-400 mt-2 leading-relaxed">
              영상 화면 또는 사이드패널에 포커스가 있어야 합니다 (라인 텍스트
              편집 중일 땐 일반 입력이 우선). 다른 앱 창이나 주소창에 포커스가
              있으면 동작하지 않습니다.
            </div>
          </details>
        </div>
      </section>

      {pendingImportFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-md w-full p-5">
            <h3 className="text-base font-semibold mb-3">⚠ 백업 복원 확인</h3>
            <p className="text-sm text-zinc-300 mb-2">
              <span className="font-mono text-amber-300 break-all">
                {pendingImportFile.name}
              </span>
            </p>
            <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
              이 파일로 복원하면 <strong className="text-red-400">현재 모든
              데이터가 덮어쓰기</strong>됩니다 (자막, 진도, 외움, CustomLoop,
              일일 목표, 스트릭, 세션).
            </p>
            <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
              먼저 "📥 백업 내보내기"로 현재 상태를 한 번 백업해두는 것을
              권장합니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPendingImportFile(null)}
                disabled={importing}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded cursor-pointer disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmImport()}
                disabled={importing}
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded cursor-pointer disabled:opacity-50"
              >
                {importing ? '복원 중...' : '복원 실행 (덮어쓰기)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
