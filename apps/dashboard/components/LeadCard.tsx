'use client';

import Link from 'next/link';
import { Globe, Phone, Star, ArrowRight } from 'lucide-react';
import type { Lead } from '@acquisition-engine/shared';

/**
 * Returns the appropriate badge class for an outreach status.
 */
function outreachBadgeClass(status: Lead['outreach_status']): string {
  const map: Record<Lead['outreach_status'], string> = {
    pending:  'badge-pending',
    queued:   'badge-queued',
    sent:     'badge-sent',
    opened:   'badge-opened',
    replied:  'badge-replied',
    booked:   'badge-booked',
    lost:     'badge-lost',
  };
  return map[status] ?? 'badge-pending';
}

function demoBadgeClass(status: Lead['demo_status']): string {
  const map: Record<Lead['demo_status'], string> = {
    none:       'badge-none',
    generating: 'badge-generating',
    ready:      'badge-ready',
    deployed:   'badge-deployed',
    failed:     'badge-failed',
  };
  return map[status] ?? 'badge-none';
}

function ScoreBar({ score }: { score?: number }) {
  if (!score) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  const cls = score >= 7 ? 'score-high' : score >= 5 ? 'score-mid' : 'score-low';
  const barColor = score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold tabular-nums ${cls}`}>{score}/10</span>
      <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${score * 10}%` }} />
      </div>
    </div>
  );
}

/**
 * LeadCard — displays a condensed view of a single lead.
 * Used in the leads table/grid.
 */
export default function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link
      href={`/dashboard/leads/${lead.id}`}
      className="card hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] transition-all duration-150 group block"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Business info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-[var(--text-primary)] truncate">
              {lead.business_name ?? 'Unknown Business'}
            </h3>
            <span className={outreachBadgeClass(lead.outreach_status)}>
              {lead.outreach_status}
            </span>
            <span className={demoBadgeClass(lead.demo_status)}>
              {lead.demo_status === 'deployed' ? '🌐 Live Demo' : lead.demo_status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            <span className="text-xs text-[var(--text-muted)]">
              📍 {lead.city} · {lead.niche}
            </span>
            {lead.phone && (
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Phone className="w-3 h-3" /> {lead.phone}
              </span>
            )}
            {lead.website_url && (
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Globe className="w-3 h-3" /> Has website
              </span>
            )}
            {!lead.website_url && (
              <span className="text-xs text-amber-400">⚡ No website</span>
            )}
          </div>

          {/* Google rating */}
          {lead.google_rating && (
            <div className="flex items-center gap-1 mt-2">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-xs font-semibold text-amber-400">{lead.google_rating}</span>
              <span className="text-xs text-[var(--text-muted)]">
                ({lead.google_review_count ?? 0} reviews)
              </span>
            </div>
          )}
        </div>

        {/* Score + arrow */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <div className="w-28">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Opportunity</div>
            <ScoreBar score={lead.opportunity_score} />
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* Brand DNA preview */}
      {lead.brand_dna && (
        <p className="mt-3 text-xs text-[var(--text-muted)] line-clamp-2 border-t border-[var(--border)] pt-2">
          {lead.brand_dna}
        </p>
      )}
    </Link>
  );
}
