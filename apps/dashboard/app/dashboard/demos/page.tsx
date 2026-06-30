'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Globe, RefreshCw } from 'lucide-react';
import type { Lead } from '@acquisition-engine/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function DemosPage() {
  const [demos, setDemos] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDemos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leads?demo_status=deployed&limit=100`);
      if (res.ok) {
        const data = await res.json() as { leads: Lead[] };
        setDemos(data.leads);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDemos(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Live Demo Sites</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{demos.length} demos deployed and live</p>
        </div>
        <button onClick={fetchDemos} className="btn-secondary">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse h-40 bg-[var(--bg-elevated)]" />
          ))}
        </div>
      ) : demos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
          <Globe className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-lg font-semibold text-[var(--text-secondary)]">No demos deployed yet</p>
          <p className="text-sm mt-1">Generate and deploy demos from the Leads page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {demos.map(demo => (
            <div key={demo.id} className="card hover:border-[var(--border-strong)] transition-all">
              {/* Demo thumbnail placeholder */}
              <div
                className="rounded-lg mb-3 flex items-center justify-center text-3xl border border-[var(--border)]"
                style={{
                  height: '140px',
                  background: `linear-gradient(135deg, ${Array.isArray(demo.brand_colors) ? (demo.brand_colors as string[])[0] ?? '#7c3aed' : '#7c3aed'}22, #7c3aed11)`,
                }}
              >
                🌐
              </div>

              <h3 className="font-semibold text-[var(--text-primary)] truncate">{demo.business_name}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{demo.city} · {demo.niche}</p>

              {demo.demo_url && (
                <div className="mt-3 flex gap-2">
                  <a
                    href={demo.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary flex-1 justify-center text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Live Site
                  </a>
                  <a
                    href={`/dashboard/leads/${demo.id}`}
                    className="btn-secondary text-xs"
                  >
                    Details
                  </a>
                </div>
              )}

              <div className="mt-2 text-[10px] text-[var(--text-muted)] truncate font-mono">
                {demo.demo_url}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
