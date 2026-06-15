import { useMemo, useState } from "react";
import { Award, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CertificateModal,
  type CertificateStudent,
} from "@/components/admin/CertificateModal";
import { DEMO_LESSON_IDS } from "@/hooks/useStudentBundle";
import type { LessonProgress } from "@/hooks/useProgressTracking";

/** Minimum average score (%) required to earn the certificate. */
const PASS_THRESHOLD = 80;

interface Props {
  /** The authenticated user's email address. */
  email: string | null | undefined;
  /** The user's first name from their profile. */
  firstName: string | null | undefined;
  /** The user's last name from their profile. */
  lastName: string | null | undefined;
  /** All completed lessons for the user (from useProgressTracking). */
  lessonsCompleted: LessonProgress[];
  /** Visual style: "card" for the dashboard, "banner" for the lesson menu. */
  variant?: "card" | "banner";
}

/**
 * Self-service completion certificate for demo accounts. The learner can
 * generate and download their own certificate once all demo lessons are
 * complete — no admin involvement required. Reuses the shared CertificateModal.
 *
 * @param email - The learner's email address.
 * @param firstName - The learner's first name.
 * @param lastName - The learner's last name.
 * @param lessonsCompleted - The learner's completed-lesson progress records.
 * @param variant - Whether to render as a dashboard card or a menu banner.
 * @returns The rendered certificate prompt plus its modal, or a locked state.
 */
export function DemoCertificate({
  email,
  firstName,
  lastName,
  lessonsCompleted,
  variant = "card",
}: Props) {
  const [open, setOpen] = useState(false);

  // Only the demo lessons that have actually been completed.
  const completedDemoLessons = useMemo(
    () =>
      lessonsCompleted.filter(
        (l) => l.completed && DEMO_LESSON_IDS.includes(l.lessonId)
      ),
    [lessonsCompleted]
  );

  const allLessonsDone = completedDemoLessons.length >= DEMO_LESSON_IDS.length;

  /**
   * Per-lesson score as a percentage (correct / total).
   * @param l - A completed lesson progress record.
   * @returns The lesson's score percentage, or 0 if it has no questions.
   */
  const lessonPct = (l: LessonProgress): number =>
    l.postTestTotal > 0
      ? Math.round((l.postTestScore / l.postTestTotal) * 100)
      : 0;

  // Demo lessons that are completed but scored below the passing threshold.
  const lessonsBelowThreshold = useMemo(
    () => completedDemoLessons.filter((l) => lessonPct(l) < PASS_THRESHOLD),
    [completedDemoLessons]
  );

  // Weighted average score across the demo lessons (correct / total) — for the
  // certificate display only; it is NOT used to gate access.
  const averageScore = useMemo(() => {
    const totalCorrect = completedDemoLessons.reduce(
      (sum, l) => sum + (l.postTestScore || 0),
      0
    );
    const totalQuestions = completedDemoLessons.reduce(
      (sum, l) => sum + (l.postTestTotal || 0),
      0
    );
    return totalQuestions > 0
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0;
  }, [completedDemoLessons]);

  // Certificate unlocks only when EVERY demo lesson is done AND each one
  // individually meets the passing threshold (not just the overall average).
  const allPassed = allLessonsDone && lessonsBelowThreshold.length === 0;
  const isComplete = allPassed;
  // Finished all lessons but at least one is below the passing score.
  const failedAfterCompletion = allLessonsDone && lessonsBelowThreshold.length > 0;

  // Most recent completion date drives the "Issued on" date.
  const lastActivity = useMemo(() => {
    const dates = completedDemoLessons
      .map((l) => l.completedAt)
      .filter((d): d is string => Boolean(d))
      .sort();
    return dates.length > 0 ? dates[dates.length - 1] : null;
  }, [completedDemoLessons]);

  const certStudent: CertificateStudent = {
    student_email: email ?? "",
    student_first_name: firstName ?? "",
    student_last_name: lastName ?? "",
    bundle_name: "Demo",
    lessons_completed: DEMO_LESSON_IDS.length,
    total_lessons: DEMO_LESSON_IDS.length,
    average_score: averageScore,
    last_activity: lastActivity,
  };

  const progressLabel = `${completedDemoLessons.length} / ${DEMO_LESSON_IDS.length} demo lessons completed`;

  // Sub-text shown beneath the title, depending on the learner's state.
  const belowCount = lessonsBelowThreshold.length;
  const lockedHint = failedAfterCompletion
    ? `${belowCount} lesson${belowCount === 1 ? "" : "s"} below ${PASS_THRESHOLD}%. Score at least ${PASS_THRESHOLD}% on every lesson to unlock your certificate — retake to raise your score.`
    : `${progressLabel}.`;

  return (
    <>
      {variant === "banner" ? (
        <div
          className={`w-full max-w-lg mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${
            isComplete
              ? "border-primary/40 bg-primary/10"
              : "border-border bg-muted/30"
          }`}
        >
          {isComplete ? (
            <Award className="h-5 w-5 text-primary shrink-0" />
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold ${
                isComplete ? "text-primary" : "text-foreground"
              }`}
            >
              {isComplete
                ? "You've completed the demo! 🎉"
                : "Certificate of Completion"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isComplete
                ? "Generate and download your certificate."
                : lockedHint}
            </p>
          </div>
          <Button
            size="sm"
            disabled={!isComplete}
            onClick={() => setOpen(true)}
            className="shrink-0 gap-1.5"
          >
            <Award className="h-4 w-4" />
            Generate
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-2xl mb-8 rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isComplete ? "bg-primary/10" : "bg-muted"
            }`}
          >
            {isComplete ? (
              <Award className="h-6 w-6 text-primary" />
            ) : (
              <Lock className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              Certificate of Completion
            </p>
            <p className="text-sm text-muted-foreground">
              {isComplete
                ? "Congratulations — your certificate is ready to download."
                : failedAfterCompletion
                  ? lockedHint
                  : `Finish all demo lessons with ${PASS_THRESHOLD}%+ on each to unlock. ${progressLabel}.`}
            </p>
          </div>
          <Button
            disabled={!isComplete}
            onClick={() => setOpen(true)}
            className="shrink-0 gap-2"
          >
            <Award className="h-4 w-4" />
            {isComplete ? "Generate Certificate" : "Locked"}
          </Button>
        </div>
      )}

      <CertificateModal
        open={open}
        onClose={() => setOpen(false)}
        student={certStudent}
        orgName="LaunchPad Money Mentor"
        adminName="LaunchPad Team"
      />
    </>
  );
}
