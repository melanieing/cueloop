# Cueloop 개인정보 처리방침 (Privacy Policy)

> 마지막 업데이트: 2026-05-27
> Cueloop 버전: 0.2.0

## 한국어

### 1. 한 줄 요약

**Cueloop은 어떠한 사용자 데이터도 외부 서버로 전송하지 않습니다.** 모든 학습 데이터는 사용자의 브라우저(IndexedDB)에만 저장되며, 사용자가 직접 백업 파일을 내보내지 않는 한 디바이스를 벗어나지 않습니다.

### 2. 수집·저장하는 데이터

Cueloop이 사용자의 브라우저 IndexedDB에 **로컬로** 저장하는 데이터:

- **자막 데이터**: Netflix가 재생 중인 영상의 자막 트랙 (영어/한국어). Netflix Open Connect CDN에서 fetch한 원본 자막.
- **사용자 편집 자막**: 사용자가 자막 오류를 직접 수정하거나 새 라인을 추가한 내용.
- **학습 진도**: 라인별 듣기 횟수, 외움 여부, 마지막 학습 시각.
- **CustomLoop**: 사용자가 마킹한 임의 A-B 구간 정보 + 라벨.
- **일일 학습 통계**: 학습 시간(초), 라인 반복 횟수, 일일 목표 달성 여부.
- **스트릭**: 연속 학습일 수.
- **설정값**: 일일 목표 시간/카운트.

### 3. 데이터 전송 정책

- **외부 서버 전송**: 없음.
- **분석/트래킹 도구**: 없음 (Google Analytics, Sentry, Mixpanel 등 모두 사용 안 함).
- **광고 네트워크**: 없음.
- **클라우드 동기화**: v0.2에서 제공 안 함. 사용자가 직접 "백업 내보내기"로 JSON 파일을 다운로드해서 다른 기기로 옮길 수 있음.

### 4. 권한별 사용 목적

| 권한 | 사용 목적 |
|---|---|
| `storage` | Chrome 확장 표준 권한 (Dexie/IndexedDB 사용에 필요) |
| `sidePanel` | 학습용 사이드 패널 UI 제공 |
| `alarms` | 매일 자정 학습 스트릭 갱신 (외부 호출 없음) |
| `notifications` | 일일 목표 달성 시 사용자에게 알림 |
| `https://*.netflix.com/*` | Netflix 페이지에 듀얼 자막 오버레이 주입 |
| `https://*.nflxvideo.net/*` | Netflix 자막 파일(dfxp/ttml) fetch (CDN 호스팅) |

### 5. 데이터 삭제

- 확장 프로그램 제거 시: Chrome이 IndexedDB를 자동 삭제.
- 사용자가 백업 파일을 디바이스에서 직접 삭제 가능.
- 모든 데이터가 로컬에만 있으므로 별도 "계정 삭제" 절차는 불필요.

### 6. 미성년자

Cueloop은 만 13세 미만 사용자를 대상으로 하지 않습니다.

### 7. 변경

이 처리방침이 변경되면 GitHub 저장소의 본 문서를 갱신하며, 중요한 변경 사항은 확장 업데이트 노트에 명시합니다.

### 8. 문의

- 이메일: melanie0617@gmail.com
- GitHub: https://github.com/melanieing/cueloop

---

## English

### 1. TL;DR

**Cueloop does not transmit any user data to external servers.** All learning data is stored locally in the user's browser (IndexedDB) and never leaves the device unless the user explicitly exports a backup file.

### 2. Data Collected & Stored

Cueloop stores the following data **locally** in the user's browser IndexedDB:

- **Subtitle data**: Subtitle tracks (English/Korean) for videos the user plays on Netflix. Original subtitles fetched from Netflix Open Connect CDN.
- **User-edited subtitles**: User's corrections to subtitle errors or new lines added by the user.
- **Learning progress**: Listen count per line, memorized status, last listened timestamp.
- **CustomLoops**: User-marked arbitrary A-B segments with labels.
- **Daily learning stats**: Study seconds, listen counts, daily goal completion.
- **Streak**: Consecutive learning day count.
- **Settings**: Daily target minutes/listens.

### 3. Data Transmission Policy

- **External server transmission**: None.
- **Analytics/tracking tools**: None (no Google Analytics, Sentry, Mixpanel, etc.).
- **Ad networks**: None.
- **Cloud sync**: Not provided in v0.2. Users may export a JSON backup file to manually transfer between devices.

### 4. Permissions Justification

| Permission | Purpose |
|---|---|
| `storage` | Standard Chrome extension permission (required for Dexie/IndexedDB usage) |
| `sidePanel` | Provide learning side panel UI |
| `alarms` | Daily midnight streak update (no external calls) |
| `notifications` | Notify user on daily goal completion |
| `https://*.netflix.com/*` | Inject dual subtitle overlay on Netflix pages |
| `https://*.nflxvideo.net/*` | Fetch Netflix subtitle files (dfxp/ttml) from CDN |

### 5. Data Deletion

- Upon extension uninstall: Chrome automatically removes IndexedDB.
- Users can delete backup files directly from their device.
- No "account deletion" process needed since all data is local.

### 6. Minors

Cueloop is not intended for users under 13.

### 7. Changes

Changes to this policy will be reflected in this document in the GitHub repository, with significant changes noted in extension update notes.

### 8. Contact

- Email: melanie0617@gmail.com
- GitHub: https://github.com/melanieing/cueloop
