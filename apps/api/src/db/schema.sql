-- =============================================================================
-- Acquisition Engine — PostgreSQL Schema
-- Run: psql $DATABASE_URL -f schema.sql
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CAMPAIGNS
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  niche VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  -- Counters (updated via triggers/application)
  leads_count INTEGER NOT NULL DEFAULT 0,
  demos_generated INTEGER NOT NULL DEFAULT 0,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  replies_received INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_niche_city ON campaigns(niche, city);

-- =============================================================================
-- LEADS (core entity)
-- =============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Campaign association
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Search context
  niche VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,

  -- Business info
  business_name VARCHAR(255),
  owner_name VARCHAR(255),
  website_url VARCHAR(500),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  google_maps_url VARCHAR(500),
  google_rating DECIMAL(2,1),
  google_review_count INTEGER,

  -- Scraped intelligence
  brand_colors JSONB,             -- ["#hex1", "#hex2"]
  brand_fonts JSONB,              -- ["font1", "font2"]
  tagline TEXT,
  about_text TEXT,
  services JSONB,                 -- ["service1", "service2"]
  menu_or_pricing JSONB,          -- [{name, price}]
  social_links JSONB,             -- {instagram, facebook, twitter}
  reddit_mentions JSONB,          -- [{subreddit, text, sentiment}]
  yelp_reviews_summary TEXT,
  instagram_bio TEXT,
  instagram_post_themes TEXT,

  -- AI analysis outputs
  brand_dna TEXT,
  tone VARCHAR(50),
  pain_points JSONB,              -- ["weakness1", "weakness2"]
  opportunity_score INTEGER CHECK (opportunity_score BETWEEN 1 AND 10),
  opportunity_reason TEXT,
  recommended_template VARCHAR(50),
  hero_headline TEXT,
  hero_subline TEXT,
  cta_text TEXT,
  estimated_revenue_potential VARCHAR(50),

  -- Demo
  demo_mode VARCHAR(50) DEFAULT 'template',
  demo_status VARCHAR(50) NOT NULL DEFAULT 'none',
  demo_html TEXT,
  demo_url VARCHAR(500),
  demo_deployed_at TIMESTAMPTZ,
  vercel_deployment_id VARCHAR(255),
  hero_image_url TEXT,

  -- Outreach
  outreach_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  email_subject TEXT,
  email_body TEXT,
  email_sent_at TIMESTAMPTZ,
  email_opened_at TIMESTAMPTZ,
  reply_received_at TIMESTAMPTZ,
  reply_text TEXT,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  last_follow_up_at TIMESTAMPTZ,

  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_outreach_status ON leads(outreach_status);
CREATE INDEX IF NOT EXISTS idx_leads_demo_status ON leads(demo_status);
CREATE INDEX IF NOT EXISTS idx_leads_opportunity_score ON leads(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_niche_city ON leads(niche, city);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Prevent duplicate leads for the same business in the same city
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_business_city_unique ON leads(business_name, city)
  WHERE business_name IS NOT NULL;

-- Migration: change opportunity_score from INTEGER to DECIMAL to support AI float scores
ALTER TABLE leads ALTER COLUMN opportunity_score TYPE DECIMAL(3,1) USING opportunity_score::DECIMAL(3,1);
-- Remove the old CHECK constraint (it will be recreated with proper type below)
-- Note: DROP CONSTRAINT IF EXISTS may fail if the constraint name differs; skip if no error
-- ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_opportunity_score_check;


-- =============================================================================
-- OUTREACH LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,  -- sent | opened | clicked | replied | bounced
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_log_lead_id ON outreach_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_log_event_type ON outreach_log(event_type);
CREATE INDEX IF NOT EXISTS idx_outreach_log_created_at ON outreach_log(created_at DESC);

-- =============================================================================
-- AUTO-UPDATE updated_at ON leads
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
