-- Add subscription tracking columns to organizations (idempotent)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_status     text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text;

-- Back-fill: any org that has purchased seats should show as active
UPDATE public.organizations
SET subscription_status = 'active'
WHERE total_seats > 0
  AND (subscription_status IS NULL OR subscription_status = 'none');

-- Add expiry + type tracking to licenses (idempotent)
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS expires_at        timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_type text;
