/**
 * Application feature flags.
 *
 * LAUNCH-PHASE LOCKDOWN: Stripe is in TEST mode in production while seats are
 * sold offline. Purchasing must stay disabled so nobody triggers a test-mode
 * checkout. Re-enable by setting `VITE_PURCHASING_ENABLED=true` (client) AND
 * `PURCHASING_ENABLED=true` (create-checkout-session edge function env).
 */

/** Whether self-service seat purchasing / checkout is enabled. */
export const PURCHASING_ENABLED: boolean =
  import.meta.env.VITE_PURCHASING_ENABLED === "true";

/** User-facing message shown when purchasing is disabled. */
export const PURCHASING_DISABLED_MESSAGE =
  "Purchasing is temporarily disabled during the launch phase.";
