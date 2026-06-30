/**
 * DESTRUCTIVE reset for a fixed, explicitly-confirmed set of students.
 *
 * Companion to inspect-students-for-reset.mjs. Run the inspection first,
 * confirm the exact user IDs by eye, then pass ONLY those IDs here. This script
 * does NO name matching — it acts solely on the IDs you give it, so it can never
 * "guess" the wrong account.
 *
 * For each confirmed user id it:
 *   1. Deletes lesson_states rows      (chat/lesson progress blobs)
 *   2. Deletes user_progress rows       (grades / completion)
 *   3. Deletes licenses rows            (frees the seat in get_bundle_seat_summary)
 *   4. Decrements organizations.used_seats by the # of licenses removed per org
 *   5. Deletes the profiles row
 *   6. Deletes the auth.users record    (full delete — fresh /signup?code= after)
 *
 * SAFE BY DEFAULT: this is a DRY RUN unless you pass CONFIRM=DELETE. The dry run
 * prints exactly what it WOULD delete and the resulting seat math, without
 * touching anything.
 *
 * Run (never commit the service-role key):
 *   SUPABASE_URL="https://vhejpfmuivvvnbhabaqf.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   TARGET_USER_IDS="uuid1,uuid2,uuid3" \
 *   node supabase/scripts/reset-students.mjs            # dry run
 *
 *   ...same env... CONFIRM=DELETE node supabase/scripts/reset-students.mjs   # for real
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAW_IDS = process.env.TARGET_USER_IDS ?? "";
const LIVE = process.env.CONFIRM === "DELETE";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TARGET_IDS = [...new Set(RAW_IDS.split(",").map((s) => s.trim()).filter(Boolean))];

if (TARGET_IDS.length === 0) {
  console.error("No TARGET_USER_IDS provided. Run inspect-students-for-reset.mjs first, then pass the confirmed IDs.");
  process.exit(1);
}
const bad = TARGET_IDS.filter((id) => !UUID_RE.test(id));
if (bad.length) {
  console.error(`These TARGET_USER_IDS are not valid UUIDs:\n  ${bad.join("\n  ")}`);
  process.exit(1);
}
// Safety rail: this request is scoped to 4 accounts (Quincy, James, + both
// D'Angelo dupes). Refuse a runaway batch beyond that.
if (TARGET_IDS.length > 4) {
  console.error(`Refusing to run: ${TARGET_IDS.length} IDs given but this task is scoped to 4 accounts.`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Looks up an auth user's email by id (best-effort, for logging only).
 * @param {string} id - Auth user id.
 * @returns {Promise<string>} The email or a placeholder.
 */
async function emailFor(id) {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data?.user) return "(no auth user)";
  return data.user.email ?? "(no email)";
}

/**
 * Counts rows in a table for a given user_id.
 * @param {string} table - Table name.
 * @param {string} userId - The user id to filter on.
 * @returns {Promise<number>} Row count.
 */
async function countFor(table, userId) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(`count ${table} failed: ${error.message}`);
  return count ?? 0;
}

