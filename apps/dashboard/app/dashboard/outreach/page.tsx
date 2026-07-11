'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, RefreshCw, Zap, Mail, CheckCircle, X } from 'lucide-react';
import type { Lead } from '@acquisition-engine/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function StatusBadge({ status }: { status: Lead['outreach_status'] }) {
  const cls = `badge badge-${status}`;
  return <span className={cls}>{status}</span>;
}

export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');
  const [generatingAll, setGeneratingAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      // Leads that have a demo but haven't been sent email yet
      const res = await fetch(`${API_URL}/api/leads?limit=100`);
      if (res.ok) {
        const data = await res.json() as { leads: Lead[] };
        // Show leads with deployed demos
        setLeads(data.leads.filter(l => l.demo_status === 'deployed' || l.demo_url));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const generateEmailForLead = async (leadId: string) => {
    try {
      await fetch(`${API_URL}/api/outreach/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      fetchLeads();
    } catch { /* ignore */ }
  };

  const sendToLead = async (leadId: string) => {
    try {
      await fetch(`${API_URL}/api/outreach/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      fetchLeads();
    } catch { /* ignore */ }
  };

  const bulkSend = async () => {
    setBulkSending(true);
    setBulkMsg('');
    try {
      const res = await fetch(`${API_URL}/api/outreach/bulk-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20 }),
      });
      const data = await res.json() as { queued: number };
      setBulkMsg(`✅ Queued ${data.queued} emails for sending`);
      fetchLeads();
    } catch {
      setBulkMsg('❌ Bulk send failed');
    } finally {
      setBulkSending(false);
    }
  };

  const generateAllEmails = async () => {
    setGeneratingAll(true);
    const readyLeads = leads.filter(l => l.demo_url && !l.email_subject && l.outreach_status === 'pending');
    for (const lead of readyLeads) {
      await generateEmailForLead(lead.id);
    }
    setGeneratingAll(false);
    fetchLeads();
  };

  const pending = leads.filter(l => l.outreach_status === 'pending' && !l.email_subject);
  const readyToSend = leads.filter(l => l.email_subject && l.outreach_status === 'queued');
  const sent = leads.filter(l => ['sent', 'opened', 'replied', 'booked'].includes(l.outreach_status));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Outreach</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Manage your cold email campaigns</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchLeads} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          {pending.length > 0 && (
            <button onClick={generateAllEmails} disabled={generatingAll} className="btn-secondary">
              <Zap className="w-4 h-4" />
              {generatingAll ? 'Generating…' : `Generate ${pending.length} Emails`}
            </button>
          )}
          {readyToSend.length > 0 && (
            <button onClick={bulkSend} disabled={bulkSending} className="btn-primary">
              <Send className="w-4 h-4" />
              {bulkSending ? 'Sending…' : `Send All (${readyToSend.length})`}
            </button>
          )}
        </div>
      </div>

      {bulkMsg && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${bulkMsg.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {bulkMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{pending.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Awaiting Email Gen</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-amber-400">{readyToSend.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Ready to Send</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-emerald-400">{sent.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Emails Sent</div>
        </div>
      </div>

      {/* Lead table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="card animate-pulse h-16 bg-[var(--bg-elevated)]" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
          <Mail className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-lg font-semibold text-[var(--text-secondary)]">No outreach-ready leads</p>
          <p className="text-sm mt-1">Deploy demo sites first, then come back here.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--border)]">
                <th className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pb-3 pr-4">Business</th>
                <th className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pb-3 pr-4">Email</th>
                <th className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pb-3 pr-4">Subject</th>
                <th className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pb-3 pr-4">Status</th>
                <th className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {leads.map(lead => (
                <tr key={lead.id} className="group hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-[var(--text-primary)] truncate max-w-40">
                      {lead.business_name}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{lead.city}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs text-[var(--text-secondary)] truncate block max-w-36">
                      {lead.email ?? <span className="text-[var(--text-muted)]">Not found</span>}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs text-[var(--text-secondary)] truncate block max-w-48">
                      {lead.email_subject ?? <span className="italic text-[var(--text-muted)]">Not generated</span>}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={lead.outreach_status} />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1.5">
                      {!lead.email_subject && (
                        <button
                          onClick={() => generateEmailForLead(lead.id)}
                          className="btn-secondary text-xs px-2 py-1"
                        >
                          <Zap className="w-3 h-3" /> Generate
                        </button>
                      )}
                      {lead.email_subject && (
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="btn-secondary text-xs px-2 py-1"
                        >
                          Preview
                        </button>
                      )}
                      {lead.email_subject && lead.email && lead.outreach_status === 'queued' && (
                        <button
                          onClick={() => sendToLead(lead.id)}
                          className="btn-primary text-xs px-2 py-1"
                        >
                          <Send className="w-3 h-3" /> Send
                        </button>
                      )}
                      {['sent', 'opened', 'replied', 'booked'].includes(lead.outreach_status) && (
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-1" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-elevated w-full max-w-lg animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Email Preview</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">To: {selectedLead.email} ({selectedLead.business_name})</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Subject</label>
                <div className="mt-1 p-3 bg-[var(--bg-elevated)] rounded-lg text-sm text-[var(--text-primary)] border border-[var(--border)]">
                  {selectedLead.email_subject}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Body</label>
                <div className="mt-1 p-3 bg-[var(--bg-elevated)] rounded-lg text-sm text-[var(--text-primary)] whitespace-pre-wrap border border-[var(--border)] font-mono text-xs">
                  {selectedLead.email_body || 'Body not generated yet.'}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setSelectedLead(null)} className="btn-secondary">Close</button>
              {selectedLead.outreach_status === 'queued' && selectedLead.email && (
                 <button onClick={() => { sendToLead(selectedLead.id); setSelectedLead(null); }} className="btn-primary">
                   <Send className="w-4 h-4" /> Send Now
                 </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
