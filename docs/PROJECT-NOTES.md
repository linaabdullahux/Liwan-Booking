# Project Notes — Liwan Arob Room Booking System موقع حجوزات قاعات اجتماعات ليوان أرُب

هذا الملف تمت كتابته بواسطة (المطورة لينا عبدالله) لإفادة اي مطور جديد — منتور جديد، — مرجع لكل من ايش سويت بالضبط، ليش سويتو كذا، وفين يدور لو احتاج يعدل حاجه.

---

## 1) The idea

An internal meeting-room booking site for Liwan Arob, built as a completely free alternative to Cal.com (which the company was paying about $500/year for). A customer opens the site, picks a room, date and time, fills in their details, and confirms the booking — they get a confirmation email plus a reminder before the meeting. There's also an internal dashboard (`/admin`) where staff can see and manage every booking.

Everything is plain HTML / CSS / JavaScript (no React/Vue, no build step), so it stays simple and anyone can edit it directly without extra tooling.

---

## 2) Tech stack

| Part | Service | Why this one |
|---|---|---|
| Frontend (site + dashboard) | Plain HTML/CSS/JS | No build step, easy to edit directly |
| Hosting | Cloudflare Pages (linked to GitHub) | Free, auto-deploys on every push |
| Database + backend | Supabase (Free tier) | Real Postgres + Auth + permissions (RLS) + Edge Functions, free at our scale |
| Sending emails | Brevo (free API) | 300 emails/day, free forever, no domain purchase needed |

All the services above are **completely free** as long as usage stays within reasonable limits (see section 9).

---

## 3) Database

### Core tables

