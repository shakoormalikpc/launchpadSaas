import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgName } from "@/hooks/useOrgName";
import { useStudentBundle, DEMO_LESSON_IDS } from "@/hooks/useStudentBundle";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { QuickReplies } from "./QuickReplies";
import { LessonSelector } from "./LessonSelector";
import { ProgressDashboard } from "./ProgressDashboard";
import { IntroVideoModal } from "./IntroVideoModal";
import { useLesson2Chatbot } from "@/hooks/useLesson2Chatbot";
import { useGenericLesson } from "@/hooks/useGenericLesson";
import { useProgressTracking, LessonProgress } from "@/hooks/useProgressTracking";
import { getLessonData, isGenericLesson } from "@/data/lessonDataLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Rocket, ArrowLeft, Building2, AlertTriangle, Sparkles } from "lucide-react";
import { lessons } from "@/data/lessons";
import { DemoCertificate } from "@/components/demo/DemoCertificate";
import launchpadLogo from "@/assets/launchpad-logo.png";

const INTRO_VIDEO_SEEN_KEY = "intro_video_seen";

type ViewState = "menu" | string; // "menu" or lessonId

export const ChatContainer = () => {
  const { profile, user } = useAuth();
  const { orgName } = useOrgName(user?.email);
  const { allowedLessonIds, isExpired, noAccess } = useStudentBundle(user?.email, profile?.role, profile?.group_name);
  const isDemoUser = profile?.group_name === "__demo__";
  const [viewState, setViewState] = useState<ViewState>("menu");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const lastRecordedCompletionId = useRef<string | null>(null);
  const [showDemoCongrats, setShowDemoCongrats] = useState(false);
  const demoCelebratedRef = useRef(false);

  // Intro video: show once for students only
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  useEffect(() => {
    if (
      profile?.role === "student" &&
      localStorage.getItem(INTRO_VIDEO_SEEN_KEY) !== "true"
    ) {
      setShowIntroVideo(true);
    }
  }, [profile?.role]);

  const handleIntroVideoClose = useCallback(() => {
    setShowIntroVideo(false);
    localStorage.setItem(INTRO_VIDEO_SEEN_KEY, "true");
  }, []);

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

  // Lesson 1 now runs on the generic engine (see lessonDataLoader). Lesson 2
  // still uses its dedicated hook until it's migrated.
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
    activeLessonId && isGenericLesson(activeLessonId) ? activeLessonId : undefined
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get completed lessons from progress
  const completedLessons = useMemo(() => {
    return progress.lessonsCompleted.map(l => l.lessonId);
  }, [progress]);

  // Demo learners get a "Congratulations" celebration + certificate prompt once
  // they've finished all demo lessons (the demo's equivalent of finishing all 14).
  const demoComplete = useMemo(
    () => isDemoUser && DEMO_LESSON_IDS.every(id => completedLessons.includes(id)),
    [isDemoUser, completedLessons]
  );

  useEffect(() => {
    // Only celebrate when they actually finish a lesson (i.e. they're inside a
    // lesson view), not when a returning, already-complete user opens the menu
    // (the menu already shows the certificate banner for that case).
    if (demoComplete && !demoCelebratedRef.current && viewState !== "menu") {
      demoCelebratedRef.current = true;
      setShowDemoCongrats(true);
    }
  }, [demoComplete, viewState]);

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
    if (viewState === "living-on-your-own") return lesson2;
    if (isGenericLesson(viewState)) return genericLesson;
    return null;
  }, [viewState, lesson2, genericLesson]);

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
        genericLesson.completionData.postTestTotal,
        genericLesson.completionData.preTestScore,
        genericLesson.completionData.preTestTotal
      );
    }
  }, [genericLesson.completionData, activeLessonId, recordLessonCompletion]);

  // Track completion for Lesson 2
  useEffect(() => {
    if (lesson2.completionData && viewState === "living-on-your-own") {
      recordLessonCompletion(
        "living-on-your-own",
        lesson2.completionData.postTestScore,
        lesson2.completionData.postTestTotal,
        lesson2.completionData.preTestScore,
        lesson2.completionData.preTestTotal
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
    if (currentLessonId === "living-on-your-own") {
      lesson2.resetLesson();
    } else if (isGenericLesson(currentLessonId)) {
      genericLesson.resetLesson();
    }
  }, [viewState, lesson2, genericLesson]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (viewState === "living-on-your-own") {
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
  }, [viewState, lesson2, genericLesson]);

  // Get lesson metadata for display
  const getLessonMeta = useCallback((lessonId: string) => {
    return lessons.find(l => l.id === lessonId);
  }, []);

  // Calculate overall stats
  const overallGrade = getOverallGrade();
  const encouragementMessage = getEncouragementMessage();

  // Celebration shown when a demo learner finishes all demo lessons.
  const demoCongratsDialog = (
    <Dialog open={showDemoCongrats} onOpenChange={setShowDemoCongrats}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            🎉 Congratulations{profile?.first_name ? `, ${profile.first_name}` : ""}!
          </DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          You've completed all {DEMO_LESSON_IDS.length} lessons of the LaunchPad demo.
          Generate your Certificate of Completion below.
        </p>
        <DemoCertificate
          email={user?.email}
          firstName={profile?.first_name}
          lastName={profile?.last_name}
          lessonsCompleted={progress.lessonsCompleted}
          variant="card"
        />
        <Button variant="ghost" onClick={() => setShowDemoCongrats(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );

  // Access removed: a student whose license was revoked (or never assigned) by
  // their organization. Show a professional message instead of any lessons.
  if (noAccess) {
    return (
      <div className="flex flex-col h-screen max-h-screen bg-background">
        <ChatHeader />
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-md text-center animate-fade-in">
            <img src={launchpadLogo} alt="LaunchPad" className="h-16 w-auto mx-auto mb-8" />
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-3">
              Access Unavailable
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Your access to the LaunchPad program{orgName ? <> through <span className="font-semibold text-foreground">{orgName}</span></> : ""} isn&apos;t active right now. This usually means your seat hasn&apos;t been assigned yet or has been released.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Please contact your organization administrator to restore your access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render menu/lesson selector
  if (viewState === "menu") {
    return (
      <div className="flex flex-col h-screen max-h-screen bg-background">
        <IntroVideoModal open={showIntroVideo} onClose={handleIntroVideoClose} />
        {demoCongratsDialog}
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

            {/* Demo mode banner */}
            {isDemoUser && !isExpired && (
              <div className="w-full max-w-lg mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary">Demo Mode</p>
                  <p className="text-xs text-muted-foreground">
                    3 of 14 lessons available. Contact us to unlock the full program.
                  </p>
                </div>
              </div>
            )}

            {/* Demo certificate — unlocks once all demo lessons are complete */}
            {isDemoUser && !isExpired && (
              <DemoCertificate
                email={user?.email}
                firstName={profile?.first_name}
                lastName={profile?.last_name}
                lessonsCompleted={progress.lessonsCompleted}
                variant="banner"
              />
            )}

            {/* Subscription expired banner */}
            {isExpired && (
              <div className="w-full max-w-lg mb-6 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Subscription Expired</p>
                  <p className="text-sm text-destructive/80 mt-0.5">
                    Your subscription has expired. Please contact your organization admin to renew.
                  </p>
                </div>
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
      {demoCongratsDialog}
      <ChatHeader />

      {/* Always-visible lesson bar with back button (stays put while messages scroll) */}
      {lessonData.hasStarted && (
        <div className="shrink-0 bg-background/95 backdrop-blur border-b border-border px-4 py-2 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToMenu}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Lessons
          </Button>
          <span className="text-sm font-medium text-foreground truncate">
            Lesson {lessonNumber}: {lessonTitle}
          </span>
        </div>
      )}

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
