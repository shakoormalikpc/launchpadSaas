import type { AnalyticsFilters, OrgAnalytics } from "@/types/analytics";
import { getLessonName } from "@/utils/lessonNames";

/** Formats a percentage value, or "—" when null. */
const pct = (v: number | null): string => (v === null ? "—" : `${v}%`);

/** Formats a signed growth value (e.g. "+12%"). */
const signedPct = (v: number | null): string =>
  v === null ? "—" : `${v >= 0 ? "+" : ""}${v}%`;

/** Renders the active date range as a human phrase for the summary header. */
const formatRange = (filters: AnalyticsFilters): string => {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const from = filters.dateFrom ? new Date(filters.dateFrom).toLocaleDateString("en-US", opts) : null;
  const to = filters.dateTo ? new Date(filters.dateTo).toLocaleDateString("en-US", opts) : null;
  if (from && to) return `${from} – ${to}`;
  if (from) return `since ${from}`;
  if (to) return `through ${to}`;
  return "all time";
};

/**
 * Generates a grantor-ready, plain-text summary of the analytics payload under
 * the active filters. Designed to be presented directly to funders.
 * @param analytics - The analytics payload from get_org_analytics.
 * @param filters - The filters that produced this payload (for context).
 * @param orgName - The organization name, used in the opening sentence.
 * @returns A multi-paragraph summary string.
 */
export const generateAnalyticsSummary = (
  analytics: OrgAnalytics,
  filters: AnalyticsFilters,
  orgName: string
): string => {
  const { totals, perLesson, leaderboard } = analytics;
  const lines: string[] = [];

  const org = orgName?.trim() || "The organization";
  const range = formatRange(filters);

  if (totals.attempts === 0) {
    return `No lesson activity was recorded for ${org} (${range}). As students complete lessons, growth and performance metrics will appear here.`;
  }

  const lessonScope = filters.lessonId ? `the "${getLessonName(filters.lessonId)}" lesson` : "the program";

  // ── Headline ──────────────────────────────────────────────────────────────
  lines.push(
    `Over ${range}, ${totals.activeStudents} of ${totals.students} enrolled student${
      totals.students === 1 ? "" : "s"
    } actively engaged with ${lessonScope}, completing ${totals.attempts} lesson attempt${
      totals.attempts === 1 ? "" : "s"
    } across ${totals.lessonsCompleted} lesson completion${totals.lessonsCompleted === 1 ? "" : "s"}.`
  );

  // ── Growth ──────────────────────────────────────────────────────────────
  if (totals.avgGrowthPct !== null && totals.avgPrePct !== null && totals.avgPostPct !== null) {
    const direction = totals.avgGrowthPct >= 0 ? "improved" : "declined";
    lines.push(
      `On average, students ${direction} from a pre-test score of ${pct(totals.avgPrePct)} to a post-test score of ${pct(
        totals.avgPostPct
      )} — an average knowledge gain of ${signedPct(totals.avgGrowthPct)}.`
    );
  } else if (totals.avgPostPct !== null) {
    lines.push(`Students achieved an average post-test score of ${pct(totals.avgPostPct)}.`);
  }

  // ── Retakes / persistence ──────────────────────────────────────────────────
  if (totals.avgAttemptsPerLesson !== null) {
    lines.push(
      `Students attempted each lesson an average of ${totals.avgAttemptsPerLesson} time${
        totals.avgAttemptsPerLesson === 1 ? "" : "s"
      }, reflecting their persistence in reaching mastery.`
    );
  }

  // ── Standout lesson ─────────────────────────────────────────────────────────
  const lessonsWithGrowth = perLesson.filter((l) => l.growthPct !== null);
  if (lessonsWithGrowth.length > 0) {
    const best = [...lessonsWithGrowth].sort((a, b) => (b.growthPct ?? 0) - (a.growthPct ?? 0))[0];
    lines.push(
      `The strongest gains were in "${getLessonName(best.lessonId)}", where the class average rose ${signedPct(
        best.growthPct
      )} (from ${pct(best.avgPrePct)} to ${pct(best.avgPostPct)}).`
    );
  }

  // ── Top performer ───────────────────────────────────────────────────────────
  if (leaderboard.length > 0) {
    const top = leaderboard[0];
    const who = top.name || top.email;
    lines.push(
      `The top-performing student, ${who}, completed ${top.lessonsCompleted} lesson${
        top.lessonsCompleted === 1 ? "" : "s"
      } with an average post-test score of ${pct(top.avgPostPct)}.`
    );
  }

  return lines.join(" ");
};
