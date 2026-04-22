-- ============================================================
-- VISION (影境) - Supabase schema snapshot
-- Primary deployment path:
--   1. app/supabase/migrations/*.sql
--   2. app/supabase/config.toml
--   3. npm run deploy:supabase:init
--
-- This file is kept as a readable snapshot / manual fallback and
-- mirrors the initial migration.
-- ============================================================

create table public.generations (
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

alter table public.generations enable row level security;

create policy "Users can view own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "Users can insert own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own generations"
  on public.generations for update
  using (auth.uid() = user_id);

create policy "Users can delete own generations"
  on public.generations for delete
  using (auth.uid() = user_id);

create index idx_generations_user_id on public.generations(user_id);
create index idx_generations_created_at on public.generations(created_at desc);
create index idx_generations_picture_id on public.generations(picture_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid references auth.users(id) on delete set null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

create policy "Users can view own invites"
  on public.invites for select
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

create policy "Anyone can insert invites"
  on public.invites for insert
  with check (true);

create policy "Users can update own invites"
  on public.invites for update
  using (auth.uid() = inviter_id);

create index idx_invites_inviter_id on public.invites(inviter_id);
create index idx_invites_invite_code on public.invites(invite_code);

create or replace function public.get_user_invite_count(user_uuid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return (
    select count(*)::integer
    from public.invites
    where inviter_id = user_uuid and invitee_id is not null
  );
end;
$$;

create or replace function public.handle_invite_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record record;
begin
  if new.raw_user_meta_data->>'invite_code' is not null then
    select *
    into invite_record
    from public.invites
    where invite_code = new.raw_user_meta_data->>'invite_code'
      and invitee_id is null;

    if found then
      update public.invites
      set invitee_id = new.id
      where id = invite_record.id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_invite_on_signup();

-- Storage bucket and function config are now managed by app/supabase/config.toml.
