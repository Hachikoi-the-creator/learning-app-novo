-- ──────────────────────────────────────────────────────────────
-- novostudy — initial schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query)
-- or via the Supabase CLI (`supabase db push`).
-- ──────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── Encrypted API credentials ─────────────────────────────────
-- Stores the user's provider API key, encrypted with AES-256-GCM.
-- The encryption key (CREDENTIALS_MASTER_KEY) lives in the server env,
-- NOT in this table. Only non-secret parameters are stored here:
--   ciphertext : the encrypted key
--   salt       : per-record salt used to derive the record key (not secret)
--   iv         : AES-GCM nonce (not secret)
--   auth_tag   : GCM authentication tag (integrity, not secret)
-- Reading this row alone does NOT reveal the key without the master key.
create table if not exists public.api_credentials (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null check (provider in ('gemini', 'openai')),
  ciphertext  text not null,
  salt        text not null,
  iv          text not null,
  auth_tag    text not null,
  key_hint    text,                      -- last 4 chars for display, e.g. "…aB3d"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One stored key per provider (single-user app). Drop this if you add auth.
  unique (provider)
);

-- ── Study cards (spaced-repetition) ───────────────────────────
create table if not exists public.study_cards (
  id                 uuid primary key default gen_random_uuid(),
  topic_category     text not null,
  title              text not null,
  content_html       text not null default '',
  interaction_count  integer not null default 0,
  last_interacted_at timestamptz not null default now(),
  next_review_at     timestamptz not null default now(),
  status             text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  created_at         timestamptz not null default now()
);

create index if not exists study_cards_due_idx
  on public.study_cards (next_review_at)
  where status = 'ACTIVE';

-- keep updated_at fresh on api_credentials
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_api_credentials_updated_at on public.api_credentials;
create trigger trg_api_credentials_updated_at
  before update on public.api_credentials
  for each row execute function public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────
-- RLS is enabled with NO public policies, so the anon/public key cannot
-- read these tables. The app reaches them exclusively through server API
-- routes using the service-role key, which bypasses RLS. If you later add
-- Supabase Auth + multi-user support, add a `user_id uuid` column and
-- per-user policies here.
alter table public.api_credentials enable row level security;
alter table public.study_cards     enable row level security;
