-- Chat-bubble lead capture.
--
-- Purpose
--   The site has a floating chat bubble that, regardless of whether
--   we're "online" or "offline" by business hours, collects a short
--   message + contact info from the visitor and emails it to the
--   ops inbox. This table is the durable store so we can:
--     - retry the email if Resend is down,
--     - audit / search past inquiries from the admin,
--     - rate-limit by IP / email without a Redis dep.
--
-- Design choices
--   - Single table for both "we're online" and "we're offline"
--     submissions; the only difference is the `submitted_when`
--     column ("online"/"offline"), which drives admin filtering and
--     SLA reporting later. Splitting into two tables would just
--     duplicate every column.
--   - `phone` is nullable because we only require it when the site
--     is offline. Validation is enforced in the server action, not
--     here, so the schema stays useful if business rules change.
--   - `status` is a small open-coded text column ("new", "replied",
--     "archived", "spam") rather than an enum so adding a new
--     status doesn't need ALTER TYPE and a redeploy.
--   - One simple index on (status, created_at desc) is enough — the
--     admin list page is the only frequent reader.
--
-- RLS
--   Inserts happen via the service-role admin client in a server
--   action, so anon/auth INSERT is denied. SELECT is locked to
--   service-role too; the admin page reads through the service
--   client. That keeps customer messages off the public API.

create table if not exists public.chat_messages (
  id              uuid           primary key default gen_random_uuid(),
  created_at      timestamptz    not null    default now(),
  -- Visitor-supplied fields. All trimmed/length-capped at the action layer.
  name            text           null,
  email           text           not null,
  phone           text           null,
  message         text           not null,
  -- "online" if we were within business hours when the message was
  -- submitted, "offline" otherwise. Lets the admin filter by SLA
  -- expectation without recomputing from created_at.
  submitted_when  text           not null    default 'offline',
  -- Lifecycle. Open-coded so we can add states without a migration.
  status          text           not null    default 'new',
  -- Lightweight provenance for spam triage / debugging. None of these
  -- are required; we just record what we have.
  user_agent      text           null,
  page_url        text           null,
  ip_address      text           null,
  -- Free-form admin scratchpad for follow-up notes.
  admin_notes     text           null,
  replied_at      timestamptz    null
);

create index if not exists chat_messages_inbox_idx
  on public.chat_messages (status, created_at desc);

alter table public.chat_messages enable row level security;

-- No public policies. The admin server actions use createAdminClient()
-- (service role), which bypasses RLS, so we don't need permissive
-- policies that would expose customer messages to anon/auth.
drop policy if exists "chat_messages anon read" on public.chat_messages;
drop policy if exists "chat_messages anon write" on public.chat_messages;

-- Seed the business-hours config in site_settings if it isn't there
-- yet. Stored as JSON so the schema can grow (multiple windows per
-- day, holidays, etc.) without another migration.
--
-- Default: Mon–Fri, 9:00–17:00 America/New_York. The "days" array
-- is 0 (Sun) … 6 (Sat). Hours are 24h "HH:MM" strings, half-open
-- interval [start, end). Outside the window the bubble shows the
-- "leave a note" copy and requires phone.
insert into public.site_settings (key, value)
values (
  'chat_business_hours',
  jsonb_build_object(
    'enabled',  true,
    'timezone', 'America/New_York',
    'start',    '09:00',
    'end',      '17:00',
    'days',     jsonb_build_array(1, 2, 3, 4, 5)
  )
)
on conflict (key) do nothing;
