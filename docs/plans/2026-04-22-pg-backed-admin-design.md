# Dual-Service Refactor Design

**Date:** 2026-04-22

**Goal:** Rebuild the project into two deployable services: `web` for the user-facing product and `admin` for the admin UI plus privileged API. All business data stays in PostgreSQL. User passwords remain in Supabase Auth. The admin service owns database credentials and model-secret encryption.

## Architecture

- `web/`
  - public site
  - user registration/login via Supabase Auth
  - user reads own data through Supabase RLS
  - user submits generation requests to `admin` API
- `admin/`
  - separate admin UI
  - separate admin API
  - owns `DATABASE_URL`
  - owns `SUPABASE_SERVICE_ROLE_KEY`
  - owns `CONFIG_CRYPT_KEY`
  - performs privileged reads/writes and external model calls
- `supabase/`
  - shared migrations
  - bucket config
  - schema snapshot

## Data Model

- keep `generations`
- add `profiles`
  - `user_id uuid primary key references auth.users(id)`
  - `username text not null`
  - `invite_code text not null unique`
  - `is_disabled boolean not null default false`
  - `created_at timestamptz not null default now()`
- add `admin_roles`
  - `user_id uuid primary key references auth.users(id)`
  - `created_at timestamptz not null default now()`
- add `referrals`
  - `id uuid primary key default gen_random_uuid()`
  - `inviter_id uuid not null references auth.users(id)`
  - `invitee_id uuid not null unique references auth.users(id)`
  - `created_at timestamptz not null default now()`
- add `model_configs`
  - `id text primary key`
  - `name text not null`
  - `provider text not null`
  - `api_endpoint text not null`
  - `api_key_ciphertext text`
  - `enabled boolean not null default true`
  - `max_tokens integer not null default 1000`
  - `temperature numeric not null default 0.7`
  - `default_size text not null default '1024x1024'`
  - `protocol text not null default 'openai'`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

## Auth

- normal user passwords only live in Supabase Auth
- `web` does not know `DATABASE_URL`
- admin login is still email/password, but the UI lives in `admin`
- `admin` API verifies Supabase access tokens server-side
- admin access requires a matching row in `admin_roles`

## Secret Handling

- new env var: `CONFIG_CRYPT_KEY`
- only `admin` service can use it
- model provider keys are encrypted before writing to `model_configs`
- browser never receives decrypted provider keys
- browser never receives database credentials

## Runtime Flow

- signup
  - `web` calls Supabase Auth
  - PostgreSQL trigger creates `profiles`
  - optional invite metadata creates `referrals`
- admin page load
  - `admin` frontend signs in through Supabase Auth
  - `admin` frontend calls same-origin `admin` API with bearer token
  - `admin` API verifies token and role
- image generation
  - `web` sends `prompt`, `aspectRatio`, `styleStrength`, `modelId`
  - `admin` API loads and decrypts model config
  - `admin` API calls external model endpoint
  - `admin` API uploads image to Supabase Storage
  - `admin` API writes `generations`
  - `web` refreshes user history through Supabase RLS

## Deployment

- `web` service
  - env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_API_URL`
- `admin` service
  - env: `PORT`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CONFIG_CRYPT_KEY`, `WEB_ORIGIN`
- `supabase` migration/init runs from root against shared `supabase/`

## Tradeoffs

- this is a hard refactor, not a compatibility layer
- old single-app `/admin` path is removed from the `web` product path
- old browser-local business fallbacks are intentionally deleted
