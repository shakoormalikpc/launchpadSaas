/**
 * READ-ONLY inspection for the "reset 3 students" request.
 *
 * Finds candidate accounts by name, resolves their auth email, their licenses,
 * progress/state row counts, and the owning organization + seat counts.
 * It MUTATES NOTHING — run it, eyeball the output, confirm the exact user IDs,
 * then (and only then) run reset-students.mjs with those confirmed IDs.
 *
 * Run (never commit the service-role key):
 *   SUPABASE_URL="https://vhejpfmuivvvnbhabaqf.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   node supabase/scripts/inspect-students-for-reset.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

// The 3 target students. Matching is fuzzy + accent/apostrophe-insensitive on
// purpose — we present candidates for a human to confirm, never auto-act.
const TARGET_NAMES = ["Quincy Bailey", "James Baldwin Jr", "D'Angelo Price"];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Normalize a name for loose comparison: lowercase, strip accents, collapse
 * apostrophes/punctuation/whitespace, drop the "jr"/"sr"/"ii"/"iii" suffix.
 * @param {string} s - Raw name.
 * @returns {string} Normalized comparison key.
 */
function norm(s) {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[''`.,]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a map of auth user id -> email by paginating the admin user list.
 * @returns {Promise<Map<string, string>>}
 */
async function buildEmailMap() {
  const map = new Map();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) map.set(u.id, u.email ?? "(no email)");
    if (data.users.length < 200) break;
  }
  return map;
}

async function main() {
  console.log("── READ-ONLY inspection (nothing will be modified) ──\n");

  const emailMap = await buildEmailMap();
  console.log(`Auth users in project: ${emailMap.size}\n`);

  // Pull all profiles (small table) and match locally so fuzzy logic is in one place.
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id, first_name, last_name, role, group_name");
  if (profErr) throw new Error(`profiles read failed: ${profErr.message}`);

  const targets = TARGET_NAMES.map(norm);

  for (const name of TARGET_NAMES) {
    const key = norm(name);
    const matches = (profiles ?? []).filter((p) => {
      const full = norm(`${p.first_name ?? ""} ${p.last_name ?? ""}`);
      return full === key || full.includes(key) || key.includes(full);
    });

    console.log("============================================================");
    console.log(`TARGET: "${name}"  →  ${matches.length} candidate(s)`);
    console.log("============================================================");

    for (const p of matches) {
      const email = emailMap.get(p.id) ?? "(NO AUTH USER — orphan profile)";
      console.log(`\n  • profile.id : ${p.id}`);
      console.log(`    name       : ${p.first_name ?? ""} ${p.last_name ?? ""}`);
      console.log(`    email      : ${email}`);
      console.log(`    role       : ${p.role ?? "(none)"}`);
      console.log(`    group_name : ${p.group_name ?? "(none)"}`);

      const { data: lics } = await admin
        .from("licenses")
        .select("id, org_id, bundle_id, course_type, is_active, student_email, user_id")
        .or(`user_id.eq.${p.id},student_email.eq.${email}`);

      const { count: progCount } = await admin
        .from("user_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", p.id);

      const { count: stateCount } = await admin
        .from("lesson_states")
        .select("id", { count: "exact", head: true })
        .eq("user_id", p.id);

      console.log(`    licenses   : ${lics?.length ?? 0}`);
      for (const l of lics ?? []) {
        console.log(
          `        - license.id=${l.id} org=${l.org_id} bundle=${l.bundle_id} ` +
            `active=${l.is_active} course="${l.course_type}" linked_user=${l.user_id ?? "null"}`
        );
      }
      console.log(`    user_progress rows : ${progCount ?? 0}`);
      console.log(`    lesson_states rows : ${stateCount ?? 0}`);

      // Resolve & report the owning org(s) + seat counts.
      const orgIds = [...new Set((lics ?? []).map((l) => l.org_id).filter(Boolean))];
      for (const orgId of orgIds) {
        const { data: org } = await admin
          .from("organizations")
          .select("id, name, admin_id, total_seats, used_seats, subscription_status")
          .eq("id", orgId)
          .maybeSingle();
        if (org) {
          const adminEmail = emailMap.get(org.admin_id) ?? "(unknown)";
          console.log(
            `    ORG (via license) ${org.name} (id=${org.id}) admin=${adminEmail} ` +
              `total_seats=${org.total_seats} used_seats=${org.used_seats} status=${org.subscription_status}`
          );
        }
      }

      // CRITICAL: does THIS profile OWN an organization (admin_id = profile.id)?
      // If so, a full delete would orphan that org + everyone under it.
      const { data: ownedOrgs } = await admin
        .from("organizations")
        .select("id, name, total_seats, used_seats, subscription_status")
        .eq("admin_id", p.id);
      if ((ownedOrgs ?? []).length) {
        for (const org of ownedOrgs) {
          const { count: orgLicCount } = await admin
            .from("licenses")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org.id);
          console.log(
            `    ⚠ OWNS ORG "${org.name}" (id=${org.id}) total_seats=${org.total_seats} ` +
              `used_seats=${org.used_seats} status=${org.subscription_status} licenses_in_org=${orgLicCount ?? 0}`
          );
        }
      } else {
        console.log("    owns_org   : (none — not an org owner)");
      }
    }
    console.log("");
  }

  console.log("── End of inspection. No data was modified. ──");
}

main().catch((err) => {
  console.error("\n✗ Inspection failed:", err.message);
  process.exit(1);
});
