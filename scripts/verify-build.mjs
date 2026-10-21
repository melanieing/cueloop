// 빌드 산출물이 실제로 동작 가능한 모양인지 검증한다.
//
// 소스가 멀쩡해도 번들 결과에서 핵심 리스너가 빠질 수 있다(조건부 코드 제거,
// 리팩터링 실수, main() 중단 등). v0.2.7은 `cueloop/jump` 리스너가 등록되지 않은
// 채 게시됐고, 증상은 "2초 타임아웃"뿐이라 원인 추적에 한나절이 걸렸다
// (docs/troubleshooting.md #31). 그래서 소스가 아니라 **산출물**을 검사한다.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '.output/chrome-mv3';
const manifestPath = join(OUT, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error(`❌ ${manifestPath}가 없습니다. 먼저 빌드하세요.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const mainWorld = (manifest.content_scripts ?? []).filter((cs) => cs.world === 'MAIN');

if (mainWorld.length === 0) {
  console.error('❌ manifest에 world: "MAIN" content script가 없습니다.');
  console.error('   자막 가로채기(JSON.parse hijack)가 통째로 빠진 빌드입니다.');
  process.exit(1);
}

// MAIN world 번들이 반드시 갖춰야 하는 것 / 절대 있으면 안 되는 것.
// 축약(minify)으로 따옴표 종류가 바뀌므로 따옴표 없이 검사한다.
const REQUIRED = [
  { needle: 'cueloop/timedtext', why: '자막 캡처 이벤트 발행' },
  { needle: 'cueloop/jump', why: 'seek 요청 수신 리스너' },
  { needle: 'cueloop/jump-result', why: 'seek 결과 응답' },
  { needle: 'addEventListener', why: '리스너 등록 자체' },
];
// ⚠ `browser.`로 찾으면 안 된다 — WXT가 번들에서 `browser`를 지역 변수로 renaming해
// `t.runtime.getManifest()`처럼 남는다(실측). 축약에도 살아남는 **속성 이름**으로 찾는다.
const FORBIDDEN = [
  { re: /getManifest/, why: 'MAIN world엔 확장 API가 없습니다 (#31)' },
  {
    re: /\.\s*(?:runtime|storage|tabs|scripting|i18n)\s*\.\s*[A-Za-z_$]/,
    why: 'MAIN world에서 확장 API 접근으로 보입니다 (#31)',
  },
];

let failed = false;
for (const cs of mainWorld) {
  for (const rel of cs.js ?? []) {
    const file = join(OUT, rel);
    const code = readFileSync(file, 'utf-8');
    for (const { needle, why } of REQUIRED) {
      if (!code.includes(needle)) {
        console.error(`❌ ${rel}에 "${needle}"이 없습니다 — ${why}`);
        failed = true;
      }
    }
    for (const { re, why } of FORBIDDEN) {
      const m = code.match(re);
      if (m) {
        console.error(`❌ ${rel}에 "${m[0]}" 발견 — ${why}`);
        failed = true;
      }
    }
  }
}

if (failed) {
  console.error('\n   배경: docs/troubleshooting.md #31\n');
  process.exit(1);
}
console.log('✓ 빌드 산출물 검증 통과 (MAIN world 번들)');
