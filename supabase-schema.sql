-- Run this in your Supabase SQL editor (supabase.com → your project → SQL Editor)

create table if not exists work_schedule (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  shift_start time,
  shift_end time,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  service_address text not null,
  load_size text not null,
  preferred_date date not null,
  time_slot text,
  description text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  gross_revenue numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

-- Allow public read on schedule (so available-dates API works without service key)
alter table work_schedule enable row level security;
create policy "Public can read schedule" on work_schedule for select using (true);
create policy "Service role can write schedule" on work_schedule for all using (auth.role() = 'service_role');

-- Bookings: public insert (for customer form), admin read via service key
alter table bookings enable row level security;
create policy "Public can insert bookings" on bookings for insert with check (true);
create policy "Service role full access" on bookings for all using (auth.role() = 'service_role');
