
import { useEffect } from "react";
import { useProgressTracking } from "@/hooks/useProgressTracking";
import { useOrgName } from "@/hooks/useOrgName";
import { useStudentBundle } from "@/hooks/useStudentBundle";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  BookOpen,
  Trophy,
  Star,
  Building2,
  CheckCircle2,
  Package,
  Rocket,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { lessons } from "@/data/lessons";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { progress, getOverallGrade, loading, getEncouragementMessage } = useProgressTracking();
  const { orgName, orgLoading } = useOrgName(user?.id);
  const { bundleName } = useStudentBundle(user?.email, profile?.role);

  // Redirect org_admin away from student dashboard
  useEffect(() => {
    if (profile?.role === "org_admin") {
      navigate("/admin-dashboard", { replace: true });
    }
  }, [profile?.role, navigate]);

  const overallGrade = getOverallGrade();
  const encouragementMessage = getEncouragementMessage();

  /**
   * Returns the human-readable lesson title for a given lessonId.
   * @param lessonId - The raw lesson ID string.
   * @returns The matching lesson title, or the lessonId if not found.
   */
  const getLessonTitle = (lessonId: string): string => {
    return lessons.find((l) => l.id === lessonId)?.title ?? lessonId;
  };

  const totalLessons = lessons.filter((l) => l.isAvailable).length;
  const completedCount = overallGrade.lessonsCompleted;
  const remainingCount = totalLessons - completedCount;

  const chartData =
    completedCount === 0 && remainingCount === 0
      ? [{ name: "No Data", value: 1 }]
      : [
          { name: "Completed", value: completedCount },
          { name: "Remaining", value: remainingCount },
        ];

  const COLORS =
    completedCount === 0 && remainingCount === 0
      ? ["#e2e8f0"]
      : ["#8b5cf6", "#e2e8f0"];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 pt-6 flex flex-col items-center justify-start">
        <div className="flex flex-col items-center animate-fade-in py-8 max-w-lg lg:max-w-4xl w-full">

          {/* Back button */}
          <div className="w-full flex justify-start mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Lessons
            </Button>
          </div>

          {/* Page heading */}
          <h1 className="font-display text-2xl lg:text-4xl font-bold text-foreground mb-2 text-center">
            {profile?.first_name
              ? `Welcome back, ${profile.first_name}!`
              : "My Dashboard"}
          </h1>
          <p className="text-muted-foreground text-center max-w-sm lg:max-w-2xl lg:text-xl mb-6">
            Track your progress and celebrate your achievements.
          </p>

          {/* Org badge — pill style matching homepage */}
          {!orgLoading && orgName && (
            <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-primary">{orgName}</span>
              <Badge variant="secondary" className="text-xs">Member</Badge>
            </div>
          )}

          {/* Encouragement banner */}
          <div className="w-full max-w-2xl bg-primary/10 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm font-medium text-primary">{encouragementMessage}</p>
          </div>

          {/* Stats — 3 cards in a row */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-2xl mb-8">
            {/* Lessons Completed */}
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold text-foreground">{completedCount}/{totalLessons}</p>
              <p className="text-xs text-muted-foreground">Lessons</p>
            </div>

            {/* Average Grade */}
            <div className={`rounded-lg p-3 text-center ${
              overallGrade.isPassing
                ? "bg-primary/10 border border-primary/30"
                : "bg-card border border-border"
            }`}>
              <Trophy className={`w-5 h-5 mx-auto mb-1 ${overallGrade.isPassing ? "text-primary" : "text-muted-foreground"}`} />
              <p className={`text-lg font-bold ${overallGrade.isPassing ? "text-primary" : "text-foreground"}`}>
                {overallGrade.percentage}%
              </p>
              <p className="text-xs text-muted-foreground">
                {overallGrade.isPassing ? "Passing!" : "Avg Grade"}
              </p>
            </div>

            {/* Bundle Name */}
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <Package className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-sm font-bold text-foreground leading-tight truncate">
                {bundleName ?? "Full Access"}
              </p>
              <p className="text-xs text-muted-foreground">Bundle</p>
            </div>
          </div>

          {/* Chart + Achievements */}
          <div className="grid gap-6 md:grid-cols-2 w-full max-w-4xl mb-8">

            {/* Completion Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Completion Progress</CardTitle>
                <CardDescription>Visual breakdown of your learning journey</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="45%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Achievements */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Achievements</CardTitle>
                <CardDescription>Your latest milestones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {progress.lessonsCompleted.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No lessons completed yet. Start your first lesson!
                    </p>
                  ) : (
                    progress.lessonsCompleted
                      .slice(-5)
                      .reverse()
                      .map((lesson, i) => {
                        const score = lesson.postTestScore;
                        const pointLabel = score === 1 ? "point" : "points";
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-none truncate">
                                {getLessonTitle(lesson.lessonId)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Score: {score} {pointLabel}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="secondary" className="text-xs">
                                Completed
                              </Badge>
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Continue Learning CTA */}
          <Button
            onClick={() => navigate("/")}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 rounded-xl shadow-soft transition-all hover:scale-105 active:scale-95"
          >
            <Rocket className="w-5 h-5 mr-2" />
            Continue Learning
          </Button>

          <p className="text-xs text-muted-foreground mt-6 text-center max-w-xs">
            This is part of the LaunchPad Financial Literacy program, designed to help students learn independently.
          </p>

        </div>
      </div>
    </div>
  );
}
