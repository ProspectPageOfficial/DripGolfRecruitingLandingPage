-- Drip Golf Pages — database schema.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- Access model:
--   * Tables have Row Level Security ON and NO policies. The public
--     (publishable) key can neither read nor write them. Every read and
--     write goes through a Netlify Function using the service role key,
--     which checks who is asking first (netlify/functions/_lib/tenant.mjs).
--   * Storage: two public buckets. Anyone can VIEW a file (it is on a public
--     recruiting page); only a signed-in owner can UPLOAD, and only into the
--     folder named after a golfer they own.

-- ---------------------------------------------------------------- golfers
create table if not exists public.golfers (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  -- The free address: pages.<domain>/<slug>
  slug       text not null unique
             check (slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'),
  name       text not null,
  -- Their own domain, lowercase, no "www." (e.g. 'avareed.com'). Null until
  -- one is connected.
  domain     text unique,
  created_at timestamptz not null default now()
);
create index if not exists golfers_owner_idx on public.golfers (owner_id);

-- One JSON document per golfer per key. Keys mirror the original site's
-- Netlify Blobs: personal-overrides, tournaments, swing-videos,
-- featured-swing, theme, upcoming-tournaments, plus 'portfolio' (the
-- imported results that used to be pasted into the page).
create table if not exists public.golfer_docs (
  golfer_id  uuid not null references public.golfers(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (golfer_id, key)
);

alter table public.golfers     enable row level security;
alter table public.golfer_docs enable row level security;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('golfer-videos', 'golfer-videos', true),
       ('golfer-photos', 'golfer-photos', true)
on conflict (id) do nothing;

-- The upload policy needs to ask "does this user own that golfer?", but the
-- golfers table is invisible to signed-in users (RLS, no policies). A
-- SECURITY DEFINER function answers exactly that one yes/no question without
-- exposing the table.
create or replace function public.owns_golfer(gid text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.golfers where id::text = gid and owner_id = auth.uid()
  );
$$;
revoke all on function public.owns_golfer(text) from public;
grant execute on function public.owns_golfer(text) to authenticated;

drop policy if exists "golfer owners upload into their folder" on storage.objects;
create policy "golfer owners upload into their folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('golfer-videos', 'golfer-photos')
    and public.owns_golfer((storage.foldername(name))[1])
  );
