-- Migration 017: User profiles and property alerts
-- Adds user account infrastructure for registration + saved search alerts

-- ============================================================
-- 1. PROFILES TABLE (mirrors auth.users for app data)
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  preferred_locale text default 'es' check (preferred_locale in ('es', 'en')),
  alert_frequency text default 'daily' check (alert_frequency in ('daily', 'weekly', 'instant')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile when a new user signs up via Supabase Auth
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, preferred_locale)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'preferred_locale', 'es')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- 2. PROPERTY ALERTS TABLE (saved searches)
-- ============================================================
create table if not exists property_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  criteria jsonb not null,
  is_active boolean default true,
  last_notified_at timestamp with time zone,
  match_count integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_alerts_user_id on property_alerts(user_id);
create index idx_alerts_active on property_alerts(is_active) where is_active = true;

alter table property_alerts enable row level security;

create policy "Users can read own alerts"
  on property_alerts for select
  using (auth.uid() = user_id);

create policy "Users can insert own alerts"
  on property_alerts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own alerts"
  on property_alerts for update
  using (auth.uid() = user_id);

create policy "Users can delete own alerts"
  on property_alerts for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 3. ALERT NOTIFICATIONS TABLE (tracks sent emails)
-- ============================================================
create table if not exists alert_notifications (
  id uuid default gen_random_uuid() primary key,
  alert_id uuid references property_alerts(id) on delete cascade not null,
  listing_ids uuid[] not null,
  sent_at timestamp with time zone default now()
);

create index idx_alert_notifications_alert_id on alert_notifications(alert_id);

alter table alert_notifications enable row level security;

create policy "Users can read own notifications"
  on alert_notifications for select
  using (
    alert_id in (
      select id from property_alerts where user_id = auth.uid()
    )
  );

-- Service role insert policy for the alert sender script
create policy "Service role can insert notifications"
  on alert_notifications for insert
  with check (true);
