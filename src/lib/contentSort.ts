import type { Content } from '../db';

/**
 * 작품 목록 정렬 — 제목 가나다/알파벳순.
 *
 * 한국어 제목과 영문 제목이 섞이므로 'ko' 로케일 collation을 쓴다.
 * `numeric`으로 "시즌 2"가 "시즌 10"보다 앞에 오게 하고, `sensitivity: 'base'`로
 * 대소문자 차이는 무시한다.
 */
export function compareContentTitle(a: Content, b: Content): number {
  return a.title.localeCompare(b.title, 'ko', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function sortContentsByTitle(list: Content[]): Content[] {
  return [...list].sort(compareContentTitle);
}
