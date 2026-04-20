-- ============================================================================
-- 017_mail_messages.sql
--
-- Creates the `mail_messages` table that powers the admin Inbox / Outbox.
--
-- One row = one email we care about, either:
--   - direction='inbound'  : a public contact-form submission. These are
--                            ALSO forwarded to peptidexm@gmail.com via Resend
--                            at write time (see lib/mail.ts), so the owner
--                            can reply directly from Gmail if they prefer.
--   - direction='outbound' : a one-off email composed by an admin from the
--                            Inbox UI (not a marketing broadcast — those live
--                            in the separate `email_broadcasts` table).
--
-- A reply chain is represented by `reply_to_id` pointing back at the message
-- being answered, so the Inbox can thread them.
-- ============================================================================

create table if not exists public.mail_messages (
  id               uuid primary key default gen_random_uuid(),
  direction        text not null check (direction in ('inbound', 'outbound')),

  -- Sender / recipient as plain strings so we can store contacts that don't
  -- have a profile row yet (random visitors via contact form).
  from_email       text not null,
  from_name        text,
  to_email         text not null,

  subject          text not null,
  body_text        text not null,
  body_html        text,

  -- Threads a reply to its parent inbound message. Null for standalone sends.
  reply_to_id      uuid references public.mail_messages(id) on delete set null,

  -- Lifecycle flags, tracked with timestamps so we don't lose "when" info.
  read_at          timestamptz,
  archived_at      timestamptz,

  -- Resend delivery metadata for outbound sends + inbound forwards.
  resend_id        text,
  status           text not null default 'received'
                   check (status in ('received', 'forwarded', 'sent', 'failed')),
  error_message    text,

  -- Which admin composed the message (outbound only).
  sent_by          uuid references auth.users(id) on delete set null,

  created_at       timestamptz not null default now()
);

create index if not exists mail_messages_direction_created_idx
  on public.mail_messages (direction, created_at desc);

create index if not exists mail_messages_unread_idx
  on public.mail_messages (direction, read_at)
  where direction = 'inbound' and archived_at is null;

create index if not exists mail_messages_reply_to_idx
  on public.mail_messages (reply_to_id);

-- ---------------------------------------------------------------------------
-- RLS: admins only. Inbound messages are inserted through the public contact
-- form's server action, which runs with the user's (anon) client — so we need
-- an INSERT policy that allows anyone to create an inbound row. All reads,
-- updates, and outbound inserts are restricted to admins via is_admin().
-- ---------------------------------------------------------------------------
alter table public.mail_messages enable row level security;

drop policy if exists "mail_messages admin all" on public.mail_messages;
create policy "mail_messages admin all"
  on public.mail_messages
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mail_messages public insert inbound" on public.mail_messages;
create policy "mail_messages public insert inbound"
  on public.mail_messages
  for insert
  to anon, authenticated
  with check (direction = 'inbound');
