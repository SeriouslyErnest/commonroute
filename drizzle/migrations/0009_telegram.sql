-- Telegram integration: account links, admin destinations, single-use link
-- tokens (hashed), webhook idempotency inbox, and delivery log.
-- Secrets (bot token, webhook secret) are NEVER stored here -- they live only
-- in protected server environment variables.

create table public.telegram_user_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tg_user_id bigint not null,
  tg_chat_id bigint not null,
  status text not null default 'active' check (status in ('active','needs_attention','revoked')),
  prefs jsonb not null default '{"vote_reminders":true,"itinerary_changes":true,"organiser_updates":true,"travel_day":false}'::jsonb,
  failure_reason text,
  linked_at timestamptz not null default now(),
  last_delivery_at timestamptz
);
grant select, update on public.telegram_user_links to authenticated;
grant all on public.telegram_user_links to service_role;
alter table public.telegram_user_links enable row level security;
create policy "Users read own telegram link" on public.telegram_user_links for select to authenticated using (auth.uid() = user_id);
create policy "Users update own telegram prefs" on public.telegram_user_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.telegram_admin_destinations (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  tg_user_id bigint not null,
  tg_chat_id bigint not null,
  status text not null default 'active' check (status in ('active','needs_attention','revoked')),
  event_prefs jsonb not null default '{"operations":true,"billing":true,"accounts":true}'::jsonb,
  created_at timestamptz not null default now(),
  unique (admin_user_id)
);
grant select on public.telegram_admin_destinations to authenticated;
grant all on public.telegram_admin_destinations to service_role;
alter table public.telegram_admin_destinations enable row level security;
create policy "Admins read own destination" on public.telegram_admin_destinations for select to authenticated using (auth.uid() = admin_user_id);

create table public.telegram_link_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null default 'user' check (scope in ('user','admin_destination')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
grant all on public.telegram_link_tokens to service_role;
alter table public.telegram_link_tokens enable row level security;

create table public.telegram_updates (
  update_id bigint primary key,
  processed_at timestamptz not null default now()
);
grant all on public.telegram_updates to service_role;
alter table public.telegram_updates enable row level security;

create table public.telegram_deliveries (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  chat_id bigint not null,
  kind text not null,
  status text not null default 'sent' check (status in ('sent','failed','blocked')),
  attempts integer not null default 1,
  created_at timestamptz not null default now()
);
grant all on public.telegram_deliveries to service_role;
alter table public.telegram_deliveries enable row level security;
