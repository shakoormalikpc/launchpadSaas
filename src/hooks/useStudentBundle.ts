import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Sentinel stored in profiles.group_name to identify demo accounts.
// Must match the value written in DemoSignUp.tsx.
const DEMO_GROUP_NAME = "__demo__";

const DEMO_LESSON_IDS = [
  "earning-money",
  "living-on-your-own",
  "understanding-wants-needs",
];

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
  isExpired: boolean;
}

/**
 * Fetches the student's active license and resolves which lessons they are
 * allowed to access based on their bundle.
 *
 * Demo accounts (group_name === DEMO_GROUP_NAME) get the first 3 lessons.
 * Org admins and users with no license get access to all 14 lessons.
 *
 * @param studentEmail - The authenticated user's email address.
 * @param role - The user's profile role (e.g. "student" or "org_admin").
 * @param groupName - The user's group_name from their profile.
 * @returns Allowed lesson IDs, the bundle name, and a loading flag.
 */
export function useStudentBundle(
  studentEmail: string | null | undefined,
  role: string | null | undefined,
  groupName: string | null | undefined
): UseStudentBundleResult {
  const [allowedLessonIds, setAllowedLessonIds] = useState<string[]>(ALL_LESSON_IDS);
  const [bundleName, setBundleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Demo accounts get first 3 lessons only.
    if (groupName === DEMO_GROUP_NAME) {
      setAllowedLessonIds(DEMO_LESSON_IDS);
      setBundleName("Demo");
      setIsExpired(false);
      setLoading(false);
      return;
    }

    // Org admins always see all lessons; no fetch needed.
    if (role === "org_admin") {
      setAllowedLessonIds(ALL_LESSON_IDS);
      setIsExpired(false);
      setLoading(false);
      return;
    }

    if (!studentEmail) {
      setAllowedLessonIds(ALL_LESSON_IDS);
      setIsExpired(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchBundle = async () => {
      setLoading(true);

      const { data: license, error: licErr } = await supabase
        .from("licenses")
        .select("bundle_id, expires_at")
        .eq("student_email", studentEmail)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (licErr || !license?.bundle_id) {
        // No license found – grant all lessons so the user isn't blocked.
        setAllowedLessonIds(ALL_LESSON_IDS);
        setIsExpired(false);
        setLoading(false);
        return;
      }

      // If expires_at is set and in the past, lock all lessons.
      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        setAllowedLessonIds([]);
        setIsExpired(true);
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
        setIsExpired(false);
        setLoading(false);
        return;
      }

      const name = bundle.name as string;
      setBundleName(name);
      setAllowedLessonIds(BUNDLE_LESSONS[name] ?? ALL_LESSON_IDS);
      setIsExpired(false);
      setLoading(false);
    };

    fetchBundle();

    return () => {
      cancelled = true;
    };
  }, [studentEmail, role, groupName]);

  return { allowedLessonIds, bundleName, loading, isExpired };
}