- **rooms** — the meeting rooms (Arabic/English name, color, `open_time`/`close_time`)
- **bookings** — the bookings themselves (room, company, start/end time, status: `confirmed`/`cancelled`/`blocked`, plus a secret `cancel_token` used in the "edit/cancel booking" link)
- **guests** — invited guest emails attached to a booking
- **companies** — the companies allowed to book, with a `monthly_free_hours` column (each company's own free-hours quota — you can change it from the dashboard, no code needed)
- **admin_users** — the allow-list of who can log into `/admin` (linked to the `auth.users` login table)

### Double-booking protection

There's a database-level **exclusion constraint** (`no_overlapping_bookings`) that physically prevents two overlapping bookings for the same room from ever existing — even if a bug slipped through the code, the database itself rejects the conflict. That's what causes the "this time is already booked" message you sometimes see.

### Key functions (RPCs)

- **`create_booking`** — runs whenever a new booking is confirmed on the site. It checks: the room and company exist, the email is valid, the duration is between 30 minutes and 6 hours, the booking isn't too soon (under 10 minutes away) or too far out (more than a week), and the time falls within the room's opening hours (**specifically in Riyadh time** — an important detail, explained in the notes below).
- **`admin_update_booking`** — edits an existing booking from the dashboard.
- **`get_busy_ranges`** — returns the busy time ranges for a given room and day, used to show available slots on the booking page.
- **`bookings_export`** (view) — prepares all booking data for the dashboard's Excel export.

### SQL files and the order to run them

Every database change is saved as its own file under `sql/`, in this order:
```
schema.sql              → the base setup (tables + functions + permissions)
migration-2-feedback.sql
migration-3.sql         → adds the companies system
migration-4.sql         → extends booking hours + lowers minimum duration to 30 min + renames a room
migration-5.sql         → per-company free-hours column (monthly_free_hours)
migration-6.sql         → fixes the opening-hours timezone bug (UTC vs Riyadh)
```
If you ever need to set up a fresh database (a second Supabase project), run these in this exact order in the SQL Editor.

---

## 4) The email system — the story of how we got here

I tried 3 approaches before landing on the current one — documenting this so no one re-tries the ones that didn't work:

1. **Resend** — technically solid, but to send to any customer (not just your own account email) you need to verify a full domain via DNS, which means buying a domain (a cost).
2. **Direct Gmail SMTP** (via the `denomailer` library) — completely free, no domain needed, but the library kept building malformed email messages (MIME) that some mail clients (Gmail's web interface especially) displayed as raw, unreadable text. We tried several fixes (encoding settings, library options) and none of them held up reliably.
3. **Brevo API** (current solution) — a dedicated transactional email service, free up to 300 emails/day, and it builds the message correctly on its own end (we don't hand-build it), which fixed the problem for good.

### How email sending works now

3 Edge Functions live under `supabase/functions/`:
- **`notify-booking`** — sends the confirmation email to the customer + an invite to any guest added to the booking
- **`notify-cancel`** — sends a cancellation email when a booking is cancelled
- **`send-reminders`** — runs automatically every 5 minutes (a cron job) and emails a reminder for any booking starting within 30 minutes (sent once per booking, never repeated)

All three share two files under `_shared/`: `mailer.ts` (talks to Brevo) and `email-template.ts` (the email's look and wording).

### If you ever need to change the sending email or provider

The values are stored as Secrets (not hardcoded):
```
supabase secrets set BREVO_API_KEY="..." BREVO_SENDER_EMAIL="..." BREVO_SENDER_NAME="..."
```
Changing these values alone — no code edits, no redeploy — is enough to change where emails are sent from.

---

## 5) The dashboard (`/admin`)

- Login via Supabase Auth (email + password) — only users listed in `admin_users` can get in
- A table of all bookings, with filters (date, room, company, search)
- Edit/cancel any booking, or manually "block" a slot (internal use / maintenance)
- Add a new company, and edit each company's monthly free-hours quota (the "Free hours" button)
- Two charts (Chart.js): booking distribution (today/week/month), and bookings by company this month — automatically switches to show a single company's free-hours usage when you filter by that company
- A formatted Excel export (color-coded status: confirmed = green / cancelled = red) via the ExcelJS library

---

## 6) Transferring ownership (handing the project to another developer/company)

Ownership is spread across 4 separate accounts, each transferred on its own:

1. **GitHub** — transfer the repository (Settings → General → Transfer ownership) or add the person as a Collaborator
2. **Cloudflare Pages** — add a new member to the Cloudflare account (or transfer the site entirely from account settings)
3. **Supabase** — from Project Settings → Team, add a new member with Owner/Admin permission on the same project (no need to create a new project or migrate data)
4. **Brevo** — same idea: add a new member from account settings, or hand over the login credentials if the whole account is being transferred

**Important:** if the account you're handing over is tied to your personal email (like Gmail), and it needs to be fully separated from you, it's best to set up a dedicated email for the project from the start (instead of everything hanging off your personal email) and link all the accounts above to that.

---

## 7) Adding a new dashboard admin

Just two steps:

**a) Create a login account:**
Supabase Dashboard → Authentication → Users → Add user (enter the email, and a password or send an invite)

**b) Grant them dashboard access** (in the SQL Editor):
```sql
insert into admin_users (user_id, full_name)
values ('USER_UID_from_step_a', 'Person''s name');
```
You'll find the UID in the Users table right after creating the account.

---

## 8) If a company's email (or other company info) changes

Straight from the dashboard, no code involved:
- **Edit a customer's email on a specific booking:** the "Edit" button on that booking, from the bookings table
- **Edit a company's name/hours:** the "Free hours" button next to the company chart, or directly in Supabase's Table Editor on the `companies` table for deeper edits (like disabling a company entirely by setting `active` to `false`)

---

## 9) Important technical notes and gotchas

- **Timezones:** the Supabase database runs in UTC by default, not Riyadh time. Any time comparison in the code (SQL or JavaScript) has to explicitly force `Asia/Riyadh`, otherwise times get miscalculated by a 3-hour offset (this is exactly the bug fixed in `migration-6.sql`).
- **Free-tier limits:**
  - Supabase Free: the project automatically pauses after 7 days of no activity — it comes back with a "Restore" click from the dashboard, and no data is lost.
  - Brevo Free: 300 emails/day — comfortably more than our current usage.
- **Numbers and dates:** every number shown on the site explicitly forces Western digits (`nu-latn`), because the `ar-SA` locale defaults to Arabic-Indic digits and the Hijri calendar unless told otherwise.

---

*يستحسن اي ابديت جديد يتسجل فالملف هذا 
This file should be updated whenever a major change is made to the project — if you add a new feature, come back and add a paragraph here.*
