-- Maintainr demo-only schema
-- Apply ONLY to the separate `maintainr-interactive-demo` Supabase project.
-- Never apply this file to the production Maintainr workspace database.

create extension if not exists pgcrypto;

create type demo_role as enum ('PROPERTY_MANAGER', 'TENANT', 'TECHNICIAN', 'FLAT_OWNER');
create type demo_ticket_status as enum ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED');

create table demo_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint demo_session_expiry_window check (expires_at > created_at and expires_at <= created_at + interval '48 hours')
);

create index demo_sessions_cleanup_idx on demo_sessions (expires_at) where revoked_at is null;
create index demo_sessions_rate_limit_idx on demo_sessions (ip_hash, created_at desc);

create table demo_workspaces (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null unique references demo_sessions(id) on delete cascade,
  name text not null default 'Northline Properties — Sample',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint demo_workspace_expiry check (expires_at <= created_at + interval '48 hours')
);

create table demo_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references demo_workspaces(id) on delete cascade,
  role demo_role not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, role)
);

create table demo_tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references demo_workspaces(id) on delete cascade,
  title text not null,
  unit_label text not null,
  category text not null,
  priority text not null check (priority in ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY')),
  status demo_ticket_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table demo_ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references demo_tickets(id) on delete cascade,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- The demo application uses a server-side PostgreSQL connection only.
-- No browser-facing Data API policies are created; RLS remains enabled as defense in depth.
alter table demo_sessions enable row level security;
alter table demo_workspaces enable row level security;
alter table demo_users enable row level security;
alter table demo_tickets enable row level security;
alter table demo_ticket_events enable row level security;

-- Seed policy: only fictional sample records may be created by the demo bootstrap.
-- Never copy production customer, user, property, ticket, media, provider, or notification data.
