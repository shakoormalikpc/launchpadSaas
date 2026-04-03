import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgName } from "@/hooks/useOrgName";
import { useStudentBundle } from "@/hooks/useStudentBundle";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { QuickReplies } from "./QuickReplies";
import { LessonSelector } from "./LessonSelector";
import { ProgressDashboard } from "./ProgressDashboard";
import { useChatbot } from "@/hooks/useChatbot";
import { useLesson2Chatbot } from "@/hooks/useLesson2Chatbot";
import { useGenericLesson } from "@/hooks/useGenericLesson";
import { useProgressTracking, LessonProgress } from "@/hooks/useProgressTracking";
import { getLessonData, isGenericLesson } from "@/data/lessonDataLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Rocket, ArrowLeft, Building2 } from "lucide-react";
import { lessons } from "@/data/lessons";
import launchpadLogo from "@/assets/launchpad-logo.png";

type ViewState = "menu" | string; // "menu" or lessonId

export const ChatContainer = () => {
  const { profile, user } = useAuth();
  const { orgName } = useOrgName(user?.email);
  const { allowedLessonIds } = useStudentBundle(user?.email, profile?.role);
  const [viewState, setViewState] = useState<ViewState>("menu");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const lastRecordedCompletionId = useRef<string | null>(null);

  // Progress tracking
  const {
    progress,
    loading: progressLoading,
    recordLessonCompletion,
    getLessonProgress,
    getOverallGrade,
    getEncouragementMessage,
    resetLessonProgress
  } = useProgressTracking();

  // Legacy hooks for Lesson 1 and 2
  const lesson1 = useChatbot(activeLessonId === "earning-money" ? "earning-money" : undefined);
  const lesson2 = useLesson2Chatbot(activeLessonId === "living-on-your-own" ? "living-on-your-own" : undefined);

  // Get lesson data for generic lessons
  const genericLessonData = useMemo(() => {
    if (activeLessonId && isGenericLesson(activeLessonId)) {
      return getLessonData(activeLessonId);
    }
    return null;
  }, [activeLessonId]);

  // Generic lesson hook - always called but only used for generic lessons
  const genericLesson = useGenericLesson(
    genericLessonData || {
      lessonIntroduction: "",
      preTestIntro: "",
      preTest: [],
      preTestComplete: "",
      topics: [],
      postTestIntro: "",
      postTest: [],
      lessonCompletion: "",
    },
    activeLessonId || undefined
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get completed lessons from progress
  const completedLessons = useMemo(() => {
    return progress.lessonsCompleted.map(l => l.lessonId);
  }, [progress]);

  // Build lesson progress map for display
  const lessonProgressMap = useMemo(() => {
    const map = new Map<string, LessonProgress>();
    progress.lessonsCompleted.forEach(lp => {
      map.set(lp.lessonId, lp);
    });
    return map;
  }, [progress]);

  // Get current lesson data based on view state
  const getCurrentLesson = useCallback(() => {
    if (viewState === "menu") return null;
    if (viewState === "earning-money") return lesson1;
    if (viewState === "living-on-your-own") return lesson2;
    if (isGenericLesson(viewState)) return genericLesson;
    return null;
  }, [viewState, lesson1, lesson2, genericLesson]);

  const currentLesson = getCurrentLesson();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentLesson?.messages, currentLesson?.isTyping]);

  // Reset generic lesson when switching lessons
  useEffect(() => {
    if (activeLessonId && isGenericLesson(activeLessonId) && viewState === activeLessonId) {
      genericLesson.resetLesson();
    }
  }, [activeLessonId]);

  // Track completion when genericLesson completes
  useEffect(() => {
    if (genericLesson.completionData && activeLessonId) {
      const completionId = `${activeLessonId}-${genericLesson.completionData.postTestScore}-${genericLesson.completionData.postTestTotal}`;

      if (lastRecordedCompletionId.current === completionId) {
        console.log("ChatContainer: Progress already recorded for this session");
        return;
      }

      lastRecordedCompletionId.current = completionId;
      recordLessonCompletion(
        activeLessonId,
        genericLesson.completionData.postTestScore,
        genericLesson.completionData.postTestTotal
      );
    }
  }, [genericLesson.completionData, activeLessonId, recordLessonCompletion]);

  // Track completion for Lesson 1
  useEffect(() => {
    if (lesson1.completionData && viewState === "earning-money") {
      recordLessonCompletion(
        "earning-money",
        lesson1.completionData.postTestScore,
        lesson1.completionData.postTestTotal
      );
    }
  }, [lesson1.completionData, viewState, recordLessonCompletion]);

  // Track completion for Lesson 2
  useEffect(() => {
    if (lesson2.completionData && viewState === "living-on-your-own") {
      recordLessonCompletion(
        "living-on-your-own",
        lesson2.completionData.postTestScore,
        lesson2.completionData.postTestTotal
      );
    }
  }, [lesson2.completionData, viewState, recordLessonCompletion]);

  const handleSelectLesson = useCallback((lessonId: string) => {
    if (!allowedLessonIds.includes(lessonId)) {
      toast({
        title: "Lesson not available",
        description: "This lesson is not included in your current plan. Please contact your admin to upgrade.",
        variant: "destructive",
      });
      return;
    }

    setActiveLessonId(lessonId);
    setViewState(lessonId);

    // Reset the appropriate lesson hook
    if (isGenericLesson(lessonId)) {
      genericLesson.resetLesson();
    }
  }, [allowedLessonIds, genericLesson]);

  const handleBackToMenu = useCallback(() => {
    const currentLessonId = viewState;
    setViewState("menu");
    setActiveLessonId(null);

    // Reset the current lesson
    if (currentLessonId === "earning-money") {
      lesson1.resetLesson();
    } else if (currentLessonId === "living-on-your-own") {
      lesson2.resetLesson();
    } else if (isGenericLesson(currentLessonId)) {
      genericLesson.resetLesson();
    }
  }, [viewState, lesson1, lesson2, genericLesson]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (viewState === "earning-money") {
      await lesson1.sendMessage(content);
    } else if (viewState === "living-on-your-own") {
      const shouldGoToMenu = await lesson2.sendMessage(content);
      if (shouldGoToMenu) {
        lesson2.resetLesson();
        setViewState("menu");
        setActiveLessonId(null);
      }
    } else if (isGenericLesson(viewState)) {
      const shouldGoToMenu = await genericLesson.sendMessage(content);
      if (shouldGoToMenu) {
        genericLesson.resetLesson();
        setViewState("menu");
        setActiveLessonId(null);
      }
    }
  }, [viewState, lesson1, lesson2, genericLesson]);

  // Get lesson metadata for display
  const getLessonMeta = useCallback((lessonId: string) => {
    return lessons.find(l => l.id === lessonId);
  }, []);

  // Calculate overall stats
  const overallGrade = getOverallGrade();
  const encouragementMessage = getEncouragementMessage();

  // Render menu/lesson selector
  if (viewState === "menu") {
    return (
      <div className="flex flex-col h-screen max-h-screen bg-background">
        <ChatHeader />

        <div className="flex-1 overflow-y-auto p-4 pt-6 flex flex-col items-center justify-start">
          <div className="flex flex-col items-center justify-center animate-fade-in py-8 max-w-lg lg:max-w-6xl w-full">
            <img
              src={launchpadLogo}
              alt="LaunchPad Financial Literacy Series"
              className="h-20 w-auto mb-6"
            />

            <h2 className="font-display text-2xl lg:text-4xl font-bold text-foreground mb-2 text-center">
              Welcome to LaunchPad{profile?.first_name ? `, ${profile.first_name}` : ""}!
            </h2>
            <p className="text-muted-foreground text-center max-w-sm lg:max-w-2xl lg:text-xl mb-4">
              Your journey to financial literacy starts here. Choose a lesson to begin learning!
            </p>

            {/* Organization badge */}
            {orgName && (
              <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-primary">{orgName}</span>
                <Badge variant="secondary" className="text-xs">Member</Badge>
              </div>
            )}

            {/* Progress Dashboard */}
            {progressLoading ? (
              <div className="w-full max-w-md h-32 mb-6 flex items-center justify-center bg-muted/20 rounded-xl animate-pulse">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <ProgressDashboard
                lessonsCompleted={overallGrade.lessonsCompleted}
                totalLessons={lessons.filter(l => l.isAvailable).length}
                overallGrade={overallGrade.percentage}
                isPassing={overallGrade.isPassing}
                encouragementMessage={encouragementMessage}
              />
            )}

            <LessonSelector
              lessons={lessons}
              onSelectLesson={handleSelectLesson}
              completedLessons={completedLessons}
              lessonProgress={lessonProgressMap}
              onResetLesson={resetLessonProgress}
              allowedLessonIds={allowedLessonIds}
            />

            <p className="text-xs text-muted-foreground mt-6 text-center max-w-xs">
              This is part of the LaunchPad Financial Literacy program, designed to help students learn independently.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render lesson view
  const lessonData = currentLesson!;
  const lessonMeta = getLessonMeta(viewState);
  const lessonTitle = lessonMeta?.title || "Lesson";
  const lessonNumber = lessonMeta?.number || 1;
  const lessonDescription = lessonMeta?.description || "";

  return (
    <div className="flex flex-col h-screen max-h-screen bg-background">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 pt-6 space-y-4">
        {!lessonData.hasStarted ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in py-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToMenu}
              className="absolute top-20 left-4 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Lessons
            </Button>

            <img
              src={launchpadLogo}
              alt="LaunchPad Financial Literacy Series"
              className="h-20 w-auto mb-6"
            />

            <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full mb-3">
              Lesson {lessonNumber}
            </span>

            <h2 className="font-display text-2xl lg:text-4xl font-bold text-foreground mb-2 text-center">
              {lessonTitle}
            </h2>
            <p className="text-muted-foreground text-center max-w-sm lg:max-w-2xl lg:text-xl mb-6">
              {lessonDescription}
            </p>

            <Button
              onClick={lessonData.startLesson}
              size="lg"
              disabled={lessonData.isLoadingState}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 rounded-xl shadow-soft transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {lessonData.isLoadingState ? (
                <>
                  <div className="h-5 w-5 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2" />
                  Checking for saved progress...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5 mr-2 lg:w-6 lg:h-6" />
                  <span className="lg:text-xl">Start the Lesson</span>
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground mt-4 text-center max-w-xs">
              This is part of the LaunchPad Financial Literacy program
            </p>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToMenu}
              className="text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Lessons
            </Button>

            {lessonData.messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
              />
            ))}

            {lessonData.isTyping && (
              <ChatMessage role="mentor" content="" isTyping />
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {lessonData.hasStarted && (
        <>
          <QuickReplies
            options={lessonData.isQAMode ? ["I understand, continue"] : lessonData.quickReplies}
            onSelect={handleSendMessage}
          />
          <ChatInput
            onSend={handleSendMessage}
            disabled={lessonData.isTyping}
          />
        </>
      )}
    </div>
  );
};
