-- ============================================================
-- VISION canonical database schema
-- Apply with:
--   npm run db:apply
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_invite_on_signup();
drop function if exists public.get_user_invite_count(uuid);

drop policy if exists "Users can view own generations" on public.generations;
drop policy if exists "Users can insert own generations" on public.generations;
drop policy if exists "Users can update own generations" on public.generations;
drop policy if exists "Users can delete own generations" on public.generations;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own referrals" on public.referrals;
drop policy if exists "Anyone can view enabled models" on public.model_configs;
drop policy if exists "Users can view own invites" on public.invites;
drop policy if exists "Anyone can insert invites" on public.invites;
drop policy if exists "Users can update own invites" on public.invites;

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  picture_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  aspect_ratio text not null default '1:1' check (aspect_ratio in ('1:1', '16:9', '3:4', '9:16')),
  style_strength integer not null default 75 check (style_strength >= 0 and style_strength <= 100),
  engine text not null default 'DALL-E 3',
  image_url text,
  status text not null default 'pending' check (status in ('pending', 'generating', 'completed', 'failed')),
  picture_lifecycle text default 'pending'
    check (picture_lifecycle in ('pending', 'generating', 'active', 'expiring', 'expired')),
  picture_expires_at timestamptz,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  invite_code text not null unique,
  is_disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.model_configs (
  id text primary key,
  name text not null,
  provider text not null,
  api_endpoint text not null,
  api_key_ciphertext text,
  enabled boolean not null default true,
  max_tokens integer not null default 1000,
  temperature numeric not null default 0.7,
  default_size text not null default '1024x1024',
  protocol text not null default 'openai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key default 'default' check (id = 'default'),
  public_web_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop table if exists public.invites cascade;

alter table public.generations disable row level security;
alter table public.profiles disable row level security;
alter table public.referrals disable row level security;
alter table public.model_configs disable row level security;
alter table public.app_settings disable row level security;

create index if not exists idx_generations_user_id on public.generations(user_id);
create index if not exists idx_generations_created_at on public.generations(created_at desc);
create index if not exists idx_generations_picture_id on public.generations(picture_id);
create index if not exists idx_profiles_invite_code on public.profiles(invite_code);
create index if not exists idx_referrals_inviter_id on public.referrals(inviter_id);

create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text := '';
  idx integer := 0;
begin
  loop
    candidate := '';
    for idx in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;

    exit when not exists (
      select 1 from public.profiles where invite_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inviter_uuid uuid;
  requested_invite_code text;
begin
  insert into public.profiles (user_id, username, invite_code)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      split_part(new.email, '@', 1),
      'User'
    ),
    public.generate_invite_code()
  )
  on conflict (user_id) do nothing;

  requested_invite_code := nullif(trim(new.raw_user_meta_data->>'invite_code'), '');

  if requested_invite_code is not null then
    select user_id
      into inviter_uuid
      from public.profiles
     where invite_code = requested_invite_code
     limit 1;

    if inviter_uuid is not null then
      insert into public.referrals (inviter_id, invitee_id)
      values (inviter_uuid, new.id)
      on conflict (invitee_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_profile_on_signup();

insert into public.model_configs (
  id,
  name,
  provider,
  api_endpoint,
  enabled,
  max_tokens,
  temperature,
  default_size,
  protocol
) values
  ('gpt-image-2', 'GPT-Image-2', 'OpenAI Compatible', 'https://api.example.com/v1/images/generations', true, 1000, 0.7, '1024x1024', 'openai')
on conflict (id) do nothing;

insert into public.app_settings (id, public_web_url)
values ('default', null)
on conflict (id) do nothing;
