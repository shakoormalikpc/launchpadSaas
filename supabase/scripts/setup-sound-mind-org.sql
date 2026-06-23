-- ============================================================================
-- ⚠ INCOMPLETE PATH — PREFER provision-sound-mind-admin.mjs INSTEAD.
-- This script only sets the org-level total_seats/subscription_status, which
-- makes the dashboard HEADLINE read 250 but leaves the per-bundle "assign
-- student" flow empty (get_bundle_seat_summary reads the `purchases` table,
-- not total_seats). Use the .mjs script — it also writes the `purchases` row
-- and 250 `licenses`, exactly like a real Stripe purchase, so seat assignment
-- actually works. Keep this only as a manual DB reference.
-- ============================================================================
-- Manual organization provisioning: "Sound Mind, Sound Body"
-- 250 seats purchased OFFLINE (check) — no Stripe involvement.
--
-- This is a one-off data-seed for a specific customer. It is intentionally
-- NOT placed in supabase/migrations/ (migrations run on every environment and
-- should not seed customer data). Run it once against production via the
-- Supabase SQL Editor or `supabase db execute`.
--
-- Uses ONLY existing columns — does not alter the schema.
-- Idempotent: safe to re-run.
--
-- PREREQUISITE: the organization's admin must first sign up at /signup as an
-- "org_admin" (this creates their profile + an organizations row with
-- total_seats = 0). Then set the email below and run this script to flip that
-- org to 250 active seats.
-- ============================================================================

DO $$
DECLARE
  -- 👉 EDIT THIS to the email the admin used at /signup:
  v_admin_email text := 'angel.allwood@smsbacademy.com';
  v_org_name    text := 'Sound Mind, Sound Body';
  v_seats       int  := 250;

  v_admin_id uuid;
  v_org_id   uuid;
BEGIN
  -- 1. Resolve the admin auth user.
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE lower(email) = lower(v_admin_email)
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION
      'No auth user found for %. The admin must sign up at /signup (role org_admin) first.',
      v_admin_email;
  END IF;

  -- 2. Make sure their profile is flagged as an org_admin (signup already does
  --    this, but enforce it in case the row was created another way).
  UPDATE public.profiles
  SET role = 'org_admin'
  WHERE id = v_admin_id
    AND (role IS DISTINCT FROM 'org_admin');

  -- 3. Find an existing org for this admin (created during signup).
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE admin_id = v_admin_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    -- No org row yet → create one fully provisioned.
    INSERT INTO public.organizations (admin_id, name, total_seats, used_seats, subscription_status)
    VALUES (v_admin_id, v_org_name, v_seats, 0, 'active')
    RETURNING id INTO v_org_id;

    RAISE NOTICE 'Created organization % (id=%) with % seats.', v_org_name, v_org_id, v_seats;
  ELSE
    -- Org exists → upgrade it to the purchased seat count + active status.
    -- used_seats is preserved (do not clobber already-assigned seats).
    UPDATE public.organizations
    SET name                = v_org_name,
        total_seats         = v_seats,
        subscription_status = 'active'
    WHERE id = v_org_id;

    RAISE NOTICE 'Updated organization % (id=%) to % seats (active).', v_org_name, v_org_id, v_seats;
  END IF;
END $$;

-- Verify:
-- SELECT id, name, admin_id, total_seats, used_seats, subscription_status
-- FROM public.organizations WHERE name = 'Sound Mind, Sound Body';
