import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { TrendPoint } from "@/types/analytics";

interface GrowthTrendChartProps {
  trend: TrendPoint[];
}

/** Formats an ISO date (yyyy-MM-dd) as a short axis label. */
const shortDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Line chart of average post-test score per day — shows performance trends
 * across the selected period (e.g. week over week).
 * @param props - The daily trend points.
 * @returns The chart card element.
 */
export function GrowthTrendChart({ trend }: GrowthTrendChartProps): JSX.Element {
  const data = trend.map((t) => ({
    date: shortDate(t.date),
    avgPost: t.avgPostPct ?? 0,
    completions: t.completions,
  }));

  return (
    <Card className="border-none shadow-card bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-display font-bold">Performance Trend</CardTitle>
            <p className="text-muted-foreground text-sm">Average post-test score over time</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No activity in the selected range yet.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, key: string) =>
                    key === "avgPost" ? [`${value}%`, "Avg post-test"] : [value, "Completions"]
                  }
                />
                <Line
                  type="monotone"
                  dataKey="avgPost"
                  stroke="hsl(160 84% 39%)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
