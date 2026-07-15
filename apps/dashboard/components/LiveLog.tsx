'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import type { SSEEvent } from '@acquisition-engine/shared';

const API_URL = ''; // Use relative path to trigger Next.js rewrites (bypasses ISP blocks)

const LEVEL_ICONS: Record<SSEEvent['level'], string> = {
  info: '·',
  success: '✓',
  warn: '⚠',
  error: '✗',
};

const LEVEL_CLASSES: Record<SSEEvent['level'], string> = {
  info: 'log-info',
  success: 'log-success',
  warn: 'log-warn',
  error: 'log-error',
};

interface LogLine extends SSEEvent {
  id: string;
}

/**
 * LiveLog component — streams real-time SSE events from the backend.
 *
 * Key fix: we always open a global SSE connection. When a jobId is provided,
 * we additionally open a job-scoped connection so events arrive immediately.
 * Both connections feed the same log display.
 *
 * @param jobId      - When set, subscribes specifically to that job's events.
 * @param onComplete - Called when the campaign finishes (receives a "complete" event).
 */
export default function LiveLog({
  jobId,
  onComplete,
}: {
  jobId?: string;
  onComplete?: () => void;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Track all open EventSource connections so we can close them
  const esRefs = useRef<EventSource[]>([]);

  const addLine = useCallback((event: SSEEvent) => {
    const line: LogLine = {
      ...event,
      id: `${Date.now()}-${Math.random()}`,
    };
    setLines(prev => {
      const next = [...prev, line];
      return next.length > 500 ? next.slice(-500) : next;
    });
    setLineCount(c => c + 1);
  }, []);

  const openConnection = useCallback(
    (url: string, mountedRef: React.MutableRefObject<boolean>, onConnected?: () => void) => {
      const es = new EventSource(url);
      esRefs.current.push(es);

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        onConnected?.();
      };

      es.onmessage = (e) => {
        if (!mountedRef.current) return;
        try {
          const event = JSON.parse(e.data) as SSEEvent | { type: string };

          // Skip initial handshake ping
          if ('type' in event && (event as { type: string }).type === 'connected') return;

          const sseEvent = event as SSEEvent;
          addLine(sseEvent);

          // Detect campaign completion: "🎉 Campaign scrape complete!" message from scraper
          if (
            sseEvent.level === 'success' &&
            typeof sseEvent.message === 'string' &&
            (
              sseEvent.message.toLowerCase().includes('campaign scrape complete') ||
              sseEvent.message.toLowerCase().includes('campaign complete') ||
              (sseEvent.message.toLowerCase().includes('complet') && sseEvent.message.toLowerCase().includes('saved'))
            )
          ) {
            onComplete?.();
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        // Remove from refs
        esRefs.current = esRefs.current.filter(x => x !== es);
        // Reconnect after 3s only if still mounted
        setTimeout(() => {
          if (mountedRef.current) openConnection(url, mountedRef);
        }, 3000);
      };

      return es;
    },
    [addLine, onComplete]
  );

  useEffect(() => {
    const mountedRef = { current: true };

    // Close all previous connections
    esRefs.current.forEach(es => es.close());
    esRefs.current = [];

    // 1. Always open a global connection so we get all activity
    const globalUrl = `${API_URL}/api/events`;
    openConnection(globalUrl, mountedRef);

    // 2. If a jobId is active, also open a job-scoped connection
    //    This ensures events emitted right after job creation are captured
    if (jobId) {
      const jobUrl = `${API_URL}/api/events?jobId=${encodeURIComponent(jobId)}`;
      openConnection(jobUrl, mountedRef, () => {
        // Add a local marker that this job's stream started
        addLine({
          jobId,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `📡 Connected to job stream ${jobId.slice(0, 8)}…`,
        });
      });
    }

    return () => {
      mountedRef.current = false;
      esRefs.current.forEach(es => es.close());
      esRefs.current = [];
    };
  }, [jobId, openConnection, addLine]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lineCount]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
    } catch {
      return '--:--:--';
    }
  };

  const clearLogs = () => setLines([]);

  return (
    <div className="card flex flex-col h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Live Activity Log</h3>
          {jobId && (
            <span className="badge badge-queued text-[10px]">Job: {jobId.slice(0, 8)}…</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearLogs}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Clear
          </button>
          <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {connected ? 'Live' : 'Reconnecting…'}
          </div>
        </div>
      </div>

      {/* Log container */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] rounded-lg p-4 font-mono text-xs space-y-0.5 border border-[var(--border)]">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
            <Terminal className="w-8 h-8 opacity-30" />
            <p>Waiting for activity…</p>
            <p className="text-[10px]">Start a campaign to see live updates here.</p>
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`log-entry ${LEVEL_CLASSES[line.level]}`}>
              <span className="text-[var(--text-muted)] flex-shrink-0 tabular-nums">
                [{formatTime(line.timestamp)}]
              </span>
              <span className="flex-shrink-0">{LEVEL_ICONS[line.level]}</span>
              <span className="flex-1 break-all">{line.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-[var(--text-muted)]">
        <span>{lines.length} log entries</span>
        {jobId ? (
          <span className="flex items-center gap-1 text-emerald-500">
            <CheckCircle className="w-3 h-3" /> Subscribed to job
          </span>
        ) : (
          <span>Global stream — start a campaign to track a specific job</span>
        )}
      </div>
    </div>
  );
}
