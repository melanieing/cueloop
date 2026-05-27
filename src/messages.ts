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
    };

export type CueloopMessageType = CueloopMessage['type'];

export type CueloopMessageOf<T extends CueloopMessageType> = Extract<
  CueloopMessage,
  { type: T }
>;