async function main() {
  console.log(`── reset-students.mjs ── ${LIVE ? "LIVE (DELETING)" : "DRY RUN (no changes)"} ──`);
  console.log(`Targets (${TARGET_IDS.length}): ${TARGET_IDS.join(", ")}\n`);

  // Tally seats to give back per org so we decrement used_seats exactly once.
  /** @type {Map<string, number>} */
  const seatsToFreePerOrg = new Map();

  for (const userId of TARGET_IDS) {
    const email = await emailFor(userId);
    const { data: profile } = await admin
      .from("profiles")
      .select("id, first_name, last_name, role, group_name")
      .eq("id", userId)
      .maybeSingle();
    const { data: lics } = await admin
      .from("licenses")
      .select("id, org_id, bundle_id, is_active")
      .eq("user_id", userId);
    const progCount = await countFor("user_progress", userId);
    const stateCount = await countFor("lesson_states", userId);

    console.log("============================================================");
    console.log(`USER ${userId}`);
    console.log(`  email      : ${email}`);
    console.log(
      profile
        ? `  profile    : ${profile.first_name ?? ""} ${profile.last_name ?? ""} (role=${profile.role ?? "none"}, group=${profile.group_name ?? "none"})`
        : "  profile    : (none found)"
    );
    console.log(`  licenses   : ${lics?.length ?? 0}`);
    for (const l of lics ?? []) {
      console.log(`      - ${l.id} org=${l.org_id} bundle=${l.bundle_id} active=${l.is_active}`);
      if (l.org_id) seatsToFreePerOrg.set(l.org_id, (seatsToFreePerOrg.get(l.org_id) ?? 0) + 1);
    }
    console.log(`  user_progress rows : ${progCount}`);
    console.log(`  lesson_states rows : ${stateCount}`);

    // Accidental dummy orgs this account created during a failed signup. We
    // delete these (and any child licenses/purchases) so nothing is orphaned.
    const { data: ownedOrgs, error: ownErr } = await admin
      .from("organizations")
      .select("id, name")
      .eq("admin_id", userId);
    if (ownErr) throw new Error(`owned-org lookup failed (${userId}): ${ownErr.message}`);
    console.log(`  owns orgs  : ${ownedOrgs?.length ?? 0}`);
    for (const org of ownedOrgs ?? []) {
      const { count: orgLicCount } = await admin
        .from("licenses")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id);
      const { count: orgPurCount } = await admin
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id);
      console.log(`      - "${org.name}" (${org.id}) licenses=${orgLicCount ?? 0} purchases=${orgPurCount ?? 0}`);
      if ((orgLicCount ?? 0) > 0) {
        console.log(`        ⚠ org has ${orgLicCount} license(s) — confirm these are garbage before CONFIRM=DELETE.`);
      }
    }

    if (!LIVE) {
      console.log("  → DRY RUN: would delete lesson_states, user_progress, licenses, owned org(s) + their licenses/purchases, profile, auth user.");
      continue;
    }

    // Order matters: child/data rows first, then profile, then auth user.
    const delState = await admin.from("lesson_states").delete().eq("user_id", userId);
    if (delState.error) throw new Error(`lesson_states delete failed (${userId}): ${delState.error.message}`);

    const delProg = await admin.from("user_progress").delete().eq("user_id", userId);
    if (delProg.error) throw new Error(`user_progress delete failed (${userId}): ${delProg.error.message}`);

    const delLic = await admin.from("licenses").delete().eq("user_id", userId);
    if (delLic.error) throw new Error(`licenses delete failed (${userId}): ${delLic.error.message}`);

    // Tear down accidental owned orgs BEFORE the profile/auth user, so the
    // organizations.admin_id FK never dangles (and a FK-constrained delete
    // won't fail). Children (licenses, purchases) go first, then the org row.
    for (const org of ownedOrgs ?? []) {
      const delOrgLic = await admin.from("licenses").delete().eq("org_id", org.id);
      if (delOrgLic.error) throw new Error(`org licenses delete failed (${org.id}): ${delOrgLic.error.message}`);
      const delPur = await admin.from("purchases").delete().eq("org_id", org.id);
      if (delPur.error) throw new Error(`purchases delete failed (${org.id}): ${delPur.error.message}`);
      const delOrg = await admin.from("organizations").delete().eq("id", org.id);
      if (delOrg.error) throw new Error(`organization delete failed (${org.id}): ${delOrg.error.message}`);
      console.log(`  ✓ Deleted owned org "${org.name}" (${org.id}) + its licenses/purchases.`);
    }

    const delProfile = await admin.from("profiles").delete().eq("id", userId);
    if (delProfile.error) throw new Error(`profiles delete failed (${userId}): ${delProfile.error.message}`);

    const delUser = await admin.auth.admin.deleteUser(userId);
    if (delUser.error) throw new Error(`auth user delete failed (${userId}): ${delUser.error.message}`);

    console.log("  ✓ Deleted lesson_states, user_progress, licenses, profile, and auth user.");
  }

  // ── Restore seats: decrement used_seats per affected org ───────────────────
  console.log("\n------------------------------------------------------------");
  console.log("Seat restoration (used_seats):");
  for (const [orgId, freed] of seatsToFreePerOrg) {
    const { data: org, error } = await admin
      .from("organizations")
      .select("id, name, total_seats, used_seats")
      .eq("id", orgId)
      .maybeSingle();
    if (error) throw new Error(`org read failed (${orgId}): ${error.message}`);
    if (!org) {
      console.log(`  org ${orgId}: NOT FOUND (skipping)`);
      continue;
    }
    const next = Math.max(0, (org.used_seats ?? 0) - freed);
    console.log(`  ${org.name} (${orgId}): used_seats ${org.used_seats} → ${next}  (freeing ${freed})`);
    if (!LIVE) continue;

    const { error: upErr } = await admin
      .from("organizations")
      .update({ used_seats: next })
      .eq("id", orgId);
    if (upErr) throw new Error(`used_seats update failed (${orgId}): ${upErr.message}`);
    console.log("    ✓ used_seats updated.");
  }

  console.log(
    `\n── ${LIVE ? "Reset complete." : "DRY RUN complete — re-run with CONFIRM=DELETE to apply."} ──`
  );
}

main().catch((err) => {
  console.error("\n✗ Reset failed:", err.message);
  process.exit(1);
});
