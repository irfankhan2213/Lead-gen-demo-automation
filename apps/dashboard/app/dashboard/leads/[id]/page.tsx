'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Globe, Phone, MapPin, Star, Zap, Mail,
  ExternalLink, Send, RefreshCw, Eye
} from 'lucide-react';
import DemoPreview from '@/components/DemoPreview';
import OutreachTimeline from '@/components/OutreachTimeline';
import type { Lead, OutreachLog } from '@acquisition-engine/shared';

const API_URL = ''; // Use relative path to trigger Next.js rewrites (bypasses ISP blocks)

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2 border-b border-[var(--border)] last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[var(--text-secondary)] flex-1 break-words">{String(value)}</span>
    </div>
  );
}

function PainPointBadge({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-red-500/8 border border-red-500/15 rounded-lg text-xs text-red-300">
      <span className="mt-0.5 flex-shrink-0">⚠️</span>
      {text}
    </div>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [log, setLog] = useState<OutreachLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [deployingDemo, setDeployingDemo] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const fetchLead = async () => {
    try {
      const [leadRes, logRes] = await Promise.all([
        fetch(`${API_URL}/api/leads/${id}`),
        fetch(`${API_URL}/api/leads/${id}/log`),
      ]);
      if (leadRes.ok) setLead(await leadRes.json() as Lead);
      if (logRes.ok) {
        const data = await logRes.json() as { log: OutreachLog[] };
        setLog(data.log);
      }
    } catch (err) {
      console.error('Failed to fetch lead:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLead(); }, [id]);

  const generateDemo = async () => {
    setGenerating(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API_URL}/api/generate-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id }),
      });
      const data = await res.json() as { message: string };
      setActionMsg(`✅ ${data.message}`);
      setTimeout(fetchLead, 5000);
    } catch { setActionMsg('❌ Failed to queue demo generation'); }
    finally { setGenerating(false); }
  };

  const deployDemo = async () => {
    setDeployingDemo(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id }),
      });
      const data = await res.json() as { demoUrl: string };
      setActionMsg(`✅ Live at: ${data.demoUrl}`);
      fetchLead();
    } catch { setActionMsg('❌ Deployment failed'); }
    finally { setDeployingDemo(false); }
  };

  const generateEmail = async () => {
    setActionMsg('');
    try {
      const res = await fetch(`${API_URL}/api/outreach/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id }),
      });
      if (res.ok) {
        setActionMsg('✅ Email copy generated');
        fetchLead();
      } else {
        const err = await res.json() as { error: string };
        setActionMsg(`❌ ${err.error}`);
      }
    } catch { setActionMsg('❌ Email generation failed'); }
  };

  const sendEmail = async () => {
    setSendingEmail(true);
    setActionMsg('');
    try {
      const res = await fetch(`${API_URL}/api/outreach/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id }),
      });
      if (res.ok) {
        setActionMsg('✅ Email sent successfully!');
        fetchLead();
      } else {
        const err = await res.json() as { error: string };
        setActionMsg(`❌ ${err.error}`);
      }
    } catch { setActionMsg('❌ Send failed'); }
    finally { setSendingEmail(false); }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-24 bg-[var(--bg-elevated)]" />)}
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
        <p className="text-lg">Lead not found</p>
        <Link href="/dashboard/leads" className="btn-secondary mt-4">← Back to leads</Link>
      </div>
    );
  }

  const painPoints = Array.isArray(lead.pain_points) ? lead.pain_points as string[] : [];
  const services = Array.isArray(lead.services) ? lead.services as string[] : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/leads" className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to leads
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{lead.business_name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-[var(--text-muted)]">📍 {lead.city} · {lead.niche}</span>
            {lead.opportunity_score && (
              <span className={`text-sm font-bold ${lead.opportunity_score >= 7 ? 'text-emerald-400' : lead.opportunity_score >= 5 ? 'text-amber-400' : 'text-red-400'}`}>
                Score: {lead.opportunity_score}/10
              </span>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={fetchLead} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          {!lead.demo_html && (
            <button onClick={generateDemo} disabled={generating} className="btn-secondary">
              {generating ? '⏳ Generating…' : '🎨 Generate Demo'}
            </button>
          )}
          {lead.demo_html && lead.demo_status !== 'deployed' && (
            <button onClick={deployDemo} disabled={deployingDemo} className="btn-secondary">
              {deployingDemo ? '⏳ Deploying…' : '🚀 Deploy Demo'}
            </button>
          )}
          {lead.demo_url && !lead.email_subject && (
            <button onClick={generateEmail} className="btn-secondary">
              <Mail className="w-4 h-4" /> Generate Email
            </button>
          )}
          {lead.email_subject && lead.outreach_status === 'queued' && (
            <button onClick={sendEmail} disabled={sendingEmail} className="btn-primary">
              {sendingEmail ? '⏳ Sending…' : <><Send className="w-4 h-4" /> Send Email</>}
            </button>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${actionMsg.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {actionMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column — Business info */}
        <div className="xl:col-span-2 space-y-5">

          {/* Basic info card */}
          <div className="card">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Business Information</h2>
            <InfoRow label="Business Name" value={lead.business_name} />
            <InfoRow label="Address" value={lead.address} />
            <InfoRow label="Phone" value={lead.phone} />
            <InfoRow label="Email" value={lead.email} />
            <InfoRow label="Website" value={lead.website_url} />
            <InfoRow label="Google Rating" value={lead.google_rating ? `${lead.google_rating} ⭐ (${lead.google_review_count} reviews)` : undefined} />
            {lead.google_maps_url && (
              <div className="py-2">
                <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> View on Google Maps <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* AI Analysis card */}
          {lead.brand_dna && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-brand-400" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI Brand Analysis</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Brand DNA</p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{lead.brand_dna}</p>
                </div>
                {painPoints.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Pain Points</p>
                    <div className="space-y-2">
                      {painPoints.map((p, i) => <PainPointBadge key={i} text={p} />)}
                    </div>
                  </div>
                )}
                {services.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Services</p>
                    <div className="flex flex-wrap gap-2">
                      {services.map((s, i) => (
                        <span key={i} className="badge bg-brand-500/15 text-brand-300">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email preview */}
          {lead.email_subject && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Outreach Email</h2>
                <span className={`badge badge-${lead.outreach_status}`}>{lead.outreach_status}</span>
              </div>
              <div className="bg-[var(--bg-base)] rounded-lg p-4 border border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">Subject</p>
                <p className="font-semibold text-[var(--text-primary)] mb-4">{lead.email_subject}</p>
                <p className="text-xs text-[var(--text-muted)] mb-1">Body</p>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{lead.email_body}</p>
              </div>
            </div>
          )}

          {/* Outreach Timeline */}
          {log.length > 0 && (
            <OutreachTimeline log={log} />
          )}
        </div>

        {/* Right column — Demo + social */}
        <div className="space-y-5">
          {/* Demo preview */}
          <DemoPreview lead={lead} />

          {/* Social & scraped */}
          {lead.yelp_reviews_summary && (
            <div className="card">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                <Star className="inline w-4 h-4 text-amber-400 mr-1" />
                Yelp Reviews Summary
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{lead.yelp_reviews_summary}</p>
            </div>
          )}

          {lead.instagram_bio && (
            <div className="card">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">📱 Instagram</h3>
              <p className="text-xs text-[var(--text-secondary)]">{lead.instagram_bio}</p>
            </div>
          )}

          {/* Brand colors */}
          {Array.isArray(lead.brand_colors) && (lead.brand_colors as string[]).length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">🎨 Brand Colors</h3>
              <div className="flex gap-2">
                {(lead.brand_colors as string[]).map((color, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-lg border border-[var(--border)]" style={{ background: color }} />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{color}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
