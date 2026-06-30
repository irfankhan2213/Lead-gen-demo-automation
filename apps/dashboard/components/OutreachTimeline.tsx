'use client';

import { Mail, MousePointer, Reply, AlertCircle, CheckCircle } from 'lucide-react';
import type { OutreachLog } from '@acquisition-engine/shared';

const EVENT_ICONS: Record<string, React.ElementType> = {
  sent:    Mail,
  opened:  MousePointer,
  clicked: MousePointer,
  replied: Reply,
  bounced: AlertCircle,
  default: CheckCircle,
};

const EVENT_COLORS: Record<string, string> = {
  sent:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  opened:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  clicked: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  replied: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  bounced: 'text-red-400 bg-red-500/10 border-red-500/20',
  default: 'text-[var(--text-secondary)] bg-[var(--bg-elevated)] border-[var(--border)]',
};

function formatDateTime(ts: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

/**
 * OutreachTimeline — renders a chronological list of outreach events for a lead.
 * Shows sent, opened, clicked, replied, and bounced events.
 *
 * @param log - Array of OutreachLog entries
 */
export default function OutreachTimeline({ log }: { log: OutreachLog[] }) {
  if (log.length === 0) return null;

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">Outreach Timeline</h2>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-px bg-[var(--border)]" />

        <div className="space-y-4">
          {log.map((entry, idx) => {
            const Icon = EVENT_ICONS[entry.event_type] ?? EVENT_ICONS.default;
            const colorClass = EVENT_COLORS[entry.event_type] ?? EVENT_COLORS.default;
            const isLast = idx === log.length - 1;

            return (
              <div key={entry.id} className={`flex gap-4 ${isLast ? '' : ''}`}>
                {/* Icon bubble */}
                <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center ${colorClass}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[var(--text-primary)] capitalize">
                      {entry.event_type}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{formatDateTime(entry.created_at)}</span>
                  </div>

                  {/* Event data details */}
                  {entry.event_data && Object.keys(entry.event_data).length > 0 && (
                    <div className="mt-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 font-mono">
                      {Object.entries(entry.event_data)
                        .filter(([k]) => ['to', 'subject', 'email_id'].includes(k))
                        .map(([k, v]) => (
                          <div key={k}>
                            <span className="text-[var(--text-muted)]">{k}: </span>
                            <span className="text-[var(--text-secondary)]">{String(v)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
