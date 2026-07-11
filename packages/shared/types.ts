/**
 * @file Shared TypeScript types used across the Acquisition Engine monorepo.
 * Both the API (apps/api) and the dashboard (apps/dashboard) import from here.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type OutreachStatus =
  | 'pending'
  | 'queued'
  | 'sent'
  | 'opened'
  | 'replied'
  | 'booked'
  | 'lost';

export type DemoStatus = 'none' | 'generating' | 'ready' | 'deployed' | 'failed';

export type CampaignStatus = 'active' | 'paused' | 'completed';

export type BusinessTone =
  | 'professional'
  | 'playful'
  | 'bold'
  | 'warm'
  | 'luxury'
  | 'minimal';

export type TemplateType = 'restaurant' | 'clinic' | 'gym' | 'salon' | 'generic';

export type OutreachEventType =
  | 'sent'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced';

// ─── Scraping Input/Output ────────────────────────────────────────────────────

export interface ScrapeInput {
  /** Unique job ID for SSE tracking */
  jobId: string;
  /** Business niche e.g. "dentist", "restaurant", "gym" */
  niche: string;
  /** City to scrape in e.g. "Ludhiana", "Austin TX" */
  city: string;
  /** Optional specific business name to search for */
  businessName?: string;
  /** Optional campaign ID to associate leads with */
  campaignId?: string;
  /** Optional limit on how many businesses to scrape */
  limit?: number | 'unlimited';
  /** Mode for generating demo sites */
  demo_mode?: 'template' | 'ai_scratch';
}

export interface GoogleMapsBusiness {
  name: string;
  address: string;
  phone: string;
  website_url?: string;
  google_maps_url: string;
  google_rating?: number;
  google_review_count?: number;
  category?: string;
  hero_image_url?: string;
  photos?: string[];
  hours?: Record<string, string>;
}

export interface WebsiteScrapedData {
  brand_colors?: string[];
  brand_fonts?: string[];
  tagline?: string;
  about_text?: string;
  services?: string[];
  menu_or_pricing?: Record<string, string>[];
  social_links?: SocialLinks;
  meta_description?: string;
  /** Email found via mailto links or regex scan of the website / contact page */
  email?: string;
  /** Phone found via tel: links or regex scan of the website / contact page */
  phone?: string;
}

export interface RedditMention {
  subreddit: string;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  url?: string;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

export interface AIAnalysis {
  brand_dna: string;
  primary_colors: string[];
  tone: BusinessTone;
  pain_points: string[];
  opportunity_score: number;
  opportunity_reason: string;
  recommended_template: TemplateType;
  hero_headline: string;
  hero_subline: string;
  cta_text: string;
  estimated_revenue_potential: 'Low' | 'Medium' | 'High';
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

// ─── Lead (Core Entity) ───────────────────────────────────────────────────────

export interface Lead {
  id: string;
  campaign_id?: string;
  // Search context
  niche: string;
  city: string;
  // Business info
  business_name?: string;
  owner_name?: string;
  website_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  google_maps_url?: string;
  google_rating?: number;
  google_review_count?: number;
  // Scraped intelligence
  brand_colors?: string[];
  brand_fonts?: string[];
  tagline?: string;
  about_text?: string;
  services?: string[];
  menu_or_pricing?: Record<string, string>[];
  social_links?: SocialLinks;
  reddit_mentions?: RedditMention[];
  yelp_reviews_summary?: string;
  instagram_bio?: string;
  instagram_post_themes?: string;
  // AI analysis
  brand_dna?: string;
  pain_points?: string[];
  opportunity_score?: number;
  opportunity_reason?: string;
  recommended_template?: TemplateType;
  tone?: BusinessTone;
  hero_headline?: string;
  hero_subline?: string;
  cta_text?: string;
  estimated_revenue_potential?: 'Low' | 'Medium' | 'High';
  // Demo
  demo_mode?: 'template' | 'ai_scratch';
  demo_status: DemoStatus;
  demo_html?: string;
  demo_url?: string;
  demo_deployed_at?: string;
  vercel_deployment_id?: string;
  hero_image_url?: string;
  // Outreach
  outreach_status: OutreachStatus;
  email_subject?: string;
  email_body?: string;
  email_sent_at?: string;
  email_opened_at?: string;
  reply_received_at?: string;
  reply_text?: string;
  follow_up_count: number;
  last_follow_up_at?: string;
  // Meta
  created_at: string;
  updated_at: string;
}

/** Raw data merged from all scrapers before AI processing */
export interface LeadData extends Partial<Lead> {
  niche: string;
  city: string;
  business_name: string;
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  niche: string;
  city: string;
  status: CampaignStatus;
  leads_count: number;
  demos_generated: number;
  emails_sent: number;
  replies_received: number;
  created_at: string;
}

// ─── Outreach Log ─────────────────────────────────────────────────────────────

export interface OutreachLog {
  id: string;
  lead_id: string;
  event_type: OutreachEventType;
  event_data?: Record<string, unknown>;
  created_at: string;
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export interface SSEEvent {
  jobId: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

// ─── API Request/Response Types ───────────────────────────────────────────────

export interface ScrapeRequest {
  niche: string;
  city: string;
  businessName?: string;
  campaignId?: string;
  limit?: number | 'unlimited';
  demo_mode?: 'template' | 'ai_scratch';
}

export interface ScrapeResponse {
  jobId: string;
  message: string;
}

export interface GenerateDemoRequest {
  leadId: string;
}

export interface GenerateDemoResponse {
  jobId: string;
  message: string;
}

export interface DeployRequest {
  leadId: string;
}

export interface DeployResponse {
  demoUrl: string;
  deploymentId: string;
}

export interface OutreachRequest {
  leadId: string;
  sendImmediately?: boolean;
}

export interface OutreachResponse {
  emailId?: string;
  message: string;
  queued: boolean;
}

export interface DashboardStats {
  total_leads: number;
  demos_generated: number;
  emails_sent: number;
  reply_rate: number;
  avg_opportunity_score: number;
  leads_this_week: number;
}

// ─── Queue Job Types ──────────────────────────────────────────────────────────

export interface ScrapeJobData {
  jobId: string;
  niche: string;
  city: string;
  businessName?: string;
  campaignId?: string;
  limit?: number | 'unlimited';
  demo_mode?: 'template' | 'ai_scratch';
}

export interface GenerateJobData {
  jobId: string;
  leadId: string;
  demo_mode?: 'template' | 'ai_scratch';
}

export interface OutreachJobData {
  jobId: string;
  leadId: string;
  isFollowUp?: boolean;
  followUpNumber?: number;
}
