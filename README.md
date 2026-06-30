# Acquisition Engine — Evolve Expert Agency

## Overview
A Personalized Acquisition Engine that:
1. Scrapes deep business intelligence for any niche + city combo
2. Auto-generates custom website demos for each business using Claude AI
3. Hosts demos instantly on Vercel (free tier)
4. Sends high-converting cold outreach using the demo as the hook
5. Tracks everything on a real-time dashboard

## Tech Stack
- **Backend**: Node.js + Express + TypeScript
- **Scraping**: Playwright (headless) + Cheerio
- **AI**: Claude claude-sonnet-4-6 via Anthropic SDK
- **Database**: PostgreSQL via Supabase
- **Queue**: BullMQ + Redis (Upstash)
- **Frontend**: Next.js 14 App Router + Tailwind + shadcn/ui
- **Email**: Resend.com
- **Hosting Demos**: Vercel Deploy API

## Getting Started

### Prerequisites
- Node.js >= 18
- pnpm >= 8
- Docker (for local Postgres + Redis)

### Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in your API keys
cp .env.example .env

# 3. Start local services (Postgres + Redis)
docker-compose up -d

# 4. Run database migrations
pnpm --filter api db:migrate

# 5. Start development servers
pnpm dev
```

### Dashboard
Open http://localhost:3000 for the Next.js dashboard.

### API
Backend runs at http://localhost:3001.

## Architecture

```
acquisition-engine/
├── apps/
│   ├── api/         — Node.js + Express backend
│   └── dashboard/   — Next.js 14 frontend
└── packages/
    └── shared/      — Shared TypeScript types
```

## Build Order (Sprints)
See `implementation_plan.md` for detailed sprint breakdown.

## Security Notes
- All API keys must be in `.env` — never hardcoded
- Rate limiting enabled on all scrape routes
- Playwright runs in sandboxed headless mode
- Supabase RLS enabled on all tables
- Email sending requires manual approval or per-campaign rate cap

## Cost Estimate
~$0–$30/month at launch (Supabase free + Upstash free + Railway $5 + Vercel free + Resend free)
