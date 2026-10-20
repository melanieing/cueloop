export type CueloopMessage =
  | {
      type: 'NETFLIX_TIMEDTEXT_CAPTURED';
      payload: {
        movieId: string;
        rawTracks: unknown[];
        pageTitle?: string;
      };
    }
  | {
      type: 'CONTENTS_UPDATED';
      payload: { contentId: number };
    }
  /** content script → background: /watch/ 진입 후 자막이 들어왔는지 자가 점검 */
  | {
      type: 'INGEST_HEALTH_CHECK';
      payload: { movieId: string; captured: boolean };
    }
  /** background → sidepanel: 인제스트 실패 감지 (조용한 실패 방지) */
  | {
      type: 'INGEST_HEALTH_WARNING';
      payload: { movieId: string; captured: boolean };
    }
  | {
      type: 'JUMP_TO_LINE';
      payload: {
        contentId: number;
        startMs: number;
      };
    }
  | {
      type: 'JUMP_TO_LINE_IN_TAB';
      payload: {
        expectedMovieId: string;
        startMs: number;
      };
    }
  | {
      type: 'QUERY_ACTIVE_CONTENT';
    }
  | {
      type: 'ACTIVE_CONTENT_CHANGED';
      payload: { contentId: number | null };
    }
  | {
      type: 'GET_LINES_FOR_MOVIE';
      payload: { movieId: string };
    }
  | {
      type: 'INCREMENT_LINE_LISTEN';
      payload: { lineId: number };
    }
  /** 오버레이 카운터용 — 누적 청취 횟수(100LS 진행도) 조회 */
  | {
      type: 'GET_LISTEN_COUNT';
      payload: { kind: 'line' | 'custom'; id: number };
    }
  | {
      type: 'ADD_CUSTOM_LOOP';
      payload: { movieId: string; startMs: number; endMs: number };
    }
  | {
      type: 'UPDATE_CUSTOM_LOOP_LABEL';
      payload: { loopId: number; label: string };
    }
  | {
      type: 'INCREMENT_CUSTOM_LOOP_LISTEN';
      payload: { loopId: number };
    }
  | {
      type: 'PLAY_CUSTOM_LOOP';
      payload: { loopId: number };
    }
  | {
      type: 'PLAY_CUSTOM_LOOP_IN_TAB';
      payload: {
        loopId: number;
        startMs: number;
        endMs: number;
        label?: string;
        expectedMovieId: string;
      };
    }
  | {
      type: 'DELETE_CUSTOM_LOOP';
      payload: { loopId: number };
    }
  | {
      type: 'CURRENT_LINE_CHANGED';
      payload: { lineId: number };
    }
  | {
      type: 'PLAY_LINE_LOOP';
      payload: { lineId: number };
    }
  | {
      type: 'PLAY_LINE_LOOP_IN_TAB';
      payload: {
        lineId: number;
        startMs: number;
        endMs: number;
        expectedMovieId: string;
      };
    }
  | {
      type: 'STOP_REPEAT';
    }
  | {
      type: 'STOP_REPEAT_IN_TAB';
    }
  | {
      type: 'REPEATING_LINE_CHANGED';
      payload: { lineId: number | null };
    }
  /** 사이드패널 "내 구간" 목록에서 현재 반복 중인 구간을 표시하기 위한 알림 */
  | {
      type: 'REPEATING_CUSTOM_LOOP_CHANGED';
      payload: { loopId: number | null };
    }
  | {
      type: 'SESSION_TICK';
      payload: { seconds: number };
    }
  | {
      type: 'OVERLAY_SHORTCUT';
      payload: { key: string };
    }
  | {
      type: 'OVERLAY_SHORTCUT_IN_TAB';
      payload: { key: string };
    }
  | {
      type: 'GET_CURRENT_VIDEO_TIME';
      payload: { contentId: number };
    }
  | {
      type: 'GET_CURRENT_VIDEO_TIME_IN_TAB';
    };

export type CueloopMessageType = CueloopMessage['type'];

export type CueloopMessageOf<T extends CueloopMessageType> = Extract<
  CueloopMessage,
  { type: T }
>;
