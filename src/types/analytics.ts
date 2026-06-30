/**
 * Types for the admin Reporting & Analytics feature.
 * Mirrors the JSONB payload returned by the `get_org_analytics` Postgres RPC.
 */

/** Numeric metrics may be null when no attempts match the active filters. */
export type Nullable<T> = T | null;

/** Headline metrics across all attempts matching the active filters. */
export interface AnalyticsTotals {
  /** Total students assigned a seat in the org. */
  students: number;
  /** Students with at least one attempt in range. */
  activeStudents: number;
  /** Total completed attempts in range. */
  attempts: number;
  /** Distinct (student, lesson) pairs completed in range. */
  lessonsCompleted: number;
  avgPrePct: Nullable<number>;
  avgPostPct: Nullable<number>;
  avgGrowthPct: Nullable<number>;
  avgAttemptsPerLesson: Nullable<number>;
}

/** Aggregated performance for a single lesson. */
export interface LessonAnalytics {
  lessonId: string;
  attempts: number;
  students: number;
  avgPrePct: Nullable<number>;
  avgPostPct: Nullable<number>;
  growthPct: Nullable<number>;
  avgAttempts: Nullable<number>;
}

/** A row in the Top Performers leaderboard. */
export interface LeaderboardEntry {
  userId: string;
  name: Nullable<string>;
  email: string;
  lessonsCompleted: number;
  avgPostPct: Nullable<number>;
  avgGrowthPct: Nullable<number>;
  totalAttempts: number;
}

/** Per-student rollup used by the student filter / directory. */
export interface StudentAnalytics {
  userId: string;
  name: Nullable<string>;
  email: string;
  lessonsCompleted: number;
  avgPrePct: Nullable<number>;
  avgPostPct: Nullable<number>;
  growthPct: Nullable<number>;
  totalAttempts: number;
  lastActivity: Nullable<string>;
}

/** One day on the performance-over-time trend line. */
export interface TrendPoint {
  date: string;
  avgPostPct: Nullable<number>;
  completions: number;
}

/** Full analytics payload returned by `get_org_analytics`. */
export interface OrgAnalytics {
  totals: AnalyticsTotals;
  perLesson: LessonAnalytics[];
  leaderboard: LeaderboardEntry[];
  students: StudentAnalytics[];
  trend: TrendPoint[];
}

/** Active report filters. `null` means "no filter" for that dimension. */
export interface AnalyticsFilters {
  /** ISO timestamp lower bound (inclusive). */
  dateFrom: string | null;
  /** ISO timestamp upper bound (inclusive). */
  dateTo: string | null;
  /** Restrict to a single lesson id, or null for all lessons. */
  lessonId: string | null;
  /** Restrict to a single student (auth user id), or null for all students. */
  studentId: string | null;
}
