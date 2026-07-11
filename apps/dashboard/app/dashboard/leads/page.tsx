'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import LeadCard from '@/components/LeadCard';
import type { Lead } from '@acquisition-engine/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const handleSelect = (e: React.MouseEvent, id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} leads?`)) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/leads/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (res.ok) {
        setSelectedIds(new Set());
        await fetchLeads();
      }
    } catch (err) {
      console.error('Failed to bulk delete leads:', err);
    } finally {
      setDeleting(false);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('outreach_status', statusFilter);
      if (scoreFilter) params.set('min_score', scoreFilter);

      const res = await fetch(`${API_URL}/api/leads?${params}`);
      if (res.ok) {
        const data = await res.json() as { leads: Lead[] };
        setLeads(data.leads);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, scoreFilter]);

  const filtered = leads.filter(lead =>
    !search || lead.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    lead.city?.toLowerCase().includes(search.toLowerCase()) ||
    lead.niche?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Leads</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {filtered.length} businesses scraped and analyzed
          </p>
        </div>
        <button onClick={fetchLeads} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            className="input pl-9"
            placeholder="Search by name, city, or niche…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <select
            className="input pl-9 pr-8 appearance-none min-w-40"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="opened">Opened</option>
            <option value="replied">Replied</option>
            <option value="booked">Booked</option>
          </select>
        </div>

        {/* Score filter */}
        <select
          className="input min-w-36"
          value={scoreFilter}
          onChange={e => setScoreFilter(e.target.value)}
        >
          <option value="">All Scores</option>
          <option value="7">Score 7+ (Hot)</option>
          <option value="5">Score 5+ (Warm)</option>
        </select>
      </div>

      {/* Leads Grid */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse h-24 bg-[var(--bg-elevated)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-lg font-semibold text-[var(--text-secondary)]">No leads found</p>
          <p className="text-sm mt-1">Start a new campaign to scrape businesses.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(lead => (
            <LeadCard 
              key={lead.id} 
              lead={lead} 
              selected={selectedIds.has(lead.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 lg:ml-32 -translate-x-1/2 bg-[var(--bg-elevated)] border border-brand-500/30 rounded-full px-6 py-3 shadow-2xl shadow-black flex items-center gap-4 z-50 animate-fade-in">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {selectedIds.size} leads selected
          </span>
          <div className="w-px h-4 bg-[var(--border-strong)]" />
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleBulkDelete}
            disabled={deleting}
            className="btn bg-red-500 hover:bg-red-600 text-white border-none py-1.5 px-4 rounded-full shadow-lg hover:shadow-red-500/25 transition-all text-sm font-semibold"
          >
            {deleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}
    </div>
  );
}
