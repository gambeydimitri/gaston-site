-- Gaston : schéma de la base (Supabase / Postgres).
-- Chaque ramoneur ne voit et ne modifie que ses propres données (RLS).

create extension if not exists pgcrypto;

-- Profil de l'entreprise, créé automatiquement à l'inscription
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  entreprise jsonb not null default '{}'::jsonb,
  logo text,
  signature text,
  plan text not null default 'essai' check (plan in ('essai','essentiel','pro','equipe')),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom text not null,
  adresse text, cp text, ville text,
  email text, telephone text, notes text,
  created_at timestamptz not null default now()
);
create index if not exists clients_owner_idx on public.clients(owner);

create table if not exists public.certificats (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  numero text not null,
  date_intervention date not null,
  prochain_ramonage date,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (owner, numero)
);
create index if not exists certificats_owner_idx on public.certificats(owner, date_intervention desc);
create index if not exists certificats_client_idx on public.certificats(client_id);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.certificats enable row level security;

drop policy if exists "profil: lecture" on public.profiles;
drop policy if exists "profil: modification" on public.profiles;
create policy "profil: lecture" on public.profiles for select using (id = auth.uid());
create policy "profil: modification" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "clients: tout" on public.clients;
create policy "clients: tout" on public.clients for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "certificats: tout" on public.certificats;
create policy "certificats: tout" on public.certificats for all using (owner = auth.uid()) with check (owner = auth.uid());

-- Le ramoneur ne peut pas modifier lui-même sa formule ni sa date de fin d'essai
revoke update on public.profiles from authenticated;
grant update (entreprise, logo, signature) on public.profiles to authenticated;

-- Création du profil à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
