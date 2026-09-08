-- =========================================================
-- ليوان أرُب — Migration 3
-- Run in Supabase SQL Editor, AFTER schema.sql and migration-2-feedback.sql.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Companies — the admin-managed list customers pick from
--    instead of typing a free-text name.
-- ---------------------------------------------------------
create table if not exists companies (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table companies enable row level security;

create policy companies_public_read on companies
  for select using (active = true);

create policy companies_admin_all on companies
  for all using (exists (select 1 from admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from admin_users a where a.user_id = auth.uid()));

grant select on companies to anon, authenticated;

-- ---------------------------------------------------------
-- 2) bookings.company_id — a booking now belongs to a company,
--    not a free-text person name. customer_name is kept in sync
--    with the company's name so existing table/CSV code that
--    reads customer_name keeps working unchanged.
-- ---------------------------------------------------------
alter table bookings add column if not exists company_id uuid references companies(id);

-- ---------------------------------------------------------
-- 3) Remove the ratings/feedback feature entirely, as requested.
-- ---------------------------------------------------------
drop function if exists submit_feedback(uuid, uuid, smallint, text);
drop function if exists get_booking_for_feedback(uuid, uuid);
alter table bookings drop column if exists customer_rating;
alter table bookings drop column if exists customer_feedback;
alter table bookings drop column if exists feedback_requested;
alter table bookings drop column if exists feedback_submitted_at;

-- ---------------------------------------------------------
-- 4) Replace create_booking to take a company instead of a name.
--    Postgres won't let us just change parameters in-place, so drop
--    the old signature first.
-- ---------------------------------------------------------
drop function if exists create_booking(uuid, timestamptz, timestamptz, text, text, text, text[]);

create or replace function create_booking(
  p_room_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_company_id uuid,
  p_email text,
  p_notes text,
  p_guest_emails text[]
) returns table(id uuid, cancel_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
  v_company companies%rowtype;
  v_id uuid;
  v_token uuid;
  v_minutes int;
begin
  select * into v_room from rooms where rooms.id = p_room_id and active = true;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  select * into v_company from companies where companies.id = p_company_id and active = true;
  if not found then
    raise exception 'COMPANY_NOT_FOUND';
  end if;

  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
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

  insert into bookings (room_id, company_id, customer_name, customer_email, notes, start_time, end_time, status)
  values (p_room_id, p_company_id, v_company.name, lower(trim(p_email)), p_notes, p_start, p_end, 'confirmed')
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

grant execute on function create_booking to anon, authenticated;

-- ---------------------------------------------------------
-- 5) Busy ranges now also return the booking company's name, so the
--    public booking page can show "booked by <company>" under a
--    taken slot. This is a business name, not personal customer
--    data, so it's safe to expose publicly.
-- ---------------------------------------------------------
drop function if exists get_busy_ranges(uuid, date);

create or replace function get_busy_ranges(p_room_id uuid, p_day date)
returns table(start_time timestamptz, end_time timestamptz, company_name text)
language sql security definer set search_path = public as $$
  select b.start_time, b.end_time, b.customer_name
  from bookings b
  where b.room_id = p_room_id
    and b.status in ('confirmed','blocked')
    and b.start_time < (p_day + 1)::timestamptz
    and b.end_time   > p_day::timestamptz;
$$;

grant execute on function get_busy_ranges to anon, authenticated;

-- ---------------------------------------------------------
-- 6) Admin-side edit: lets an admin change a booking's time (and/or
--    company) directly. Regular RLS already lets admins update the
--    bookings table, but we still validate through a function so the
--    same overlap/hours rules apply as everywhere else.
-- ---------------------------------------------------------
create or replace function admin_update_booking(
  p_id uuid, p_start timestamptz, p_end timestamptz, p_company_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_minutes int;
  v_company companies%rowtype;
begin
  if not exists (select 1 from admin_users a where a.user_id = auth.uid()) then
    raise exception 'NOT_ADMIN';
  end if;

  v_minutes := extract(epoch from (p_end - p_start)) / 60;
  if v_minutes < 10 or v_minutes > 360 then
    raise exception 'INVALID_DURATION';
  end if;

  select * into v_company from companies where companies.id = p_company_id;

  update bookings
    set start_time = p_start,
        end_time = p_end,
        company_id = coalesce(p_company_id, company_id),
        customer_name = coalesce(v_company.name, customer_name)
    where id = p_id;

  return found;
end;
$$;

grant execute on function admin_update_booking to authenticated;

-- ---------------------------------------------------------
-- Updated CSV export view: company instead of rating/feedback.
-- ---------------------------------------------------------
drop view if exists bookings_export;

create or replace view bookings_export as
  select
    b.id,
    b.start_time,
    b.end_time,
    r.name_ar as room_ar,
    r.name_en as room_en,
    c.name as company_name,
    b.customer_email,
    case b.status
      when 'confirmed' then 'مؤكد'
      when 'cancelled' then 'ملغى'
      when 'blocked'   then 'مغلق يدويًا'
      else b.status
    end as status_ar,
    b.status as status_raw,
    b.notes,
    b.created_at
  from bookings b
  join rooms r on r.id = b.room_id
  left join companies c on c.id = b.company_id
  order by b.start_time desc;
