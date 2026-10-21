// MAIN world 엔트리포인트에서 확장 API 사용을 금지한다.
//
// `world: 'MAIN'` content script는 페이지 컨텍스트에서 돌기 때문에 `browser.*` /
// `chrome.*`가 존재하지 않는다. 건드리면 throw하고, main()의 나머지가 통째로
// 조용히 죽는다 — v0.2.7이 이 때문에 모든 seek이 먹통인 채로 게시됐다
// (docs/troubleshooting.md #31). WXT는 world와 무관하게 `browser`를 전역으로
// 노출하므로 타입 체크로는 절대 걸러지지 않는다. 그래서 이 검사가 필요하다.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'entrypoints';
const API_RE = /\b(?:browser|chrome)\s*\.\s*[A-Za-z_$]/g;

/** 주석을 같은 길이의 공백으로 치환 — 줄/열 번호가 유지된다. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const violations = [];
for (const file of collect(ROOT)) {
  const raw = readFileSync(file, 'utf-8');
  if (!/world:\s*['"]MAIN['"]/.test(raw)) continue;
  const code = stripComments(raw);
  for (const m of code.matchAll(API_RE)) {
    const line = code.slice(0, m.index).split('\n').length;
    violations.push({ file, line, text: raw.split('\n')[line - 1].trim() });
  }
}

if (violations.length > 0) {
  console.error('\n❌ MAIN world에서 확장 API 사용이 발견됐습니다.');
  console.error('   페이지 컨텍스트에는 browser/chrome이 없어 throw하고, 그 아래 코드가 전부 죽습니다.');
  console.error('   필요한 값은 빌드 타임에 주입하세요 (wxt.config.ts의 vite define).');
  console.error('   배경: docs/troubleshooting.md #31\n');
  for (const v of violations) console.error(`   ${v.file}:${v.line}  ${v.text}`);
  console.error('');
  process.exit(1);
}
console.log('✓ MAIN world 확장 API 검사 통과');
