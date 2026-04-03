import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ALL_LESSON_IDS = [
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

const BUNDLE_LESSONS: Record<string, string[]> = {
  "Money Management Fundamentals": [
    "earning-money",
    "living-on-your-own",
    "understanding-wants-needs",
    "saving-investing",
  ],
  "Personal Finance Essentials": [
    "earning-money",
    "living-on-your-own",
    "understanding-wants-needs",
    "saving-investing",
    "influence-of-advertising",
    "cost-of-college",
    "protecting-insuring",
    "art-of-budgeting",
  ],
  "Advanced Financial Education": ALL_LESSON_IDS,
};

interface UseStudentBundleResult {
  allowedLessonIds: string[];
  bundleName: string | null;
  loading: boolean;
}

/**
 * Fetches the student's active license and resolves which lessons they are
 * allowed to access based on their bundle.
 *
 * Org admins and users with no license get access to all 14 lessons.
 *
 * @param studentEmail - The authenticated user's email address.
 * @param role - The user's profile role (e.g. "student" or "org_admin").
 * @returns Allowed lesson IDs, the bundle name, and a loading flag.
 */
export function useStudentBundle(
  studentEmail: string | null | undefined,
  role: string | null | undefined
): UseStudentBundleResult {
  const [allowedLessonIds, setAllowedLessonIds] = useState<string[]>(ALL_LESSON_IDS);
  const [bundleName, setBundleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Org admins always see all lessons; no fetch needed.
    if (role === "org_admin") {
      setAllowedLessonIds(ALL_LESSON_IDS);
      setLoading(false);
      return;
    }

    if (!studentEmail) {
      setAllowedLessonIds(ALL_LESSON_IDS);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchBundle = async () => {
      setLoading(true);

      const { data: license, error: licErr } = await supabase
        .from("licenses")
        .select("bundle_id")
        .eq("student_email", studentEmail)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (licErr || !license?.bundle_id) {
        // No license found – grant all lessons so the user isn't blocked.
        setAllowedLessonIds(ALL_LESSON_IDS);
        setLoading(false);
        return;
      }

      const { data: bundle, error: bundleErr } = await supabase
        .from("course_bundles")
        .select("name")
        .eq("id", license.bundle_id)
        .maybeSingle();

      if (cancelled) return;

      if (bundleErr || !bundle?.name) {
        setAllowedLessonIds(ALL_LESSON_IDS);
        setLoading(false);
        return;
      }

      const name = bundle.name as string;
      setBundleName(name);
      setAllowedLessonIds(BUNDLE_LESSONS[name] ?? ALL_LESSON_IDS);
      setLoading(false);
    };

    fetchBundle();

    return () => {
      cancelled = true;
    };
  }, [studentEmail, role]);

  return { allowedLessonIds, bundleName, loading };
}
