/**
 * Demo data seed for the Reporting & Analytics dashboard.
 *
 * Provisions a demo organization for an admin and fills it with realistic,
 * varied student performance data so the Recharts graphs, Top Performers
 * leaderboard, and Auto-Summary all look fully populated for a client demo.
 *
 * What it creates (all via the service-role key — bypasses RLS, like the
 * existing provision-sound-mind-admin.mjs):
 *   1. The admin auth user + org_admin profile (email pre-confirmed).
 *   2. An active organization owned by that admin (+ a purchases row so the
 *      seat-summary / invite UI is populated too).
 *   3. ~14 students (auth users + student profiles + assigned licenses).
 *   4. lesson_attempts history: multiple lessons per student, multiple attempts
 *      (retakes) per lesson, pre < post growth, spread across ~80 days.
 *   5. user_progress snapshots (latest attempt per lesson) mirroring the engine.
 *
 * Idempotent: re-running deletes this cohort's prior attempts/progress and
 * re-seeds deterministically (fixed PRNG seed), and skips already-created users.
 *
 * Run (never commit the service-role key):
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   node supabase/scripts/seed-demo-analytics.mjs
 *
 * Optional env overrides:
 *   ADMIN_EMAIL      default demo.admin@launchpad.com
 *   STUDENT_PASSWORD default "DemoStudent!23"  (students can log in for the demo)
 *   BUNDLE_NAME      course_bundles.name to assign (default "Advanced Financial Education")
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "demo.admin@launchpad.com";
const ADMIN_FIRST = "Demo";
const ADMIN_LAST = "Admin";
const ORG_NAME = "LaunchPad Demo Academy";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "DemoAdmin!23";
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD ?? "DemoStudent!23";
const BUNDLE_NAME = process.env.BUNDLE_NAME ?? "Advanced Financial Education";
const TOTAL_SEATS = 30;
const OFFLINE_MARKER = "offline-demo-launchpad-analytics";
const STUDENT_EMAIL_DOMAIN = "demo.launchpad.com";

// The 14 canonical lesson ids (must match src/utils/lessonNames.ts LESSON_OPTIONS).
const LESSONS = [
  "earning-money",
  "living-on-your-own",
  "understanding-wants-needs",
  "saving-investing",
  "influence-of-advertising",
  "cost-of-college",
  "protecting-insuring",
  "art-of-budgeting",
  "understanding-banking",
  "take-home-pay",
  "financial-decisions",
  "credit-score",
  "consumer-privacy",
  "using-credit",
];

const PRE_TOTAL = 5; // pre-test question count
const POST_TOTAL = 10; // post-test question count

/**
 * The demo cohort. `skill` (0..1) drives scores/retakes; `lessons` is how many
 * lessons (in order) the student has worked through; `stagger` shifts all of a
 * student's dates further into the past so recent activity is spread out.
 */
const STUDENTS = [
  { first: "Ava", last: "Thompson", skill: 0.96, lessons: 14, stagger: 1 },
  { first: "Liam", last: "Martinez", skill: 0.91, lessons: 13, stagger: 0 },
  { first: "Sophia", last: "Nguyen", skill: 0.88, lessons: 12, stagger: 2 },
  { first: "Noah", last: "Patel", skill: 0.82, lessons: 11, stagger: 1 },
  { first: "Isabella", last: "Johnson", skill: 0.78, lessons: 12, stagger: 3 },
  { first: "Ethan", last: "Williams", skill: 0.72, lessons: 9, stagger: 0 },
  { first: "Mia", last: "Garcia", skill: 0.68, lessons: 10, stagger: 2 },
  { first: "Lucas", last: "Brown", skill: 0.63, lessons: 8, stagger: 4 },
  { first: "Amelia", last: "Davis", skill: 0.58, lessons: 9, stagger: 1 },
  { first: "Mason", last: "Rodriguez", skill: 0.52, lessons: 7, stagger: 5 },
  { first: "Harper", last: "Lee", skill: 0.47, lessons: 6, stagger: 2 },
  { first: "Elijah", last: "Walker", skill: 0.41, lessons: 5, stagger: 6 },
  { first: "Charlotte", last: "Hall", skill: 0.55, lessons: 4, stagger: 8 },
  { first: "James", last: "Young", skill: 0.38, lessons: 3, stagger: 3 },
];

