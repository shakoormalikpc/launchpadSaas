-- Fix RLS on licenses table so students can read their own license row
-- Error observed: 403 Forbidden on GET licenses?select=org_id&student_email=eq...

-- 1. Ensure RLS is enabled on the licenses table
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- 2. Drop the policy first if it already exists (idempotent re-run)
DROP POLICY IF EXISTS "Students can read their own license" ON public.licenses;

-- 3. Add SELECT policy for authenticated students to read their own license
CREATE POLICY "Students can read their own license"
  ON public.licenses
  FOR SELECT
  TO authenticated
  USING (
    student_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );
