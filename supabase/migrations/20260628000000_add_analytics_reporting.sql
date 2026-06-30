-- ============================================================================
-- Reporting & Analytics upgrade
-- ----------------------------------------------------------------------------
-- Captures the data the admin dashboard needs for grantor-ready reports:
--   • pre-test scores (previously discarded — only post-test was persisted)
--   • retake / attempt counts (previously overwritten by the upsert)
-- plus a server-side, filterable analytics RPC.
--
-- Data is captured FORWARD ONLY: lessons completed before this migration have
-- no pre-test / per-attempt history (that data was never stored).
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. Extend user_progress with pre-test + attempt columns ─────────────────
-- user_progress already has a (user_id, lesson_id) unique constraint used by the
-- existing upsert; we keep one "latest snapshot" row per lesson and add:
--   score_pre / score_pre_total — the student's most recent pre-test result
--   attempts                    — how many times they've completed this lesson
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS score_pre       int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_pre_total int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempts        int DEFAULT 1;

-- ── 2. Per-attempt history table ────────────────────────────────────────────
-- One row per completed attempt — the source of truth for growth trends and
-- retake analysis over a date range. user_progress only keeps the latest row.
CREATE TABLE IF NOT EXISTS public.lesson_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id        text NOT NULL,
  score_pre        int  NOT NULL DEFAULT 0,
  score_pre_total  int  NOT NULL DEFAULT 0,
  score_post       int  NOT NULL DEFAULT 0,
  score_post_total int  NOT NULL DEFAULT 0,
  completed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_attempts_user        ON public.lesson_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_attempts_lesson      ON public.lesson_attempts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_attempts_completed   ON public.lesson_attempts(completed_at);

ALTER TABLE public.lesson_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own attempts" ON public.lesson_attempts;
CREATE POLICY "Users insert own attempts"
  ON public.lesson_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own attempts" ON public.lesson_attempts;
CREATE POLICY "Users read own attempts"
  ON public.lesson_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- Admins read attempt data only through get_org_analytics (SECURITY DEFINER),
-- so no broad admin SELECT policy is needed here.

