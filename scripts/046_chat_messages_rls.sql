-- chat_messages was created in 045 with RLS enabled but no policies,
-- which silently locked admins out of their own inbox: the chat
-- detail page 404'd and the list looked empty. We mirror the
-- mail_messages pattern exactly because that one is battle-tested:
--
--   * Admins (authenticated, is_admin()) get full ALL access — read,
--     insert, update, delete. The list, detail, and chat-action
--     server actions all run through createClient() so they hit
--     this policy.
--   * Anonymous + authenticated visitors get INSERT only, with no
--     row visibility. The submit-chat action already uses the
--     service-role client which bypasses RLS, but we still grant
--     anon INSERT as defense-in-depth: if a future code path
--     accidentally writes through the regular client, the row
--     still lands instead of silently failing.
--   * No SELECT for anon — visitors can never read other people's
--     chat submissions.

drop policy if exists "chat_messages admin all"          on public.chat_messages;
drop policy if exists "chat_messages public insert"      on public.chat_messages;

create policy "chat_messages admin all"
  on public.chat_messages
  for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "chat_messages public insert"
  on public.chat_messages
  for insert
  to anon, authenticated
  with check (true);
