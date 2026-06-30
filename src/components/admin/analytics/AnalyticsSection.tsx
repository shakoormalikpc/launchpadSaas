import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Users, Repeat2, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useOrgAnalytics } from "@/hooks/useOrgAnalytics";
import { generateAnalyticsSummary } from "@/lib/analyticsSummary";
import { exportAnalyticsToExcel, exportAnalyticsToPDF } from "@/lib/analyticsExport";
import type { AnalyticsFilters } from "@/types/analytics";
import { AnalyticsControls, type DatePreset, type StudentOption } from "./AnalyticsControls";
import { AutoSummaryCard } from "./AutoSummaryCard";
import { ClassAveragesChart } from "./ClassAveragesChart";
import { GrowthTrendChart } from "./GrowthTrendChart";
import { TopPerformersLeaderboard } from "./TopPerformersLeaderboard";

interface AnalyticsSectionProps {
  orgId: string | null;
  orgName: string;
  /** Full student roster (from licenses) for the student filter dropdown. */
  roster: StudentOption[];
}

const EMPTY_FILTERS: AnalyticsFilters = {
  dateFrom: null,
  dateTo: null,
  lessonId: null,
  studentId: null,
};

/** Returns an ISO timestamp for N days before now (start of that day). */
const daysAgoIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/** Formats a nullable percentage for the KPI tiles. */
const pct = (v: number | null): string => (v === null ? "—" : `${v}%`);

/**
 * Reports & Analytics section for the admin dashboard. Owns the filter state,
 * fetches filtered analytics, and renders KPIs, the auto-summary, charts, and
 * the leaderboard, plus Excel/PDF export of the current view.
 * @param props - Org context and the student roster for filtering.
 * @returns The analytics section element.
 */
export function AnalyticsSection({ orgId, orgName, roster }: AnalyticsSectionProps): JSX.Element {
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_FILTERS);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [exporting, setExporting] = useState(false);

  const { analytics, isLoading, isFetching, isError, error } = useOrgAnalytics(orgId, filters);

  const summary = useMemo(
    () => generateAnalyticsSummary(analytics, filters, orgName),
    [analytics, filters, orgName]
  );

  /** Applies a date-range preset, deriving the from/to bounds. */
  const handleDatePresetChange = (preset: DatePreset): void => {
    setDatePreset(preset);
    if (preset === "all") {
      setFilters((f) => ({ ...f, dateFrom: null, dateTo: null }));
    } else if (preset === "custom") {
      // Keep whatever custom dates already exist (user edits via the inputs).
      setFilters((f) => ({ ...f }));
    } else {
      setFilters((f) => ({ ...f, dateFrom: daysAgoIso(parseInt(preset, 10)), dateTo: null }));
    }
  };

  /** Updates a custom date bound from the date inputs (end-of-day for "to"). */
  const handleCustomDateChange = (which: "from" | "to", value: string): void => {
    setFilters((f) => {
      if (!value) return { ...f, [which === "from" ? "dateFrom" : "dateTo"]: null };
      const iso =
        which === "from"
          ? new Date(`${value}T00:00:00`).toISOString()
          : new Date(`${value}T23:59:59`).toISOString();
      return { ...f, [which === "from" ? "dateFrom" : "dateTo"]: iso };
    });
  };

  /** Resets all filters back to "all / all / all". */
  const handleReset = (): void => {
    setFilters(EMPTY_FILTERS);
    setDatePreset("all");
  };

  /** Runs an export, guarding against empty data. */
  const runExport = (kind: "excel" | "pdf"): void => {
    if (analytics.totals.attempts === 0) {
      toast.info("Nothing to export for the current filters.");
      return;
    }
    setExporting(true);
    try {
      if (kind === "excel") exportAnalyticsToExcel(analytics, filters, summary, orgName);
      else exportAnalyticsToPDF(analytics, filters, summary, orgName);
      toast.success(`${kind === "excel" ? "Excel" : "PDF"} report downloaded.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const t = analytics.totals;
  const growthPositive = (t.avgGrowthPct ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <AnalyticsControls
        filters={filters}
        datePreset={datePreset}
        students={roster}
        isFetching={isFetching}
        exporting={exporting}
        onDatePresetChange={handleDatePresetChange}
        onCustomDateChange={handleCustomDateChange}
        onLessonChange={(lessonId) => setFilters((f) => ({ ...f, lessonId }))}
        onStudentChange={(studentId) => setFilters((f) => ({ ...f, studentId }))}
        onReset={handleReset}
        onExportExcel={() => runExport("excel")}
        onExportPdf={() => runExport("pdf")}
      />

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          Failed to load analytics: {error?.message ?? "unknown error"}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiTile icon={<Users className="h-5 w-5 text-primary" />} label="Active Students" value={`${t.activeStudents}`} sub={`of ${t.students} enrolled`} />
            <KpiTile icon={<GraduationCap className="h-5 w-5 text-green-500" />} label="Avg Pre-Test" value={pct(t.avgPrePct)} sub="starting point" />
            <KpiTile icon={<GraduationCap className="h-5 w-5 text-primary" />} label="Avg Post-Test" value={pct(t.avgPostPct)} sub="after lessons" />
            <KpiTile
              icon={growthPositive ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
              label="Avg Growth"
              value={t.avgGrowthPct === null ? "—" : `${growthPositive ? "+" : ""}${t.avgGrowthPct}%`}
              sub="pre → post"
              valueClass={growthPositive ? "text-green-600" : "text-red-600"}
            />
            <KpiTile icon={<Repeat2 className="h-5 w-5 text-secondary" />} label="Avg Attempts" value={t.avgAttemptsPerLesson === null ? "—" : `${t.avgAttemptsPerLesson}`} sub="per lesson" />
          </div>

          <AutoSummaryCard summary={summary} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ClassAveragesChart perLesson={analytics.perLesson} />
            <GrowthTrendChart trend={analytics.trend} />
          </div>

          <TopPerformersLeaderboard entries={analytics.leaderboard} />
        </>
      )}
    </div>
  );
}

interface KpiTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}

/** Compact KPI tile used in the analytics header row. */
function KpiTile({ icon, label, value, sub, valueClass }: KpiTileProps): JSX.Element {
  return (
    <Card className="border-none shadow-card bg-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">{icon}</div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-tight">
            {label}
          </span>
        </div>
        <div className={`text-2xl font-display font-bold ${valueClass ?? "text-foreground"}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