// ── Deterministic PRNG (mulberry32) so re-runs reproduce the same data ────────
let _seed = 0x9e3779b9;
/** @returns {number} pseudo-random float in [0,1) */
function rand() {
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** @param {number} min @param {number} max @returns {number} int in [min,max] */
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Finds an existing auth user by email (paginates admin list).
 * @param {string} email
 * @returns {Promise<{id:string}|null>}
 */
async function findUserByEmail(email) {
  for (let page = 1; page <= 30; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Creates (or fetches) a confirmed auth user with the given password.
 * @param {string} email @param {string} password
 * @returns {Promise<string>} the user id
 */
async function ensureAuthUser(email, password) {
  const existing = await findUserByEmail(email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  return data.user.id;
}

/** Builds an ISO date `daysAgo` days before now with a daytime hour. */
function dateDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randInt(9, 19), randInt(0, 59), randInt(0, 59), 0);
  return d.toISOString();
}

/**
 * Generates the attempt history for one student.
 * @param {string} userId
 * @param {{skill:number,lessons:number,stagger:number}} s
 * @returns {{attempts:object[], snapshots:object[]}}
 */
function buildStudentData(userId, s) {
  const attempts = [];
  const snapshots = [];
  const count = clamp(s.lessons, 1, LESSONS.length);

  for (let L = 0; L < count; L++) {
    const lessonId = LESSONS[L];

    // Pre-test: low-ish, a touch higher for stronger students.
    const prePct = clamp(0.18 + s.skill * 0.28 + rand() * 0.12, 0.0, 0.7);
    const scorePre = clamp(Math.round(prePct * PRE_TOTAL), 0, PRE_TOTAL);

    // Final post-test: driven by skill, with a small "improves over time" bump
    // for later (more recent) lessons so the trend line slopes upward.
    const finalPostPct = clamp(0.5 + s.skill * 0.45 + L * 0.008 + rand() * 0.08, 0.45, 1.0);

    // Retakes: weaker students retake more before reaching their final score.
    let nAtt;
    if (s.skill > 0.85) nAtt = rand() < 0.85 ? 1 : 2;
    else if (s.skill > 0.65) nAtt = rand() < 0.6 ? 1 : 2;
    else if (s.skill > 0.5) nAtt = randInt(1, 2) + (rand() < 0.3 ? 1 : 0);
    else nAtt = randInt(2, 3);

    // The student's most recent lesson is ~stagger days ago; earlier lessons
    // step further back (~5 days each) so activity spans weeks/months.
    const baseDayAgo = (count - 1 - L) * 5 + s.stagger + randInt(0, 2);

    let lastRow = null;
    for (let i = 0; i < nAtt; i++) {
      // Earlier attempts score lower; final attempt hits finalPostPct.
      const stepDown = (nAtt - 1 - i) * 0.12;
      const postPct = clamp(finalPostPct - stepDown, 0.1, 1.0);
      const scorePost = clamp(Math.round(postPct * POST_TOTAL), 0, POST_TOTAL);
      // Pre-test nudges up slightly on retakes (they've seen the material).
      const scorePreAttempt = clamp(scorePre + (i > 0 ? randInt(0, 1) : 0), 0, PRE_TOTAL);
      // Final attempt is most recent; earlier attempts a few days before it.
      const dayAgo = baseDayAgo + (nAtt - 1 - i) * 2 + 1;
      const completedAt = dateDaysAgo(Math.max(0, dayAgo));

      const row = {
        user_id: userId,
        lesson_id: lessonId,
        score_pre: scorePreAttempt,
        score_pre_total: PRE_TOTAL,
        score_post: scorePost,
        score_post_total: POST_TOTAL,
        completed_at: completedAt,
      };
      attempts.push(row);
      if (!lastRow || row.completed_at > lastRow.completed_at) lastRow = row;
    }

    // Snapshot = latest attempt + total attempt count for this lesson.
    snapshots.push({
      user_id: userId,
      lesson_id: lessonId,
      status: "completed",
      score_pre: lastRow.score_pre,
      score_pre_total: PRE_TOTAL,
      score_post: lastRow.score_post,
      score_post_total: POST_TOTAL,
      attempts: nAtt,
      updated_at: lastRow.completed_at,
    });
  }

  return { attempts, snapshots };
}

/** Inserts rows in chunks to stay within payload limits. */
async function insertChunked(table, rows, chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await admin.from(table).insert(slice);
    if (error) throw new Error(`insert ${table} failed: ${error.message}`);
  }
}

async function main() {
  console.log(`\n🌱 Seeding demo analytics for ${ADMIN_EMAIL} …\n`);

  // ── 1. Admin user + profile ──────────────────────────────────────────────
  const adminId = await ensureAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  const { error: adminProfileErr } = await admin.from("profiles").upsert(
    { id: adminId, first_name: ADMIN_FIRST, last_name: ADMIN_LAST, group_name: ORG_NAME, role: "org_admin" },
    { onConflict: "id" }
  );
  if (adminProfileErr) throw new Error(`Admin profile upsert failed: ${adminProfileErr.message}`);
  console.log(`✓ Admin ready (${ADMIN_EMAIL}).`);

  // ── 2. Organization ──────────────────────────────────────────────────────
  let orgId;
  const { data: org } = await admin
    .from("organizations")
    .select("id, total_seats")
    .eq("admin_id", adminId)
    .maybeSingle();

  if (org) {
    orgId = org.id;
    await admin
      .from("organizations")
      .update({ name: ORG_NAME, subscription_status: "active", total_seats: Math.max(org.total_seats ?? 0, TOTAL_SEATS) })
      .eq("id", orgId);
  } else {
    const { data: inserted, error } = await admin
      .from("organizations")
      .insert({ admin_id: adminId, name: ORG_NAME, total_seats: TOTAL_SEATS, used_seats: 0, subscription_status: "active" })
      .select("id")
      .single();
    if (error) throw new Error(`Org insert failed: ${error.message}`);
    orgId = inserted.id;
  }
  console.log(`✓ Organization "${ORG_NAME}" (${orgId}).`);

  // ── 3. Resolve a bundle for the licenses (full-access preferred) ──────────
  let bundle = null;
  const { data: b1 } = await admin.from("course_bundles").select("id, name").ilike("name", BUNDLE_NAME).maybeSingle();
  bundle = b1;
  if (!bundle) {
    const { data: b2 } = await admin
      .from("course_bundles")
      .select("id, name")
      .eq("bundle_type", "student")
      .limit(1)
      .maybeSingle();
    bundle = b2;
  }
  if (bundle) console.log(`✓ Assigning bundle "${bundle.name}".`);
  else console.warn("⚠ No course_bundles found — licenses will have null bundle_id (analytics still works).");

  // ── 4. Purchases row (populates seat-summary / invite UI) ────────────────
  if (bundle) {
    const { data: prior } = await admin
      .from("purchases")
      .select("id")
      .eq("stripe_payment_id", OFFLINE_MARKER)
      .maybeSingle();
    if (!prior) {
      await admin.from("purchases").insert({
        org_id: orgId,
        bundle_id: bundle.id,
        seats_purchased: TOTAL_SEATS,
        amount_paid: 0,
        stripe_payment_id: OFFLINE_MARKER,
      });
      console.log(`✓ Recorded demo purchase of ${TOTAL_SEATS} seats.`);
    } else {
      console.log("• Demo purchase already present (idempotent).");
    }
  }

  // ── 5. Students: auth users + profiles + licenses ────────────────────────
  const expiresAt = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 8); // academic-year style expiry
    return d.toISOString();
  })();

  const studentIds = [];
  for (const s of STUDENTS) {
    const email = `${s.first}.${s.last}`.toLowerCase().replace(/[^a-z.]/g, "") + `@${STUDENT_EMAIL_DOMAIN}`;
    const userId = await ensureAuthUser(email, STUDENT_PASSWORD);
    studentIds.push({ ...s, userId, email });

    const { error: pErr } = await admin.from("profiles").upsert(
      { id: userId, first_name: s.first, last_name: s.last, group_name: ORG_NAME, role: "student" },
      { onConflict: "id" }
    );
    if (pErr) throw new Error(`Profile upsert (${email}) failed: ${pErr.message}`);

    // License: insert only if this student has none in this org yet.
    const { data: existingLic } = await admin
      .from("licenses")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingLic) {
      const { error: lErr } = await admin.from("licenses").insert({
        org_id: orgId,
        student_email: email,
        course_type: bundle?.name ?? "Advanced Financial Education",
        is_active: true,
        user_id: userId,
        bundle_id: bundle?.id ?? null,
        expires_at: expiresAt,
        subscription_type: "academic_year",
      });
      if (lErr) throw new Error(`License insert (${email}) failed: ${lErr.message}`);
    }
  }
  console.log(`✓ ${studentIds.length} students provisioned (profiles + licenses).`);

  // Keep used_seats in sync with assigned licenses.
  const { count: licCount } = await admin
    .from("licenses")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  await admin.from("organizations").update({ used_seats: licCount ?? studentIds.length }).eq("id", orgId);

  // ── 6. Clear prior attempts/progress for this cohort, then re-seed ────────
  const ids = studentIds.map((s) => s.userId);
  await admin.from("lesson_attempts").delete().in("user_id", ids);
  await admin.from("user_progress").delete().in("user_id", ids);

  let allAttempts = [];
  let allSnapshots = [];
  for (const s of studentIds) {
    const { attempts, snapshots } = buildStudentData(s.userId, s);
    allAttempts = allAttempts.concat(attempts);
    allSnapshots = allSnapshots.concat(snapshots);
  }

  await insertChunked("lesson_attempts", allAttempts);
  await insertChunked("user_progress", allSnapshots);

  // ── 7. Summary ───────────────────────────────────────────────────────────
  const distinctLessons = new Set(allAttempts.map((a) => a.lesson_id)).size;
  const distinctDays = new Set(allAttempts.map((a) => a.completed_at.slice(0, 10))).size;
  console.log("\n── Seed complete ──────────────────────────────────────────");
  console.log(`  Students:        ${studentIds.length}`);
  console.log(`  Lesson attempts: ${allAttempts.length}  (across ${distinctLessons} lessons, ${distinctDays} distinct days)`);
  console.log(`  Progress rows:   ${allSnapshots.length}`);
  console.log("\n── Admin demo login ───────────────────────────────────────");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log("  → /login → /admin-dashboard → Reports & Analytics tab\n");
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message);
  process.exit(1);
});
