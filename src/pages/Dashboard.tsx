
import { useEffect } from "react";
import { useProgressTracking } from "@/hooks/useProgressTracking";
import { useOrgName } from "@/hooks/useOrgName";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Trophy, Star, Building2, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { lessons } from "@/data/lessons";
import { ProgressDashboard } from "@/components/chat/ProgressDashboard";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
    const navigate = useNavigate();
    const { profile, user } = useAuth();
    const { progress, getOverallGrade, loading, getEncouragementMessage } = useProgressTracking();
    const { orgName, orgLoading } = useOrgName(user?.id);

    // Redirect org_admin away from student dashboard
    useEffect(() => {
        if (profile?.role === 'org_admin') {
            navigate('/admin-dashboard', { replace: true });
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
        return lessons.find(l => l.id === lessonId)?.title ?? lessonId;
    };

    const totalLessons = lessons.filter(l => l.isAvailable).length;
    const completedCount = overallGrade.lessonsCompleted;
    const remainingCount = totalLessons - completedCount;

    const data = (completedCount === 0 && remainingCount === 0)
        ? [{ name: 'No Data', value: 1 }]
        : [
            { name: 'Completed', value: completedCount },
            { name: 'Remaining', value: remainingCount },
        ];

    const COLORS = (completedCount === 0 && remainingCount === 0)
        ? ['#e2e8f0']
        : ['#8b5cf6', '#e2e8f0']; // Primary purple and muted gray

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><div className="animate-spin text-primary">...</div></div>;
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <ChatHeader />

            <div className="flex-1 overflow-y-auto p-6 md:p-12">
                <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
                    <div className="flex items-center justify-between gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/")}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back to Lessons
                        </Button>
                        {profile?.role === 'org_admin' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/admin-dashboard')}
                            >
                                <LayoutDashboard className="w-4 h-4 mr-1" />
                                Go to Admin Dashboard
                            </Button>
                        )}
                    </div>

                    {/* Page heading + motivational section */}
                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold font-display tracking-tight">
                            {profile?.first_name ? `Welcome back, ${profile.first_name}!` : "Learning Command Center"}
                        </h1>
                        <p className="text-lg text-muted-foreground">{encouragementMessage}</p>
                        <p className="text-sm font-medium text-primary">
                            {overallGrade.lessonsCompleted > 0 ? "Great Progress! Keep it up." : "Keep Going! Every lesson counts."}
                        </p>
                    </div>

                    {/* Org / group card */}
                    {!orgLoading && orgName && (
                        <Card className="border-primary/20 bg-primary/5">
                            <CardContent className="flex items-center gap-3 py-4">
                                <Building2 className="h-5 w-5 text-primary shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">{orgName}</p>
                                </div>
                                <Badge variant="secondary">Organization Member</Badge>
                            </CardContent>
                        </Card>
                    )}

                    {/* Top Stats Cards */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Lessons Completed</CardTitle>
                                <BookOpen className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{completedCount} / {totalLessons}</div>
                                <p className="text-xs text-muted-foreground">Keep up the momentum!</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Average Grade</CardTitle>
                                <Trophy className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{overallGrade.percentage}%</div>
                                <p className="text-xs text-muted-foreground">
                                    {overallGrade.isPassing ? "Passing Score" : "Needs Improvement"}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        {/* Main Chart */}
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>Completion Progress</CardTitle>
                                <CardDescription>Visual breakdown of your learning journey</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {data.map((entry, index) => (
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

                        {/* Recent Activity / Achievements */}
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Recent Achievements</CardTitle>
                                <CardDescription>
                                    Your latest milestones
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {progress.lessonsCompleted.slice(-5).reverse().map((lesson, i) => (
                                        <div key={i} className="flex items-center">
                                            <span className="relative flex h-2 w-2 mr-4">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                            </span>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium leading-none">Completed {getLessonTitle(lesson.lessonId)}</p>
                                                <p className="text-xs text-muted-foreground">Score: {lesson.postTestScore} points</p>
                                            </div>
                                            <div className="ml-auto font-medium">
                                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                            </div>
                                        </div>
                                    ))}
                                    {progress.lessonsCompleted.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">No lessons completed yet.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
