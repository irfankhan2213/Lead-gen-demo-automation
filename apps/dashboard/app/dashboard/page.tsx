'use client';

import { useState, useCallback, useEffect } from 'react';
import { Users, Globe, Mail, TrendingUp, Play, X, Square, Loader2 } from 'lucide-react';
import LiveLog from '@/components/LiveLog';
import type { DashboardStats } from '@acquisition-engine/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function StatCard({
  label,
  value,
  icon: Icon,
  suffix = '',
  color = 'brand',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  suffix?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    brand: 'from-brand-600/20 to-brand-700/5 border-brand-500/20 text-brand-400',
    emerald: 'from-emerald-600/20 to-emerald-700/5 border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-600/20 to-amber-700/5 border-amber-500/20 text-amber-400',
    blue: 'from-blue-600/20 to-blue-700/5 border-blue-500/20 text-blue-400',
  };

  return (
    <div className={`card bg-gradient-to-br ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
            {value}{suffix}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorMap[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

interface CampaignState {
  jobId: string;
  niche: string;
  city: string;
  startedAt: Date;
}

function NewCampaignModal({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (jobId: string, niche: string, city: string) => void;
}) {
  const [niche, setNiche] = useState('');
  const [city, setCity] = useState('');
  const [limit, setLimit] = useState<string>('20');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !city.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          niche: niche.trim(), 
          city: city.trim(),
          limit: limit === 'unlimited' ? 'unlimited' : parseInt(limit, 10),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to start campaign');
      }

      const data = await res.json() as { jobId: string };
      onStart(data.jobId, niche.trim(), city.trim());
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card-elevated w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Start New Campaign</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Business Niche</label>
            <input
              className="input"
              placeholder="e.g. dentist, restaurant, gym, salon"
              value={niche}
              onChange={e => setNiche(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">City / Location</label>
            <input
              className="input"
              placeholder="e.g. Ludhiana, Austin TX, London UK"
              value={city}
              onChange={e => setCity(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Leads to Generate</label>
            <select 
              className="input bg-[var(--bg-elevated)]"
              value={limit}
              onChange={e => setLimit(e.target.value)}
            >
              <option value="10">10 Leads</option>
              <option value="20">20 Leads</option>
              <option value="50">50 Leads</option>
              <option value="100">100 Leads</option>
              <option value="unlimited">Unlimited (Scrape until dead end)</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting…
                </span>
              ) : (
                <span className="flex items-center gap-2"><Play className="w-4 h-4" /> Launch Campaign</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total_leads: 0,
    demos_generated: 0,
    emails_sent: 0,
    reply_rate: 0,
    avg_opportunity_score: 0,
    leads_this_week: 0,
  });
  const [showModal, setShowModal] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<CampaignState | null>(null);
  const [stopping, setStopping] = useState(false);

  // ─── Load stats from API ────────────────────────────────────────────────
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/leads/stats`);
        if (res.ok) {
          const data = await res.json() as DashboardStats;
          setStats(data);
        }
      } catch { /* silently ignore if stats endpoint not ready */ }
    };
    fetchStats();
    // Refresh stats every 15 seconds
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  // ─── Campaign start ─────────────────────────────────────────────────────
  const handleCampaignStart = useCallback((jobId: string, niche: string, city: string) => {
    setActiveCampaign({ jobId, niche, city, startedAt: new Date() });
  }, []);

  // ─── Campaign stop ──────────────────────────────────────────────────────
  const handleCampaignStop = useCallback(async () => {
    if (!activeCampaign) return;
    setStopping(true);
    try {
      await fetch(`${API_URL}/api/scrape/${activeCampaign.jobId}`, {
        method: 'DELETE',
      });
    } catch { /* ignore errors — will clear locally anyway */ } finally {
      setStopping(false);
      setActiveCampaign(null);
    }
  }, [activeCampaign]);

  const isRunning = !!activeCampaign;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Campaign Overview</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Real-time lead generation dashboard — Evolve Expert Agency
          </p>
        </div>

        {/* Action button: Stop if running, New if idle */}
        {isRunning ? (
          <div className="flex items-center gap-3">
            {/* Active campaign pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeCampaign.niche} · {activeCampaign.city}
            </div>
            <button
              onClick={handleCampaignStop}
              disabled={stopping}
              className="btn-secondary flex items-center gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all"
            >
              {stopping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {stopping ? 'Stopping…' : 'Stop Campaign'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            <Play className="w-4 h-4" />
            New Campaign
          </button>
        )}
      </div>

      {/* Active campaign notice */}
      {isRunning && (
        <div className="flex items-center gap-3 px-4 py-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-sm">
          <Loader2 className="w-4 h-4 text-brand-400 animate-spin flex-shrink-0" />
          <span className="text-brand-300 font-medium">
            Campaign running — scraping <span className="text-white">{activeCampaign.niche}</span> businesses in <span className="text-white">{activeCampaign.city}</span>
          </span>
          <span className="ml-auto text-[10px] text-[var(--text-muted)] tabular-nums">
            Started {activeCampaign.startedAt.toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={stats.total_leads} icon={Users} color="brand" />
        <StatCard label="Demos Live" value={stats.demos_generated} icon={Globe} color="emerald" />
        <StatCard label="Emails Sent" value={stats.emails_sent} icon={Mail} color="blue" />
        <StatCard label="Reply Rate" value={stats.reply_rate} suffix="%" icon={TrendingUp} color="amber" />
      </div>

      {/* Live Log + Quick Stats */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Pass jobId once campaign is active so SSE subscribes to it; */}
          {/* pass undefined otherwise to show global stream */}
          <LiveLog jobId={activeCampaign?.jobId} onComplete={() => setActiveCampaign(null)} />
        </div>

        <div className="space-y-4">
          {/* Pipeline summary */}
          <div className="card">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Pipeline Health</h3>
            <div className="space-y-3">
              {[
                { label: 'Leads This Week', value: stats.leads_this_week, color: 'bg-brand-500' },
                { label: 'Avg Score', value: `${stats.avg_opportunity_score}/10`, color: 'bg-amber-500' },
                { label: 'Demos Generated', value: stats.demos_generated, color: 'bg-emerald-500' },
                { label: 'Reply Rate', value: `${stats.reply_rate}%`, color: 'bg-blue-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    {item.label}
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="card">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'View all leads', href: '/dashboard/leads' },
                { label: 'Manage outreach', href: '/dashboard/outreach' },
                { label: 'Browse demo sites', href: '/dashboard/demos' },
                { label: 'API settings', href: '/dashboard/settings' },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {item.label}
                  <span className="text-[var(--text-muted)]">→</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* New Campaign Modal — blocked when a campaign is already running */}
      {showModal && !isRunning && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onStart={(jobId, niche, city) => {
            handleCampaignStart(jobId, niche, city);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
