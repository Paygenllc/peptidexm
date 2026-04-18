-- Fix: subscribe form was failing because anon callers hit RLS on the
-- UPDATE path of `.upsert()` against public.newsletter_subscribers, and
-- had no permission to touch public.profiles at all.
--
-- Solution: move the whole flow into a single SECURITY DEFINER function
-- that runs with elevated privileges. The server action calls it via RPC.

create or replace function public.subscribe_to_newsletter(
  p_email text,
  p_source text default 'footer'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'email_required' using errcode = '22023';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'email_invalid' using errcode = '22023';
  end if;

  insert into public.newsletter_subscribers (email, source, subscribed_at, unsubscribed_at)
  values (v_email, coalesce(nullif(trim(p_source), ''), 'footer'), now(), null)
  on conflict (email) do update
    set subscribed_at   = excluded.subscribed_at,
        unsubscribed_at = null,
        source          = coalesce(public.newsletter_subscribers.source, excluded.source);

  update public.profiles
     set newsletter_subscribed = true
   where lower(email) = v_email
     and (newsletter_subscribed is distinct from true);
end;
$$;

revoke all on function public.subscribe_to_newsletter(text, text) from public;
grant execute on function public.subscribe_to_newsletter(text, text) to anon, authenticated;
