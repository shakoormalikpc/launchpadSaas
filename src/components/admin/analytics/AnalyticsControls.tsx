import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, FileText, Loader2, RotateCcw } from "lucide-react";
import { LESSON_OPTIONS } from "@/utils/lessonNames";
import type { AnalyticsFilters } from "@/types/analytics";

/** A student option for the student filter dropdown. */
export interface StudentOption {
  userId: string;
  label: string;
}

/** Date-range presets offered in the controls. */
const DATE_PRESETS = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom range…" },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]["value"];

interface AnalyticsControlsProps {
  filters: AnalyticsFilters;
  datePreset: DatePreset;
  students: StudentOption[];
  isFetching: boolean;
  exporting: boolean;
  onDatePresetChange: (preset: DatePreset) => void;
  onCustomDateChange: (which: "from" | "to", value: string) => void;
  onLessonChange: (lessonId: string | null) => void;
  onStudentChange: (studentId: string | null) => void;
  onReset: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
}

/** "all" sentinel used by Radix Select (it cannot hold an empty-string value). */
const ALL = "__all__";

/** Converts an ISO timestamp to a yyyy-MM-dd value for <input type="date">. */
const toDateInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : "");

/**
 * Filter + export toolbar for the analytics section. Controls date range,
 * lesson, and student filters, and triggers Excel / PDF export of the current
 * filtered view.
 * @param props - Filter state and change handlers from AnalyticsSection.
 * @returns The controls toolbar element.
 */
export function AnalyticsControls({
  filters,
  datePreset,
  students,
  isFetching,
  exporting,
  onDatePresetChange,
  onCustomDateChange,
  onLessonChange,
  onStudentChange,
  onReset,
  onExportExcel,
  onExportPdf,
}: AnalyticsControlsProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Date range */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Date Range
          </label>
          <Select value={datePreset} onValueChange={(v) => onDatePresetChange(v as DatePreset)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom range inputs */}
        {datePreset === "custom" && (
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                className="w-[150px]"
                value={toDateInput(filters.dateFrom)}
                onChange={(e) => onCustomDateChange("from", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                To
              </label>
              <Input
                type="date"
                className="w-[150px]"
                value={toDateInput(filters.dateTo)}
                onChange={(e) => onCustomDateChange("to", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Lesson */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Lesson
          </label>
          <Select
            value={filters.lessonId ?? ALL}
            onValueChange={(v) => onLessonChange(v === ALL ? null : v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All lessons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All lessons</SelectItem>
              {LESSON_OPTIONS.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Student */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Student
          </label>
          <Select
            value={filters.studentId ?? ALL}
            onValueChange={(v) => onStudentChange(v === ALL ? null : v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All students</SelectItem>
              {students.map((s) => (
                <SelectItem key={s.userId} value={s.userId}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reset */}
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>

        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mb-2" />}
      </div>

      {/* Export actions */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground self-center mr-1">Export current view:</span>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onExportExcel} disabled={exporting}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
          Excel (.xlsx)
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onExportPdf} disabled={exporting}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          PDF
        </Button>
      </div>
    </div>
  );
}

export type { DatePreset };
