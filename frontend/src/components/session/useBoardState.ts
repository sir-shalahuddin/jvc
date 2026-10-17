import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchBoardState, leavePresenceApi } from '../../services/sessionApi';
import type { BoardState } from '../../types/session';

const VISIBLE_MS = 3000;
const HIDDEN_MS = 10000;

export interface BoardStateHook {
  data: BoardState | null;
  error: ApiError | null;
  /** True while the last poll failed but we still show the previous data. */
  offline: boolean;
  /** server_time_ms - Date.now() at the moment the last state arrived. */
  clockOffset: number;
  refresh: () => Promise<void>;
}

// Polls GET /api/session/state: every 3 s, every 10 s while the tab is hidden,
// and immediately when the tab becomes visible again or after a mutation (refresh()).
export function useBoardState(sessionId: string, clientId: string, presenceName: string): BoardStateHook {
  const [data, setData] = useState<BoardState | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [offline, setOffline] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);

  const nameRef = useRef(presenceName);
  nameRef.current = presenceName;
  const timerRef = useRef<number | undefined>(undefined);
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const alive = useRef(true);

  const loadRef = useRef<() => Promise<void>>(async () => {});
  const hasData = useRef(false);

  const schedule = useCallback(() => {
    window.clearTimeout(timerRef.current);
    if (!alive.current) return;
    timerRef.current = window.setTimeout(() => void loadRef.current(), document.hidden ? HIDDEN_MS : VISIBLE_MS);
  }, []);

  const load = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      setError(new ApiError('Sesi tidak ditemukan', 404));
      return;
    }
    if (inflight.current) {
      // A request is running; fetch once more after it so mutations are reflected.
      again.current = true;
      return inflight.current;
    }
    const run = (async () => {
      try {
        const st = await fetchBoardState(sessionId, { clientId, name: nameRef.current });
        if (!alive.current) return;
        hasData.current = true;
        setData(st);
        setClockOffset((st.server_time_ms || Date.now()) - Date.now());
        setOffline(false);
        setError(null);
      } catch (e) {
        if (!alive.current) return;
        const err = e instanceof ApiError ? e : new ApiError('Gagal memuat sesi', 0);
        if (err.status === 404) {
          setError(err);
        } else {
          setOffline(true);
          // First load failed: there is nothing to show, surface the error.
          if (!hasData.current) setError(err);
        }
      }
    })();
    inflight.current = run;
    try {
      await run;
    } finally {
      inflight.current = null;
      if (again.current && alive.current) {
        again.current = false;
        await load();
      } else {
        schedule();
      }
    }
  }, [sessionId, clientId, schedule]);
  loadRef.current = load;

  useEffect(() => {
    alive.current = true;
    void load();
    const onVis = () => {
      if (!document.hidden) void load();
      else schedule();
    };
    const onHide = () => leavePresenceApi(sessionId, clientId);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      alive.current = false;
      window.clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      leavePresenceApi(sessionId, clientId);
    };
  }, [sessionId, clientId, load, schedule]);

  return { data, error, offline, clockOffset, refresh: load };
}
