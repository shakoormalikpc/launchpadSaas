import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart2 } from "lucide-react";
import { getLessonName } from "@/utils/lessonNames";
import type { LessonAnalytics } from "@/types/analytics";

interface ClassAveragesChartProps {
  perLesson: LessonAnalytics[];
}

/** Shortens a lesson name for the X axis tick. */
const shortName = (lessonId: string): string => {
  const name = getLessonName(lessonId);
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
};

/**
 * Grouped bar chart comparing class-average pre-test vs post-test scores per
 * lesson — the core visualization of knowledge growth.
 * @param props - Per-lesson analytics rows.
 * @returns The chart card element.
 */
export function ClassAveragesChart({ perLesson }: ClassAveragesChartProps): JSX.Element {
  const data = perLesson.map((l) => ({
    lessonId: l.lessonId,
    name: shortName(l.lessonId),
    fullName: getLessonName(l.lessonId),
    pre: l.avgPrePct ?? 0,
    post: l.avgPostPct ?? 0,
  }));

  return (
    <Card className="border-none shadow-card bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-display font-bold">Class Averages by Lesson</CardTitle>
            <p className="text-muted-foreground text-sm">Pre-test vs post-test (%)</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No lesson data in the selected range yet.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, key: string) => [`${value}%`, key === "pre" ? "Pre-test" : "Post-test"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                />
                <Legend
                  formatter={(value) => (value === "pre" ? "Pre-test" : "Post-test")}
                  wrapperStyle={{ fontSize: "12px" }}
                />
                <Bar dataKey="pre" fill="hsl(28 95% 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="post" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
