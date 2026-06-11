-- ============================================================
-- FreelanceCRM — Supabase Schema
-- Run this entire file in your Supabase SQL Editor:
-- https://supabase.com/dashboard → your project → SQL Editor
-- ============================================================

-- Profiles (extends Supabase auth.users)
create table public.profiles (
    id          uuid references auth.users(id) on delete cascade primary key,
    first_name  text not null default '',
    last_name   text not null default '',
    business    text not null default '',
    phone       text not null default '',
    address     text not null default '',
    created_at  timestamptz not null default now()
);

-- Clients
create table public.clients (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references auth.users(id) on delete cascade not null,
    name        text not null,
    email       text not null default '',
    phone       text not null default '',
    company     text not null default '',
    address     text not null default '',
    created_at  timestamptz not null default now()
);

-- Projects
create table public.projects (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid references auth.users(id) on delete cascade not null,
    client_id    uuid references public.clients(id) on delete set null,
    name         text not null,
    hourly_rate  numeric(10,2) not null default 0,
    status       text not null default 'active' check (status in ('active','completed','on-hold')),
    created_at   timestamptz not null default now()
);

-- Time entries
create table public.time_entries (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid references auth.users(id) on delete cascade not null,
    project_id   uuid references public.projects(id) on delete cascade not null,
    description  text not null default '',
    duration     numeric(8,2) not null default 0,
    date         date not null default current_date,
    created_at   timestamptz not null default now()
);

-- Invoices
create table public.invoices (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references auth.users(id) on delete cascade not null,
    client_id   uuid references public.clients(id) on delete set null,
    number      text not null,
    date        date not null,
    due_date    date not null,
    notes       text not null default '',
    items       jsonb not null default '[]',
    subtotal    numeric(12,2) not null default 0,
    tax         numeric(12,2) not null default 0,
    total       numeric(12,2) not null default 0,
    status      text not null default 'unpaid' check (status in ('unpaid','paid')),
    paid_date   timestamptz,
    created_at  timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────
-- Each user can only see and modify their own data.

alter table public.profiles     enable row level security;
alter table public.clients      enable row level security;
alter table public.projects     enable row level security;
alter table public.time_entries enable row level security;
alter table public.invoices     enable row level security;

-- profiles
create policy "users can manage their own profile"
    on public.profiles for all
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- clients
create policy "users can manage their own clients"
    on public.clients for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- projects
create policy "users can manage their own projects"
    on public.projects for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- time_entries
create policy "users can manage their own time entries"
    on public.time_entries for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- invoices
create policy "users can manage their own invoices"
    on public.invoices for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ── Auto-create profile on signup ──────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
    insert into public.profiles (id, first_name, last_name)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'first_name', ''),
        coalesce(new.raw_user_meta_data->>'last_name',  '')
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
