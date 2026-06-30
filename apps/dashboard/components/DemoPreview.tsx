'use client';

import { ExternalLink, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { Lead } from '@acquisition-engine/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * DemoPreview component — shows an iframe preview of a generated demo site,
 * or a placeholder if no demo has been generated yet.
 *
 * @param lead - The lead whose demo to preview
 */
export default function DemoPreview({ lead }: { lead: Lead }) {
  const [showPreview, setShowPreview] = useState(true);

  // If demo is live, link to the real URL
  if (lead.demo_status === 'deployed' && lead.demo_url) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">🌐 Live Demo</h3>
          <a
            href={lead.demo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open live
          </a>
        </div>

        <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-3 break-all">
          🔗 {lead.demo_url}
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--text-muted)]">Preview</span>
          <button
            onClick={() => setShowPreview(v => !v)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1 transition-colors"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
        </div>

        {showPreview && (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden" style={{ height: '320px' }}>
            <iframe
              src={`${API_URL}/api/generate-demo/${lead.id}/preview`}
              className="w-full h-full"
              style={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '167%', height: '167%' }}
              title={`${lead.business_name} Demo`}
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    );
  }

  // If demo HTML exists but not deployed
  if (lead.demo_html || lead.demo_status === 'ready') {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">🎨 Demo Ready</h3>
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
          Demo generated — click "Deploy Demo" to make it live.
        </div>
        {showPreview && (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden" style={{ height: '240px' }}>
            <iframe
              src={`${API_URL}/api/generate-demo/${lead.id}/preview`}
              className="w-full h-full"
              style={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '167%', height: '167%' }}
              title={`${lead.business_name} Demo Preview`}
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    );
  }

  // Placeholder
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Demo Site</h3>
      <div className="flex flex-col items-center justify-center h-48 border border-dashed border-[var(--border)] rounded-lg text-[var(--text-muted)] gap-2">
        <div className="text-3xl opacity-30">🌐</div>
        <p className="text-xs text-center">
          {lead.demo_status === 'generating'
            ? '⏳ Demo is being generated…'
            : 'No demo generated yet.\nClick "Generate Demo" to create one.'}
        </p>
      </div>
    </div>
  );
}
