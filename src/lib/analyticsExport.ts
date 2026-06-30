import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import type { AnalyticsFilters, OrgAnalytics } from "@/types/analytics";
import { getLessonName } from "@/utils/lessonNames";

/** Formats a nullable percentage for export cells. */
const p = (v: number | null): string => (v === null ? "—" : `${v}%`);
/** Formats a nullable number for export cells. */
const n = (v: number | null): string => (v === null ? "—" : `${v}`);
/** Formats an ISO date for export, or "—". */
const d = (v: string | null): string =>
  v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** Builds a filename-safe timestamped base name. */
const fileBase = (orgName: string): string => {
  const slug = (orgName || "organization").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${slug}-analytics-${new Date().toISOString().slice(0, 10)}`;
};

/** Describes the active filters as a one-line label for report headers. */
const filterLabel = (filters: AnalyticsFilters): string => {
  const parts: string[] = [];
  if (filters.dateFrom || filters.dateTo) parts.push(`${d(filters.dateFrom)} – ${d(filters.dateTo)}`);
  else parts.push("All dates");
  parts.push(filters.lessonId ? getLessonName(filters.lessonId) : "All lessons");
  if (filters.studentId) parts.push("Single student");
  return parts.join("  •  ");
};

/**
 * Exports the analytics payload to a multi-sheet .xlsx workbook honoring the
 * active filters. Sheets: Summary, Totals, Per-Lesson, Leaderboard, Students.
 * @param analytics - The analytics payload.
 * @param filters - The active filters (rendered into the Summary sheet).
 * @param summary - The generated grantor-ready summary text.
 * @param orgName - Organization name (used for the filename + headers).
 */
export const exportAnalyticsToExcel = (
  analytics: OrgAnalytics,
  filters: AnalyticsFilters,
  summary: string,
  orgName: string
): void => {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summarySheet = XLSX.utils.aoa_to_sheet([
    [`${orgName || "Organization"} — Reporting & Analytics`],
    [filterLabel(filters)],
    [`Generated ${new Date().toLocaleString("en-US")}`],
    [],
    ["Summary"],
    [summary],
  ]);
  summarySheet["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // Totals sheet
  const t = analytics.totals;
  const totalsSheet = XLSX.utils.aoa_to_sheet([
    ["Metric", "Value"],
    ["Enrolled students", t.students],
    ["Active students", t.activeStudents],
    ["Lesson completions", t.lessonsCompleted],
    ["Total attempts", t.attempts],
    ["Avg pre-test", p(t.avgPrePct)],
    ["Avg post-test", p(t.avgPostPct)],
    ["Avg growth", p(t.avgGrowthPct)],
    ["Avg attempts / lesson", n(t.avgAttemptsPerLesson)],
  ]);
  totalsSheet["!cols"] = [{ wch: 26 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, totalsSheet, "Totals");

  // Per-lesson sheet
  const perLesson = [
    ["Lesson", "Students", "Attempts", "Avg Pre", "Avg Post", "Growth", "Avg Attempts"],
    ...analytics.perLesson.map((l) => [
      getLessonName(l.lessonId),
      l.students,
      l.attempts,
      p(l.avgPrePct),
      p(l.avgPostPct),
      p(l.growthPct),
      n(l.avgAttempts),
    ]),
  ];
  const perLessonSheet = XLSX.utils.aoa_to_sheet(perLesson);
  perLessonSheet["!cols"] = [{ wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(wb, perLessonSheet, "Per-Lesson");

  // Leaderboard sheet
  const leaderboard = [
    ["Rank", "Student", "Email", "Lessons", "Avg Post", "Avg Growth", "Attempts"],
    ...analytics.leaderboard.map((e, i) => [
      i + 1,
      e.name ?? "—",
      e.email,
      e.lessonsCompleted,
      p(e.avgPostPct),
      p(e.avgGrowthPct),
      e.totalAttempts,
    ]),
  ];
  const leaderboardSheet = XLSX.utils.aoa_to_sheet(leaderboard);
  leaderboardSheet["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 30 }, { wch: 9 }, { wch: 10 }, { wch: 11 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, leaderboardSheet, "Leaderboard");

  // Students sheet
  const students = [
    ["Student", "Email", "Lessons", "Avg Pre", "Avg Post", "Growth", "Attempts", "Last Activity"],
    ...analytics.students.map((s) => [
      s.name ?? "—",
      s.email,
      s.lessonsCompleted,
      p(s.avgPrePct),
      p(s.avgPostPct),
      p(s.growthPct),
      s.totalAttempts,
      d(s.lastActivity),
    ]),
  ];
  const studentsSheet = XLSX.utils.aoa_to_sheet(students);
  studentsSheet["!cols"] = [{ wch: 24 }, { wch: 30 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, studentsSheet, "Students");

  XLSX.writeFile(wb, `${fileBase(orgName)}.xlsx`);
};

// ── PDF helpers ───────────────────────────────────────────────────────────────

const PAGE_MARGIN = 40;
const LINE_HEIGHT = 14;

interface PdfCursor {
  doc: jsPDF;
  y: number;
  pageWidth: number;
  pageHeight: number;
}

/** Adds a new page and resets the cursor when content would overflow. */
const ensureSpace = (c: PdfCursor, needed: number): void => {
  if (c.y + needed > c.pageHeight - PAGE_MARGIN) {
    c.doc.addPage();
    c.y = PAGE_MARGIN;
  }
};

/**
 * Draws a simple bordered table with a header row, paginating as needed.
 * @param c - The PDF cursor (doc + position state).
 * @param headers - Column header labels.
 * @param rows - Row data as arrays of strings.
 * @param widths - Column widths in points (must sum to <= content width).
 */
const drawTable = (c: PdfCursor, headers: string[], rows: string[][], widths: number[]): void => {
  const startX = PAGE_MARGIN;
  const rowH = 18;

  const drawHeader = (): void => {
    ensureSpace(c, rowH * 2);
    c.doc.setFillColor(16, 122, 96); // teal
    c.doc.setTextColor(255, 255, 255);
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(9);
    let x = startX;
    c.doc.rect(startX, c.y, widths.reduce((a, b) => a + b, 0), rowH, "F");
    headers.forEach((h, i) => {
      c.doc.text(h, x + 4, c.y + 12, { maxWidth: widths[i] - 6 });
      x += widths[i];
    });
    c.y += rowH;
    c.doc.setTextColor(40, 40, 40);
    c.doc.setFont("helvetica", "normal");
  };

  drawHeader();

  rows.forEach((row, idx) => {
    if (c.y + rowH > c.pageHeight - PAGE_MARGIN) {
      c.doc.addPage();
      c.y = PAGE_MARGIN;
      drawHeader();
    }
    if (idx % 2 === 1) {
      c.doc.setFillColor(244, 247, 246);
      c.doc.rect(startX, c.y, widths.reduce((a, b) => a + b, 0), rowH, "F");
    }
    let x = startX;
    row.forEach((cell, i) => {
      c.doc.text(String(cell), x + 4, c.y + 12, { maxWidth: widths[i] - 6 });
      x += widths[i];
    });
    c.y += rowH;
  });
  c.y += 10;
};

/** Writes a section heading and advances the cursor. */
const sectionTitle = (c: PdfCursor, title: string): void => {
  ensureSpace(c, 30);
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(13);
  c.doc.setTextColor(16, 122, 96);
  c.doc.text(title, PAGE_MARGIN, c.y);
  c.y += 20;
  c.doc.setTextColor(40, 40, 40);
};

/**
 * Exports the analytics payload to a cleanly formatted multi-page PDF honoring
 * the active filters: title, summary, totals, per-lesson and leaderboard tables.
 * @param analytics - The analytics payload.
 * @param filters - The active filters (rendered into the header line).
 * @param summary - The generated grantor-ready summary text.
 * @param orgName - Organization name (used for the filename + title).
 */
export const exportAnalyticsToPDF = (
  analytics: OrgAnalytics,
  filters: AnalyticsFilters,
  summary: string,
  orgName: string
): void => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const c: PdfCursor = {
    doc,
    y: PAGE_MARGIN,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
  };
  const contentWidth = c.pageWidth - PAGE_MARGIN * 2;

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(`${orgName || "Organization"} — Performance Report`, PAGE_MARGIN, c.y);
  c.y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text(filterLabel(filters), PAGE_MARGIN, c.y);
  c.y += 14;
  doc.text(`Generated ${new Date().toLocaleString("en-US")}`, PAGE_MARGIN, c.y);
  c.y += 24;

  // Summary
  sectionTitle(c, "Executive Summary");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const summaryLines = doc.splitTextToSize(summary, contentWidth) as string[];
  summaryLines.forEach((line) => {
    ensureSpace(c, LINE_HEIGHT);
    doc.text(line, PAGE_MARGIN, c.y);
    c.y += LINE_HEIGHT;
  });
  c.y += 12;

  // Totals
  const t = analytics.totals;
  sectionTitle(c, "Key Metrics");
  drawTable(
    c,
    ["Metric", "Value"],
    [
      ["Enrolled students", String(t.students)],
      ["Active students", String(t.activeStudents)],
      ["Lesson completions", String(t.lessonsCompleted)],
      ["Total attempts", String(t.attempts)],
      ["Avg pre-test", p(t.avgPrePct)],
      ["Avg post-test", p(t.avgPostPct)],
      ["Avg growth", p(t.avgGrowthPct)],
      ["Avg attempts / lesson", n(t.avgAttemptsPerLesson)],
    ],
    [contentWidth * 0.6, contentWidth * 0.4]
  );

  // Per-lesson
  if (analytics.perLesson.length > 0) {
    sectionTitle(c, "Performance by Lesson");
    drawTable(
      c,
      ["Lesson", "Students", "Pre", "Post", "Growth", "Attempts"],
      analytics.perLesson.map((l) => [
        getLessonName(l.lessonId),
        String(l.students),
        p(l.avgPrePct),
        p(l.avgPostPct),
        p(l.growthPct),
        n(l.avgAttempts),
      ]),
      [contentWidth * 0.4, contentWidth * 0.12, contentWidth * 0.12, contentWidth * 0.12, contentWidth * 0.12, contentWidth * 0.12]
    );
  }

  // Leaderboard
  if (analytics.leaderboard.length > 0) {
    sectionTitle(c, "Top Performers");
    drawTable(
      c,
      ["#", "Student", "Lessons", "Post", "Growth", "Attempts"],
      analytics.leaderboard.slice(0, 25).map((e, i) => [
        String(i + 1),
        e.name || e.email,
        String(e.lessonsCompleted),
        p(e.avgPostPct),
        p(e.avgGrowthPct),
        String(e.totalAttempts),
      ]),
      [contentWidth * 0.06, contentWidth * 0.46, contentWidth * 0.12, contentWidth * 0.12, contentWidth * 0.12, contentWidth * 0.12]
    );
  }

  doc.save(`${fileBase(orgName)}.pdf`);
};
