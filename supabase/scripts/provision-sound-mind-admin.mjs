/**
 * One-off provisioning for the offline-paid org "Sound Mind, Sound Body".
 *
 * Replicates EXACTLY what a real Stripe purchase does (see
 * supabase/functions/stripe-webhook/index.ts → checkout.session.completed) so
 * the org ends up in an identical, fully-working state — without any Stripe
 * charge. Concretely it:
 *   1. Creates/updates the org admin auth user WITH a password (email pre-confirmed).
 *   2. Sets their profile role to `org_admin`.
 *   3. Provisions the organization (subscription_status = 'active').
 *   4. Inserts a `purchases` row for the chosen bundle (this is what the
 *      get_bundle_seat_summary RPC reads — required for the admin to assign seats).
 *   5. Sets organizations.total_seats and inserts 250 unassigned `licenses` rows.
 *
 * Uses ONLY existing tables/columns — does not alter the schema.
 * Idempotent: the purchase/licenses step is skipped on re-run (guarded by a
 * fixed offline marker in purchases.stripe_payment_id).
 *
 * Run locally (never commit the service-role key):
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   node supabase/scripts/provision-sound-mind-admin.mjs
 *
 * Optional env overrides:
 *   ADMIN_PASSWORD   choose the admin password (else a strong one is generated)
 *   BUNDLE_NAME      course_bundles.name to allocate seats to (default below)
 *   CHECK_AMOUNT     dollar amount of the check, for the purchases record (default 0)
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

// ── Config ──────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "angel.allwood@smsbacademy.com";
const ADMIN_FIRST = "Angel";
const ADMIN_LAST = "Allwood";
const ORG_NAME = "Sound Mind, Sound Body";
const TOTAL_SEATS = 250;
// "Full access" → the bundle the app grants all 14 lessons for (useStudentBundle.ts).
const BUNDLE_NAME = process.env.BUNDLE_NAME ?? "Advanced Financial Education";
const SUBSCRIPTION_TYPE = "academic_year"; // → 10-month expiry, same as webhook
const CHECK_AMOUNT = Number(process.env.CHECK_AMOUNT ?? 0);
// Fixed marker so re-runs don't duplicate the purchase / 250 licenses.
const OFFLINE_MARKER = "offline-check-smsb-digital-experience";
// Bundles that DON'T grant all 14 lessons — warn if one is picked by mistake.
const RESTRICTED_BUNDLES = new Set(["Money Management Fundamentals", "Personal Finance Essentials"]);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const password =
  process.env.ADMIN_PASSWORD ?? `Smsb-${randomBytes(9).toString("base64url")}!7`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Finds an existing auth user by email (paginates the admin list).
 * @param {string} email - The email to search for.
 * @returns {Promise<import("@supabase/supabase-js").User | null>}
 */
