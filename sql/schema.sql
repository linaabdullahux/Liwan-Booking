-- =========================================================
-- ليوان أرُب — Meeting Room Booking — Database schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query)
-- =========================================================

-- Needed for the exclusion constraint that blocks overlapping bookings
-- at the database level (this is what makes double-booking impossible,
-- even if two people click "Confirm" at the exact same millisecond).
create extension if not exists btree_gist;
create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------
-- rooms
-- ---------------------------------------------------------
create table if not exists rooms (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,           -- e.g. 'meeting', 'brainstorm'
  name_ar      text not null,
  name_en      text not null,
  color_hex    text not null default '#554835',
  open_time    time not null default '08:00',
  close_time   time not null default '22:00',
  work_days    int[] not null default '{0,1,2,3,4,5,6}', -- 0=Sunday ... 6=Saturday
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into rooms (slug, name_ar, name_en, color_hex)
values
  ('meeting',    'قاعة الاجتماعات',      'Meeting Room',        '#554835'),
  ('brainstorm', 'قاعة العصف الذهني',    'Brainstorming Room',  '#3B7984')
on conflict (slug) do nothing;

-- ---------------------------------------------------------
-- bookings
-- A "blocked" row is how admins manually close a time slot —
-- it shares the same exclusion constraint as real bookings,
-- so a closed slot can never be double-booked either.
-- ---------------------------------------------------------
create table if not exists bookings (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references rooms(id) on delete restrict,
  customer_name  text,
  customer_email text,
  notes          text,
  start_time     timestamptz not null,
  end_time       timestamptz not null,
  status         text not null default 'confirmed'
                   check (status in ('confirmed','cancelled','blocked')),
  cancel_token   uuid not null default gen_random_uuid(),
  reminder_sent  boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint end_after_start check (end_time > start_time)
);

-- The core guarantee: no two ACTIVE (confirmed/blocked) rows for the
-- same room may have overlapping [start_time, end_time) ranges.
alter table bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    room_id with =,
    tstzrange(start_time, end_time) with &&
  )
  where (status in ('confirmed','blocked'));

create index if not exists idx_bookings_room_time on bookings (room_id, start_time);
create index if not exists idx_bookings_status on bookings (status);

