import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy } from "lucide-react";
import type { LeaderboardEntry } from "@/types/analytics";

interface TopPerformersLeaderboardProps {
  entries: LeaderboardEntry[];
  /** Max rows to show (default 10). */
  limit?: number;
}

/** Medal colors for the top three ranks. */
const RANK_STYLES = [
  "bg-yellow-400/20 text-yellow-600",
  "bg-slate-300/30 text-slate-600",
  "bg-orange-400/20 text-orange-700",
];

/** Formats a nullable percentage. */
const p = (v: number | null): string => (v === null ? "—" : `${v}%`);

/**
 * Top Performers leaderboard ranking students by average post-test score.
 * @param props - The leaderboard entries (already sorted desc by the RPC).
 * @returns The leaderboard card element.
 */
export function TopPerformersLeaderboard({
  entries,
  limit = 10,
}: TopPerformersLeaderboardProps): JSX.Element {
  const rows = entries.slice(0, limit);

  return (
    <Card className="border-none shadow-card bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-display font-bold">Top Performers</CardTitle>
            <p className="text-muted-foreground text-sm">Ranked by average post-test score</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No student activity in the selected range yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="text-center">Lessons</TableHead>
                <TableHead className="text-center">Avg Post</TableHead>
                <TableHead className="text-center">Growth</TableHead>
                <TableHead className="text-center">Attempts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e, i) => (
                <TableRow key={e.userId}>
                  <TableCell>
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        i < 3 ? RANK_STYLES[i] : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-0">
                    <p className="font-medium text-foreground truncate">{e.name || e.email}</p>
                    {e.name && (
                      <p className="text-xs text-muted-foreground truncate">{e.email}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-medium">{e.lessonsCompleted}</TableCell>
                  <TableCell className="text-center font-bold text-foreground">{p(e.avgPostPct)}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={
                        e.avgGrowthPct === null
                          ? "text-muted-foreground"
                          : e.avgGrowthPct >= 0
                          ? "text-green-600 font-medium"
                          : "text-red-600 font-medium"
                      }
                    >
                      {e.avgGrowthPct === null ? "—" : `${e.avgGrowthPct >= 0 ? "+" : ""}${e.avgGrowthPct}%`}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">{e.totalAttempts}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
