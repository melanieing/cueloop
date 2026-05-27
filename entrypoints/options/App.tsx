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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Cueloop 설정</h1>
      <p className="text-sm text-zinc-500 mb-8">
        v0.2 — 일일 목표 + 백업 / 복원
      </p>

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
        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
          모든 학습 데이터(자막, 진도, 외움, CustomLoop, 일일 목표, 스트릭, 세션)를
          JSON 파일로 내보내거나 불러옵니다. 다른 PC로 옮길 때, 확장 재설치 전,
          중요한 학습 시점에 백업해두세요. 녹음 데이터(v0.3+)는 포함되지 않습니다.
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