-- ---------------------------------------------------------
-- guests — people invited to a booking ("دعوة ضيف")
-- ---------------------------------------------------------
create table if not exists guests (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  email       text not null,
  notified    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- admin_users — allow-list of who may use /admin
-- Create the actual login credentials in Supabase Auth
-- (Authentication → Users → Add user), then add their
-- auth user id here so they can see/manage bookings.
-- ---------------------------------------------------------
create table if not exists admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Row Level Security
-- =========================================================
alter table rooms enable row level security;
alter table bookings enable row level security;
alter table guests enable row level security;
alter table admin_users enable row level security;

-- Anyone can see active rooms (needed to render the booking page)
create policy rooms_public_read on rooms
  for select using (active = true);

-- Admins can manage rooms
create policy rooms_admin_all on rooms
  for all using (exists (select 1 from admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from admin_users a where a.user_id = auth.uid()));

-- No direct public access to bookings table — all public reads/writes
-- go through the SECURITY DEFINER functions below, so a stranger can
-- never browse other customers' names/emails.
create policy bookings_admin_all on bookings
  for all using (exists (select 1 from admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from admin_users a where a.user_id = auth.uid()));

create policy guests_admin_all on guests
  for all using (exists (select 1 from admin_users a where a.user_id = auth.uid()));

create policy admin_users_self_read on admin_users
  for select using (auth.uid() = user_id);

-- =========================================================
-- RPC functions (SECURITY DEFINER) — the only way the public
-- website is allowed to touch bookings. Each one is deliberately
-- narrow about what it returns.
-- =========================================================

-- Busy ranges for a room on a given day (no personal data returned —
-- just the time ranges, so the booking page can grey them out).
create or replace function get_busy_ranges(p_room_id uuid, p_day date)
returns table(start_time timestamptz, end_time timestamptz)
language sql security definer set search_path = public as $$
  select b.start_time, b.end_time
  from bookings b
  where b.room_id = p_room_id
    and b.status in ('confirmed','blocked')
    and b.start_time < (p_day + 1)::timestamptz
    and b.end_time   > p_day::timestamptz;
$$;

-- Create a booking. Returns the new booking id + cancel token.
-- Re-validates the business rules server-side (never trust the client),
-- and relies on the exclusion constraint above for the final,
-- race-proof double-booking check.
create or replace function create_booking(
  p_room_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_name text,
  p_email text,
  p_notes text,
  p_guest_emails text[]
) returns table(id uuid, cancel_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
  v_id uuid;
  v_token uuid;
  v_minutes int;
begin
  select * into v_room from rooms where rooms.id = p_room_id and active = true;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if p_name is null or trim(p_name) = '' or p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_INPUT';
  end if;

  v_minutes := extract(epoch from (p_end - p_start)) / 60;
  if v_minutes < 10 or v_minutes > 360 then
    raise exception 'INVALID_DURATION';
  end if;

  if p_start < now() + interval '10 minutes' then
    raise exception 'TOO_SOON';
  end if;

  if p_start > now() + interval '7 days' then
    raise exception 'TOO_FAR';
  end if;

  if p_start::time < v_room.open_time or p_end::time > v_room.close_time then
    raise exception 'OUTSIDE_HOURS';
  end if;

  -- This insert is the moment the exclusion constraint gets the final
  -- say — if another booking for the same room/time landed a moment
  -- earlier, Postgres raises exclusion_violation (23P01) here.
  insert into bookings (room_id, customer_name, customer_email, notes, start_time, end_time, status)
  values (p_room_id, trim(p_name), lower(trim(p_email)), p_notes, p_start, p_end, 'confirmed')
  returning bookings.id, bookings.cancel_token into v_id, v_token;

  if p_guest_emails is not null then
    insert into guests (booking_id, email)
    select v_id, lower(trim(g))
    from unnest(p_guest_emails) as g
    where g is not null and trim(g) <> '';
  end if;

  return query select v_id, v_token;
end;
$$;

-- Look up a booking by id + the private token from the confirmation
-- link/email — this is how a customer manages their own booking
-- without needing an account.
create or replace function get_booking_by_token(p_id uuid, p_token uuid)
returns table (
  id uuid, room_id uuid, room_name_ar text, room_name_en text,
  customer_name text, customer_email text, notes text,
  start_time timestamptz, end_time timestamptz, status text
)
language sql security definer set search_path = public as $$
  select b.id, b.room_id, r.name_ar, r.name_en, b.customer_name, b.customer_email,
         b.notes, b.start_time, b.end_time, b.status
  from bookings b join rooms r on r.id = b.room_id
  where b.id = p_id and b.cancel_token = p_token;
$$;

create or replace function cancel_booking(p_id uuid, p_token uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update bookings
    set status = 'cancelled'
    where id = p_id and cancel_token = p_token and status = 'confirmed' and start_time > now();
  return found;
end;
$$;

-- Reschedule (edit) a booking to a new time — same guarantees as
-- create_booking, still race-proof via the exclusion constraint.
create or replace function reschedule_booking(
  p_id uuid, p_token uuid, p_start timestamptz, p_end timestamptz
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_minutes int;
begin
  v_minutes := extract(epoch from (p_end - p_start)) / 60;
  if v_minutes < 10 or v_minutes > 360 then
    raise exception 'INVALID_DURATION';
  end if;
  if p_start < now() + interval '10 minutes' then
    raise exception 'TOO_SOON';
  end if;

  update bookings
    set start_time = p_start, end_time = p_end
    where id = p_id and cancel_token = p_token and status = 'confirmed';
  return found;
end;
$$;

grant execute on function get_busy_ranges to anon, authenticated;
grant execute on function create_booking to anon, authenticated;
grant execute on function get_booking_by_token to anon, authenticated;
grant execute on function cancel_booking to anon, authenticated;
grant execute on function reschedule_booking to anon, authenticated;

-- =========================================================
-- Easy CSV backup: a flat view the admin dashboard's
-- "Export Bookings" button reads from.
-- =========================================================
create or replace view bookings_export as
  select b.id, r.name_en as room, b.customer_name, b.customer_email,
         b.start_time, b.end_time, b.status, b.notes, b.created_at
  from bookings b join rooms r on r.id = b.room_id
  order by b.start_time desc;
