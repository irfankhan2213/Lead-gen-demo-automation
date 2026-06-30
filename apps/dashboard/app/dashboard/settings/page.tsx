'use client';

import { useState } from 'react';
import { Eye, EyeOff, Save, CheckCircle } from 'lucide-react';

interface EnvField {
  key: string;
  label: string;
  placeholder: string;
  group: string;
  required?: boolean;
}

const ENV_FIELDS: EnvField[] = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', placeholder: 'sk-ant-...', group: 'AI', required: true },
  { key: 'DATABASE_URL', label: 'Database URL', placeholder: 'postgresql://...', group: 'Database', required: true },
  { key: 'REDIS_URL', label: 'Redis URL', placeholder: 'redis://...', group: 'Queue', required: true },
  { key: 'VERCEL_TOKEN', label: 'Vercel Token', placeholder: 'your-vercel-token', group: 'Hosting', required: true },
  { key: 'VERCEL_TEAM_ID', label: 'Vercel Team ID', placeholder: 'team_...', group: 'Hosting' },
  { key: 'RESEND_API_KEY', label: 'Resend API Key', placeholder: 're_...', group: 'Email', required: true },
  { key: 'FROM_EMAIL', label: 'From Email', placeholder: 'hello@yourdomain.com', group: 'Email', required: true },
  { key: 'SERPAPI_KEY', label: 'SerpAPI Key', placeholder: 'Optional', group: 'Scraping' },
  { key: 'APIFY_TOKEN', label: 'Apify Token', placeholder: 'Optional fallback', group: 'Scraping' },
];

const GROUPS = Array.from(new Set(ENV_FIELDS.map(f => f.group)));

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const toggleVisibility = (key: string) => {
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    // In production this would update env vars via your secrets manager (Doppler etc.)
    // For now, show confirmation
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          API keys and environment configuration — store in your .env file or Doppler.
        </p>
      </div>

      {/* Status note */}
      <div className="card bg-amber-500/5 border-amber-500/20">
        <div className="flex items-start gap-3">
          <div className="text-amber-400 text-lg">⚠️</div>
          <div className="text-sm text-amber-300">
            <strong>Development note:</strong> These fields are for reference only — edit your{' '}
            <code className="font-mono text-xs bg-amber-500/10 px-1 rounded">.env</code> file directly.
            In production, use Doppler or Railway environment variables.
          </div>
        </div>
      </div>

      {GROUPS.map(group => {
        const fields = ENV_FIELDS.filter(f => f.group === group);
        return (
          <div key={group} className="card space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3">
              {group}
            </h2>
            {fields.map(field => (
              <div key={field.key}>
                <label className="label">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={visible.has(field.key) ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ''}
                    onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility(field.key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    {visible.has(field.key) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-muted)] font-mono">
                  {field.key}
                </p>
              </div>
            ))}
          </div>
        );
      })}

      {/* .env.example copy */}
      <div className="card">
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">.env Template</h2>
        <pre className="text-xs text-[var(--text-secondary)] font-mono bg-[var(--bg-base)] border border-[var(--border)] rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
{`# Acquisition Engine — .env

# AI
ANTHROPIC_API_KEY=

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Redis (Upstash)
REDIS_URL=redis://default:[PASSWORD]@[HOST]:[PORT]

# Vercel
VERCEL_TOKEN=
VERCEL_TEAM_ID=

# Email (Resend)
RESEND_API_KEY=
FROM_EMAIL=hello@youragency.com
FROM_NAME=Your Agency

# Scraping (optional paid)
SERPAPI_KEY=
APIFY_TOKEN=

# App
PORT=3001
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
DASHBOARD_URL=http://localhost:3000`}
        </pre>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave} className="btn-primary">
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Configuration</>}
        </button>
      </div>
    </div>
  );
}
