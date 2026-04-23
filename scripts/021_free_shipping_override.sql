-- Free-shipping kill switch.
--
-- Seeds a new row in public.site_settings so the admin can turn on
-- site-wide free shipping (US + international) with a single toggle —
-- no deploy required, no per-country configuration.
--
-- The key is namespaced `shipping_*` to leave room for future
-- shipping-related flags (per-region rates, cutoff-time banners,
-- etc.) without colliding with the existing `payment_*` keys.
--
-- Default is FALSE: normal shipping rules apply (US flat $20, free
-- at $500+, international flat $50). Operators opt in to the free
-- promo explicitly via the admin UI. This makes fresh envs and
-- accidental DB resets safe — no one gets surprise free shipping
-- because a migration ran before its companion admin UI did.

insert into public.site_settings (key, value)
values ('shipping_free_all_enabled', to_jsonb(false))
on conflict (key) do nothing;