-- ── 3. record_lesson_attempt RPC ────────────────────────────────────────────
-- Atomically records one completed attempt: appends to lesson_attempts, then
-- upserts the user_progress snapshot with the recomputed attempt count.
-- Returns the new total attempt count for this lesson.
CREATE OR REPLACE FUNCTION public.record_lesson_attempt(
  p_lesson_id        text,
  p_score_pre        int,
  p_score_pre_total  int,
  p_score_post       int,
  p_score_post_total int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_attempts int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.lesson_attempts (
    user_id, lesson_id, score_pre, score_pre_total, score_post, score_post_total
  )
  VALUES (
    v_user, p_lesson_id,
    COALESCE(p_score_pre, 0), COALESCE(p_score_pre_total, 0),
    COALESCE(p_score_post, 0), COALESCE(p_score_post_total, 0)
  );

  SELECT count(*) INTO v_attempts
  FROM public.lesson_attempts
  WHERE user_id = v_user AND lesson_id = p_lesson_id;

  INSERT INTO public.user_progress (
    user_id, lesson_id, status,
    score_pre, score_pre_total, score_post, score_post_total,
    attempts, updated_at
  )
  VALUES (
    v_user, p_lesson_id, 'completed',
    COALESCE(p_score_pre, 0), COALESCE(p_score_pre_total, 0),
    COALESCE(p_score_post, 0), COALESCE(p_score_post_total, 0),
    v_attempts, now()
  )
  ON CONFLICT (user_id, lesson_id) DO UPDATE
  SET status           = 'completed',
      score_pre        = EXCLUDED.score_pre,
      score_pre_total  = EXCLUDED.score_pre_total,
      score_post       = EXCLUDED.score_post,
      score_post_total = EXCLUDED.score_post_total,
      attempts         = EXCLUDED.attempts,
      updated_at       = now();

  RETURN v_attempts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_lesson_attempt(text, int, int, int, int) TO authenticated;

-- ── 4. get_org_analytics RPC ────────────────────────────────────────────────
-- Returns a single JSONB analytics payload for the calling admin's org,
-- filterable by date range, a single lesson, and/or a single student.
-- All metrics are computed over the lesson_attempts table so growth and retake
-- figures respect the date range. Authorization: caller must be the org admin.
--
-- Shape:
-- {
--   "totals":      { students, activeStudents, attempts, lessonsCompleted,
--                    avgPrePct, avgPostPct, avgGrowthPct, avgAttemptsPerLesson },
--   "perLesson":   [ { lessonId, attempts, students, avgPrePct, avgPostPct,
--                      growthPct, avgAttempts } ],
--   "leaderboard": [ { userId, name, email, lessonsCompleted, avgPostPct,
--                      avgGrowthPct, totalAttempts } ],   -- sorted desc by avgPostPct
--   "students":    [ { userId, name, email, lessonsCompleted, avgPrePct,
--                      avgPostPct, growthPct, totalAttempts, lastActivity } ],
--   "trend":       [ { date, avgPostPct, completions } ]  -- per day, ascending
-- }
CREATE OR REPLACE FUNCTION public.get_org_analytics(
  org_id_param      uuid,
  date_from         timestamptz DEFAULT NULL,
  date_to           timestamptz DEFAULT NULL,
  lesson_id_param   text        DEFAULT NULL,
  student_id_param  uuid        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id_param AND admin_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this organization';
  END IF;

  WITH org_students AS (
    SELECT DISTINCT ON (l.user_id)
           l.user_id,
           l.student_email AS email,
           NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), '') AS name
    FROM public.licenses l
    LEFT JOIN public.profiles p ON p.id = l.user_id
    WHERE l.org_id = org_id_param
      AND l.user_id IS NOT NULL
    ORDER BY l.user_id
  ),
  att AS (
    SELECT a.user_id,
           a.lesson_id,
           a.completed_at,
           CASE WHEN a.score_pre_total  > 0
                THEN a.score_pre::numeric  / a.score_pre_total  * 100 END AS pre_pct,
           CASE WHEN a.score_post_total > 0
                THEN a.score_post::numeric / a.score_post_total * 100 END AS post_pct
    FROM public.lesson_attempts a
    JOIN org_students s ON s.user_id = a.user_id
    WHERE (date_from        IS NULL OR a.completed_at >= date_from)
      AND (date_to          IS NULL OR a.completed_at <= date_to)
      AND (lesson_id_param  IS NULL OR a.lesson_id = lesson_id_param)
      AND (student_id_param IS NULL OR a.user_id  = student_id_param)
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'students',             (SELECT count(*) FROM org_students),
        'activeStudents',       (SELECT count(DISTINCT user_id) FROM att),
        'attempts',             (SELECT count(*) FROM att),
        'lessonsCompleted',     (SELECT count(DISTINCT (user_id, lesson_id)) FROM att),
        'avgPrePct',            (SELECT round(avg(pre_pct), 1) FROM att),
        'avgPostPct',           (SELECT round(avg(post_pct), 1) FROM att),
        'avgGrowthPct',         (SELECT round(avg(post_pct - pre_pct), 1) FROM att),
        'avgAttemptsPerLesson', (SELECT round(count(*)::numeric
                                   / NULLIF(count(DISTINCT (user_id, lesson_id)), 0), 2) FROM att)
      )
    ),
    'perLesson', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'lessonId'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'lessonId',    lesson_id,
          'attempts',    count(*),
          'students',    count(DISTINCT user_id),
          'avgPrePct',   round(avg(pre_pct), 1),
          'avgPostPct',  round(avg(post_pct), 1),
          'growthPct',   round(avg(post_pct - pre_pct), 1),
          'avgAttempts', round(count(*)::numeric / NULLIF(count(DISTINCT user_id), 0), 2)
        ) AS x
        FROM att
        GROUP BY lesson_id
      ) t
    ),
    'leaderboard', (
      SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'avgPostPct')::numeric DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'userId',           a.user_id,
          'name',             s.name,
          'email',            s.email,
          'lessonsCompleted', count(DISTINCT a.lesson_id),
          'avgPostPct',       round(avg(a.post_pct), 1),
          'avgGrowthPct',     round(avg(a.post_pct - a.pre_pct), 1),
          'totalAttempts',    count(*)
        ) AS x
        FROM att a
        JOIN org_students s ON s.user_id = a.user_id
        GROUP BY a.user_id, s.name, s.email
      ) t
    ),
    'students', (
      SELECT COALESCE(jsonb_agg(x ORDER BY lower(coalesce(x->>'name', x->>'email'))), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'userId',           a.user_id,
          'name',             s.name,
          'email',            s.email,
          'lessonsCompleted', count(DISTINCT a.lesson_id),
          'avgPrePct',        round(avg(a.pre_pct), 1),
          'avgPostPct',       round(avg(a.post_pct), 1),
          'growthPct',        round(avg(a.post_pct - a.pre_pct), 1),
          'totalAttempts',    count(*),
          'lastActivity',     max(a.completed_at)
        ) AS x
        FROM att a
        JOIN org_students s ON s.user_id = a.user_id
        GROUP BY a.user_id, s.name, s.email
      ) t
    ),
    'trend', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'date'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'date',        to_char(date_trunc('day', completed_at), 'YYYY-MM-DD'),
          'avgPostPct',  round(avg(post_pct), 1),
          'completions', count(*)
        ) AS x
        FROM att
        GROUP BY date_trunc('day', completed_at)
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_analytics(uuid, timestamptz, timestamptz, text, uuid) TO authenticated;