async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  // ── 1. Create or update the admin auth user (email pre-confirmed) ──────────
  let userId;
  const existing = await findUserByEmail(ADMIN_EMAIL);
  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) throw new Error(`Updating user failed: ${error.message}`);
    console.log(`✓ Updated existing auth user (${ADMIN_EMAIL}) and reset password.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: ADMIN_EMAIL, password, email_confirm: true });
    if (error) throw new Error(`Creating user failed: ${error.message}`);
    userId = data.user.id;
    console.log(`✓ Created auth user (${ADMIN_EMAIL}).`);
  }

  // ── 2. Upsert the org_admin profile ───────────────────────────────────────
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { id: userId, first_name: ADMIN_FIRST, last_name: ADMIN_LAST, group_name: ORG_NAME, role: "org_admin" },
      { onConflict: "id" }
    );
  if (profileError) throw new Error(`Profile upsert failed: ${profileError.message}`);
  console.log("✓ Profile set to org_admin.");

  // ── 3. Ensure the organization row exists (active) ────────────────────────
  let orgId;
  const { data: org, error: orgFetchError } = await admin
    .from("organizations")
    .select("id, total_seats")
    .eq("admin_id", userId)
    .maybeSingle();
  if (orgFetchError) throw new Error(`Org lookup failed: ${orgFetchError.message}`);

  if (org) {
    orgId = org.id;
    const { error } = await admin
      .from("organizations")
      .update({ name: ORG_NAME, subscription_status: "active" })
      .eq("id", orgId);
    if (error) throw new Error(`Org update failed: ${error.message}`);
    console.log(`✓ Organization "${ORG_NAME}" exists and is active.`);
  } else {
    const { data: inserted, error } = await admin
      .from("organizations")
      .insert({ admin_id: userId, name: ORG_NAME, total_seats: 0, used_seats: 0, subscription_status: "active" })
      .select("id")
      .single();
    if (error) throw new Error(`Org insert failed: ${error.message}`);
    orgId = inserted.id;
    console.log(`✓ Created organization "${ORG_NAME}" (active).`);
  }

  // ── 4. Resolve the bundle to allocate the 250 seats against ───────────────
  const { data: bundle, error: bundleErr } = await admin
    .from("course_bundles")
    .select("id, name")
    .ilike("name", BUNDLE_NAME)
    .maybeSingle();
  if (bundleErr) throw new Error(`Bundle lookup failed: ${bundleErr.message}`);

  if (!bundle) {
    const { data: all } = await admin.from("course_bundles").select("id, name");
    console.error(`\n✗ No course_bundles row matching "${BUNDLE_NAME}". Available bundles:`);
    (all ?? []).forEach((b) => console.error(`    • ${b.name}  (${b.id})`));
    console.error("\nRe-run with BUNDLE_NAME set to the exact bundle name you want.");
    process.exit(1);
  }
  if (RESTRICTED_BUNDLES.has(bundle.name)) {
    console.warn(`⚠  Bundle "${bundle.name}" does NOT grant all 14 lessons. Re-run with BUNDLE_NAME to change.`);
  }
  console.log(`✓ Allocating seats to bundle "${bundle.name}".`);

  // ── 5. Replicate the purchase: purchases row + total_seats + 250 licenses ──
  // Guard against double-application on re-run.
  const { data: priorPurchase } = await admin
    .from("purchases")
    .select("id")
    .eq("stripe_payment_id", OFFLINE_MARKER)
    .maybeSingle();

  if (priorPurchase) {
    console.log("• Offline purchase already applied — skipping purchases/licenses (idempotent).");
  } else {
    // 5a. purchases row (what get_bundle_seat_summary reads for "purchased")
    const { error: purErr } = await admin.from("purchases").insert({
      org_id: orgId,
      bundle_id: bundle.id,
      seats_purchased: TOTAL_SEATS,
      amount_paid: CHECK_AMOUNT,
      stripe_payment_id: OFFLINE_MARKER,
    });
    if (purErr) throw new Error(`Purchases insert failed: ${purErr.message}`);

    // 5b. bump total_seats by the purchased quantity (mirrors webhook)
    const currentSeats = org?.total_seats ?? 0;
    const { error: seatErr } = await admin
      .from("organizations")
      .update({ total_seats: currentSeats + TOTAL_SEATS })
      .eq("id", orgId);
    if (seatErr) throw new Error(`total_seats update failed: ${seatErr.message}`);

    // 5c. Do NOT pre-create license rows. The get_bundle_seat_summary RPC
    // computes available = SUM(purchases.seats_purchased) - COUNT(all licenses
    // for org+bundle). Pre-creating 250 licenses would make available = 0 and
    // the admin couldn't assign anyone. Each license is created when the admin
    // invites a student (AdminDashboard.handleInvite), which is what consumes a
    // seat. So the purchases row alone is the correct allocation.
    console.log(`✓ Recorded purchase of ${TOTAL_SEATS} seats (available to assign: ${TOTAL_SEATS}).`);
  }

  console.log("\n── Admin credentials (share securely with the client) ──");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${password}`);
  console.log("  Login at: /login  →  /admin-dashboard");
  console.log(`\nThe admin can now assign up to ${TOTAL_SEATS} students from the "${bundle.name}" bundle.`);
}

main().catch((err) => {
  console.error("\n✗ Provisioning failed:", err.message);
  process.exit(1);
});
