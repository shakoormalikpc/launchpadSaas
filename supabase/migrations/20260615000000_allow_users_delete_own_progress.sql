-- Allow students to reset their own lesson progress.
-- Symptom: "Reset Progress" silently failed — the DELETE returned no error but
-- removed 0 rows because no RLS DELETE policy existed, so the row survived and
-- the lesson reappeared on the next refetch.

-- ── user_progress ─────────────────────────────────────────────────────────
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete their own progress" ON public.user_progress;

CREATE POLICY "Users can delete their own progress"
  ON public.user_progress
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── lesson_states ─────────────────────────────────────────────────────────
ALTER TABLE public.lesson_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete their own lesson state" ON public.lesson_states;

CREATE POLICY "Users can delete their own lesson state"
  ON public.lesson_states
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
