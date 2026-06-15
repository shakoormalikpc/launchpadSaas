
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  postTestScore: number;
  postTestTotal: number;
  completedAt?: string;
}

export interface ProgressData {
  lessonsCompleted: LessonProgress[];
  totalLessonsCompleted: number;
}

export const useProgressTracking = () => {
  const { user, profile } = useAuth();
  const [progress, setProgress] = useState<ProgressData>({ lessonsCompleted: [], totalLessonsCompleted: 0 });
  const [loading, setLoading] = useState(true);

  /**
   * Fetches the user's completed-lesson progress from Supabase and replaces
   * local state with the DB truth. Safe to call any time to re-sync after a
   * mutation (e.g. a reset) so the UI never drifts from the database.
   * @returns A promise that resolves once progress has been refreshed.
   */
  const refetchProgress = useCallback(async (): Promise<void> => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (error) throw error;

      const lessonsCompleted: LessonProgress[] = data.map((row: any) => ({
        lessonId: row.lesson_id,
        completed: row.status === 'completed',
        postTestScore: row.score_post || 0,
        postTestTotal: row.score_post_total || 10, // Get actual quiz length from database
        completedAt: row.updated_at
      }));

      setProgress({
        lessonsCompleted,
        totalLessonsCompleted: lessonsCompleted.length
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Fetch progress aborted");
        return;
      }
      console.error("Error fetching progress:", error);
      // We log the error but don't show a toast to avoid interrupting the user experience
      // specifically when they just signed in and progress might not be ready.
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    refetchProgress();
  }, [refetchProgress]);

  const recordLessonCompletion = useCallback(async (
    lessonId: string,
    postTestScore: number,
    postTestTotal: number
  ) => {
    if (!user) return;

    // Optimistic update
    setProgress(prev => {
      const existingIndex = prev.lessonsCompleted.findIndex(l => l.lessonId === lessonId);
      const newLessonProgress: LessonProgress = {
        lessonId,
        completed: true,
        postTestScore,
        postTestTotal,
        completedAt: new Date().toISOString(),
      };

      let newLessonsCompleted: LessonProgress[];
      if (existingIndex >= 0) {
        newLessonsCompleted = [...prev.lessonsCompleted];
        newLessonsCompleted[existingIndex] = newLessonProgress;
      } else {
        newLessonsCompleted = [...prev.lessonsCompleted, newLessonProgress];
      }

      return {
        lessonsCompleted: newLessonsCompleted,
        totalLessonsCompleted: newLessonsCompleted.length,
      };
    });

    // Save to Supabase
    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          status: 'completed',
          score_post: postTestScore,        // Save raw score (e.g., 4 correct)
          score_post_total: postTestTotal,  // Save total questions (e.g., 5 questions)
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,lesson_id'
        });

      if (error) throw error;
      toast.success("Progress saved!");
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Record progress aborted");
        return;
      }
      console.error("Error saving progress:", error);
      // We don't always want to show an error toast if it's just a network flutter or a double-save
      if (!error.message?.includes('duplicate key')) {
        toast.error(error.message || "Failed to save progress");
      }
    }
  }, [user]);

  const getLessonProgress = useCallback((lessonId: string): LessonProgress | null => {
    return progress.lessonsCompleted.find(l => l.lessonId === lessonId) || null;
  }, [progress]);

  const getOverallGrade = useCallback((): {
    percentage: number;
    isPassing: boolean;
    totalCorrect: number;
    totalQuestions: number;
    lessonsCompleted: number;
  } => {
    // Filter for completed lessons with valid scores AND totals
    const completedLessons = progress.lessonsCompleted.filter(
      l => l.completed && typeof l.postTestScore === 'number' && typeof l.postTestTotal === 'number' && l.postTestTotal > 0
    );

    if (completedLessons.length === 0) {
      return { percentage: 0, isPassing: false, totalCorrect: 0, totalQuestions: 0, lessonsCompleted: 0 };
    }

    // Calculate total correct answers across ALL quizzes
    const totalCorrect = completedLessons.reduce((sum, l) => sum + l.postTestScore, 0);

    // Calculate total questions across ALL quizzes
    const totalQuestions = completedLessons.reduce((sum, l) => sum + l.postTestTotal, 0);

    // Calculate weighted percentage (correct answers / total questions)
    const percentage = Math.round((totalCorrect / totalQuestions) * 100);

    return {
      percentage,
      isPassing: percentage >= 80,
      totalCorrect,
      totalQuestions,
      lessonsCompleted: completedLessons.length,
    };
  }, [progress]);

  const getEncouragementMessage = useCallback((): string => {
    const completed = progress.lessonsCompleted.length;
    const grade = getOverallGrade();
    const name = profile?.first_name ? ` ${profile.first_name}` : "";

    if (completed === 0) {
      return `Welcome${name}! Ready to start your first lesson?`;
    }

    if (completed === 1) {
      return `🚀 Great start${name}! You've completed your first lesson!`;
    }

    if (completed >= 3 && completed < 7) {
      return `🌟 Congratulations${name}, you're making good progress! ${completed} lessons completed!`;
    }

    if (completed >= 7 && completed < 12) {
      return `💪 You're on fire${name}! ${completed} lessons done - keep up the great work!`;
    }

    if (completed >= 12) {
      return `🏆 Amazing${name}! You've completed ${completed} lessons! You're becoming a financial literacy champion!`;
    }

    if (grade.isPassing) {
      return `⭐ Excellent work${name}! Your overall grade is ${grade.percentage}% - you're passing with flying colors!`;
    }

    return `📚 Keep learning${name}! You've completed ${completed} lessons so far.`;
  }, [progress, getOverallGrade, profile]);

  const resetLessonProgress = useCallback(async (lessonId: string) => {
    if (!user) return;

    // Optimistically remove from local state so the card updates immediately.
    setProgress(prev => {
      const newLessonsCompleted = prev.lessonsCompleted.filter(l => l.lessonId !== lessonId);
      return {
        lessonsCompleted: newLessonsCompleted,
        totalLessonsCompleted: newLessonsCompleted.length,
      };
    });

    try {
      // 1. Delete the progress row. .select() returns the deleted rows so we can
      // confirm one was actually removed — a successful call that deletes 0 rows
      // means the row survived (e.g. blocked by an RLS policy).
      const { data: deleted, error } = await supabase
        .from('user_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .select('id');

      if (error) throw error;

      if (!deleted || deleted.length === 0) {
        console.warn(
          `resetLessonProgress: deleted 0 rows for lesson "${lessonId}". The row is still in the DB — check the DELETE RLS policy on user_progress.`
        );
        // Re-sync so we don't show a falsely-reset card that reappears later.
        await refetchProgress();
        toast.error("Couldn't reset this lesson — it wasn't cleared from the database. Please try again.");
        return;
      }

      // 2. Clear any saved chat state so the lesson restarts cleanly.
      const { error: stateError } = await supabase
        .from('lesson_states')
        .delete()
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId);

      if (stateError) {
        console.warn("resetLessonProgress: failed to clear lesson_states:", stateError);
      }

      toast.success("Lesson reset! You can now retake the quiz.");
    } catch (error: any) {
      console.error("Error resetting lesson:", error);
      // Re-sync local state with the DB truth so the UI reflects reality.
      await refetchProgress();
      toast.error(error.message || "Failed to reset lesson");
    }
  }, [user, refetchProgress]);

  return {
    progress,
    loading,
    recordLessonCompletion,
    getLessonProgress,
    getOverallGrade,
    getEncouragementMessage,
    resetLessonProgress,
    refetchProgress,
  };
};

