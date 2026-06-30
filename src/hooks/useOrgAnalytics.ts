import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AnalyticsFilters, OrgAnalytics } from "@/types/analytics";

/** Empty payload used as a stable fallback before data loads. */
const EMPTY_ANALYTICS: OrgAnalytics = {
  totals: {
    students: 0,
    activeStudents: 0,
    attempts: 0,
    lessonsCompleted: 0,
    avgPrePct: null,
    avgPostPct: null,
    avgGrowthPct: null,
    avgAttemptsPerLesson: null,
  },
  perLesson: [],
  leaderboard: [],
  students: [],
  trend: [],
};

/**
 * Fetches filterable analytics for an organization via the `get_org_analytics`
 * RPC. Results are cached per (orgId + filters) by TanStack Query and refetched
 * whenever a filter changes.
 * @param orgId - The organization's UUID, or null until it has loaded.
 * @param filters - Active date-range / lesson / student filters.
 * @returns The analytics payload plus query status helpers.
 */
export const useOrgAnalytics = (orgId: string | null, filters: AnalyticsFilters) => {
  const query = useQuery({
    queryKey: ["org-analytics", orgId, filters],
    enabled: !!orgId,
    queryFn: async (): Promise<OrgAnalytics> => {
      const { data, error } = await (supabase as any).rpc("get_org_analytics", {
        org_id_param: orgId,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        lesson_id_param: filters.lessonId,
        student_id_param: filters.studentId,
      });

      if (error) throw error;
      return (data as OrgAnalytics) ?? EMPTY_ANALYTICS;
    },
  });

  return {
    analytics: query.data ?? EMPTY_ANALYTICS,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
};
