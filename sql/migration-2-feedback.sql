-- =========================================================
-- ليوان أرُب — Migration 2: post-meeting feedback + richer export
-- Run this once in the Supabase SQL editor, AFTER schema.sql.
-- Safe to run even if some parts already exist (uses IF NOT EXISTS
-- / OR REPLACE throughout).
-- =========================================================

-- ---------------------------------------------------------
-- New columns on bookings: customer rating (1-5 stars) and
-- optional feedback text, collected after the meeting ends.
-- ---------------------------------------------------------
alter table bookings add column if not exists customer_rating smallint
  check (customer_rating between 1 and 5);
alter table bookings add column if not exists customer_feedback text;
alter table bookings add column if not exists feedback_requested boolean not null default false;
alter table bookings add column if not exists feedback_submitted_at timestamptz;

-- ---------------------------------------------------------
-- Public RPC: submit feedback using the same private token that
-- already guards manage/cancel — no separate login needed, and a
-- stranger can't rate someone else's booking without the token.
-- ---------------------------------------------------------
create or replace function submit_feedback(
  p_id uuid, p_token uuid, p_rating smallint, p_feedback text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING';
  end if;

  update bookings
    set customer_rating = p_rating,
        customer_feedback = p_feedback,
        feedback_submitted_at = now()
    where id = p_id and cancel_token = p_token and status = 'confirmed';
  return found;
end;
$$;

grant execute on function submit_feedback to anon, authenticated;

-- Same lookup pattern as get_booking_by_token, used by the feedback
-- page to show the room/date before asking for a rating.
create or replace function get_booking_for_feedback(p_id uuid, p_token uuid)
returns table (
  id uuid, room_name_ar text, room_name_en text,
  start_time timestamptz, end_time timestamptz,
  customer_rating smallint, customer_feedback text
)
language sql security definer set search_path = public as $$
  select b.id, r.name_ar, r.name_en, b.start_time, b.end_time,
         b.customer_rating, b.customer_feedback
  from bookings b join rooms r on r.id = b.room_id
  where b.id = p_id and b.cancel_token = p_token and b.status = 'confirmed';
$$;

grant execute on function get_booking_for_feedback to anon, authenticated;

-- =========================================================
-- Richer CSV export: adds room, a human-readable status label,
-- rating and feedback — matches what the admin dashboard's
-- "Export CSV" button now produces.
-- =========================================================
create or replace view bookings_export as
  select
    b.id,
    b.start_time,
    b.end_time,
    r.name_ar as room_ar,
    r.name_en as room_en,
    b.customer_name,
    b.customer_email,
    case b.status
      when 'confirmed' then 'مؤكد'
      when 'cancelled' then 'ملغى'
      when 'blocked'   then 'مغلق يدويًا'
      else b.status
    end as status_ar,
    b.status as status_raw,
    b.notes,
    b.customer_rating,
    b.customer_feedback,
    b.created_at
  from bookings b join rooms r on r.id = b.room_id
  order by b.start_time desc;
