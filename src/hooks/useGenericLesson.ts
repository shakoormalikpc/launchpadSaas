import { useState, useCallback, useRef, useEffect } from "react";
import { generateTopicAnalogy, topicContentMap } from "@/data/topicAnalogies";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuestionAnswering } from "./useQuestionAnswering";
import { getLessonName } from "@/utils/lessonNames";

export interface Message {
  id: string;
  role: "user" | "mentor";
  content: string;
}

// Unified interfaces for lesson data
export interface PreTestQuestion {
  id: string | number;
  question: string;
  options?: string[];
  correctAnswer?: string | number;
  mentorAnswer?: string; // For open-ended questions (Lesson 2 style)
}

export interface PostTestQuestion {
  id: string | number;
  question: string;
  options: string[];
  correctAnswer: string | number;
  explanation: string;
}

export interface LessonTopic {
  id: string | number;
  title: string;
  content: string;
  analogy?: string;
  scenario?: string;
  discussionQuestion: string;
}

export interface LessonData {
  lessonIntroduction: string;
  preTestIntro: string;
  preTest: PreTestQuestion[];
  preTestComplete: string;
  topics: LessonTopic[];
  postTestIntro: string;
  postTest: PostTestQuestion[];
  lessonCompletion: string;
}

type LessonPhase =
  | "intro"
  | "pretest-intro"
  | "pretest"
  | "pretest-complete"
  | "topic"
  | "topic-learn-more"
  | "posttest-intro"
  | "posttest"
  | "posttest-intro"
  | "posttest"
  | "complete";

interface LessonState {
  phase: LessonPhase;
  pretestIndex: number;
  pretestResponses: string[];
  pretestCorrect: number;
  topicIndex: number;
  posttestIndex: number;
  posttestScore: number;
}

const initialState: LessonState = {
  phase: "intro",
  pretestIndex: 0,
  pretestResponses: [],
  pretestCorrect: 0,
  topicIndex: 0,
  posttestIndex: 0,
  posttestScore: 0,
};

export interface LessonCompletionData {
  postTestScore: number;
  postTestTotal: number;
}

export const useGenericLesson = (lessonData: LessonData, lessonId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [completionData, setCompletionData] = useState<LessonCompletionData | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(false);

  const lessonDisplayName = getLessonName(lessonId);

  // Aggregate full lesson context for AI
  const fullContext = `
  Introduction: ${lessonData.lessonIntroduction}
  
  Pre-Test:
  ${lessonData.preTest.map(q => `Q: ${q.question}\nA: ${q.correctAnswer || 'Open ended'}`).join('\n')}
  
  Post-Test:
  ${lessonData.postTest.map(q => `Q: ${q.question}\nA: ${q.correctAnswer}\nExplanation: ${q.explanation}`).join('\n')}
  
  Completion: ${lessonData.lessonCompletion}
  `;

  const questionAnswering = useQuestionAnswering(
    lessonData.topics || [],
    lessonDisplayName,
    fullContext
  );

  const stateRef = useRef<LessonState>({ ...initialState });

  // Load saved state on mount
  useEffect(() => {
    if (!user || !lessonId) return;

    const loadState = async () => {
      setIsLoadingState(true);
      try {
        const { data, error } = await supabase
          .from('lesson_states')
          .select('*')
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error("Error loading lesson state:", error);
          return;
        }

        if (data) {
          // Restore state
          const savedState = data.state as LessonState;
          const savedMessages = data.messages as Message[];

          // Don't resume a finished lesson — reopening it should restart from
          // the beginning so "Try Again" works, not reload the completed screen.
          if (savedState && savedMessages && savedMessages.length > 0 && savedState.phase !== 'complete') {
            stateRef.current = savedState;
            setMessages(savedMessages);
            setHasStarted(true);

            toast.success("Resumed from where you left off!");
          }
        }
      } catch (err) {
        console.error("Failed to load state:", err);
      } finally {
        setIsLoadingState(false);
      }
    };

    loadState();
  }, [user, lessonId, lessonData.postTest.length]);

  // Save state on changes
  const saveProgress = useCallback(async () => {
    if (!user || !lessonId || !hasStarted) return;

    // Don't save if in intro phase with no messages
    if (stateRef.current.phase === 'intro' && messages.length === 0) return;

    try {
      const { error } = await supabase
        .from('lesson_states')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          state: stateRef.current as any, // Cast to any for jsonb compatibility
          messages: messages as any,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,lesson_id' });

      if (error) throw error;
    } catch (err) {
      console.error("Error saving lesson state:", err);
    }
  }, [user, lessonId, messages, hasStarted]);

  // Debounced save
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProgress();
    }, 1000);
    return () => clearTimeout(timer);
  }, [saveProgress]);

  const addMessage = useCallback((role: "user" | "mentor", content: string) => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      role,
      content,
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const simulateTyping = useCallback(async (content: string, replies?: string[]) => {
    setIsTyping(true);
    setQuickReplies([]);

    const delay = Math.min(1500 + content.length * 3, 3000);
    await new Promise((resolve) => setTimeout(resolve, delay));

    setIsTyping(false);
    addMessage("mentor", content);

    if (replies) {
      setQuickReplies(replies);
    }
  }, [addMessage]);

  const formatTopicContent = (topic: LessonTopic): string => {
    let content = `📚 **${topic.title}**\n\n${topic.content}`;

    if (topic.analogy) {
      content += `\n\n💡 **Analogy:** ${topic.analogy}`;
    }

    if (topic.scenario) {
      content += `\n\n🎯 **Scenario:** ${topic.scenario}`;
    }

    return content;
  };


  const checkPreTestAnswer = (userAnswer: string, question: PreTestQuestion): boolean => {
    if (!question.correctAnswer) return false;

    const answer = userAnswer.trim().toLowerCase();
    const correct = String(question.correctAnswer).toLowerCase();

    // Check direct match
    if (answer === correct) return true;

    // For numeric answers (index-based)
    if (question.options && typeof question.correctAnswer === 'number') {
      const correctOption = question.options[question.correctAnswer];
      if (answer === correctOption?.toLowerCase()) return true;
    }

    // Check if answer starts with or contains correct answer
    if (answer.includes(correct) || correct.includes(answer)) return true;

    // Check against options
    if (question.options) {
      const matchingOption = question.options.find(opt =>
        opt.toLowerCase() === answer ||
        answer.includes(opt.toLowerCase()) ||
        opt.toLowerCase().includes(answer)
      );
      if (matchingOption && matchingOption.toLowerCase().includes(correct)) return true;
    }

    return false;
  };

  const startLesson = useCallback(async () => {
    if (hasStarted) return;
    setHasStarted(true);
    stateRef.current = { ...initialState };

    await simulateTyping(lessonData.lessonIntroduction, ["Let's go!", "I'm ready!"]);
  }, [hasStarted, lessonData.lessonIntroduction, simulateTyping]);

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    addMessage("user", content);

    // Check if in Q&A mode
    if (questionAnswering.isQAMode) {
      const { answer, shouldExit } = await questionAnswering.processQuestion(content);

      if (answer) {
        await simulateTyping(answer, ["I understand, continue"]);
      }

      if (shouldExit) {
        questionAnswering.setQAMode(false);
        // Providing a subtle transition back
        if (!answer) { // If it was just an exit command
          await simulateTyping("Resuming the lesson...", ["Continue"]);
        }
      }
      return false;
    }

    const state = stateRef.current;
    const isQuizPhase = state.phase === 'pretest' || state.phase === 'posttest';

    // Check if user is asking a question (but NOT during a quiz)
    if (!isQuizPhase && questionAnswering.isLikelyQuestion(content)) {
      questionAnswering.setQAMode(true);
      const { answer } = await questionAnswering.processQuestion(content);
      if (answer) {
        await simulateTyping(answer, ["I understand, continue"]);
      }
      return false;
    }

    // Handle menu/exit request
    if (content.toLowerCase().includes("menu")) {
      return true; // Signal to go back to menu
    }

    switch (state.phase) {
      case "intro": {
        stateRef.current.phase = "pretest-intro";
        await simulateTyping(lessonData.preTestIntro, ["Start the pre-test"]);
        break;
      }

      case "pretest-intro": {
        stateRef.current.phase = "pretest";
        stateRef.current.pretestCorrect = 0;
        const firstQuestion = lessonData.preTest[0];
        const questionText = `**Question 1 of ${lessonData.preTest.length}:**\n\n${firstQuestion.question}`;
        const replies = firstQuestion.options || [];
        await simulateTyping(questionText, replies);
        break;
      }

      case "pretest": {
        const currentQuestion = lessonData.preTest[stateRef.current.pretestIndex];

        stateRef.current.pretestResponses.push(content);

        // Track correct answers silently (no feedback shown)
        if (checkPreTestAnswer(content, currentQuestion)) {
          stateRef.current.pretestCorrect += 1;
        }

        const nextIndex = stateRef.current.pretestIndex + 1;

        if (nextIndex >= lessonData.preTest.length) {
          // Pre-test complete - show score with encouragement
          stateRef.current.phase = "pretest-complete";
          stateRef.current.pretestIndex = nextIndex;

          const score = stateRef.current.pretestCorrect;
          const total = lessonData.preTest.length;
          const percentage = Math.round((score / total) * 100);

          let encouragement: string;
          if (percentage >= 80) {
            encouragement = `🌟 **Great start!** You got ${score} out of ${total} correct (${percentage}%)!\n\nYou already know quite a bit about this topic! Let's build on that knowledge and make you an expert.`;
          } else if (percentage >= 60) {
            encouragement = `👍 **Good effort!** You got ${score} out of ${total} correct (${percentage}%).\n\nYou have some knowledge to build on! Don't worry - by the end of this lesson, these concepts will make much more sense.`;
          } else if (percentage >= 40) {
            encouragement = `💪 **No worries!** You got ${score} out of ${total} correct (${percentage}%).\n\nThat's exactly why we're here - to learn together! By the end of this lesson, you'll understand all of this much better.`;
          } else {
            encouragement = `🤝 **Don't worry at all!** You got ${score} out of ${total} correct (${percentage}%).\n\nThis is a pre-test, not a grade! Everyone starts somewhere, and I'm here to help you learn. By the end of this lesson, you'll be amazed at how much you've grown!`;
          }

          await simulateTyping(`${encouragement}\n\n${lessonData.preTestComplete}`, ["Start learning!"]);
        } else {
          stateRef.current.pretestIndex = nextIndex;
          const nextQuestion = lessonData.preTest[nextIndex];
          const questionText = `**Question ${nextIndex + 1} of ${lessonData.preTest.length}:**\n\n${nextQuestion.question}`;
          const replies = nextQuestion.options || [];
          await simulateTyping(questionText, replies);
        }
        break;
      }

      case "pretest-complete": {
        // Start first topic
        stateRef.current.phase = "topic";
        stateRef.current.topicIndex = 0;
        const firstTopic = lessonData.topics[0];
        const topicContent = formatTopicContent(firstTopic);
        await simulateTyping(topicContent, ["I understand, continue", "Learn More 💡"]);
        break;
      }

      case "topic": {
        const currentTopic = lessonData.topics[stateRef.current.topicIndex];

        // Check if they want to learn more
        if (content.toLowerCase().includes("learn more") || content.toLowerCase().includes("more")) {
          stateRef.current.phase = "topic-learn-more";
          const analogy = generateTopicAnalogy(currentTopic.title, currentTopic.content);

          const expandedContent = `💡 **Let's Make This Real!**\n\n**Analogy:** ${analogy.analogy}\n\n**Real-World Example:** ${analogy.realWorldExample}${analogy.funFact ? `\n\n🎯 **Fun Fact:** ${analogy.funFact}` : ""}`;

          await simulateTyping(expandedContent, ["Got it! Continue", "That helps!"]);
        } else {
          // Skip discussion and move to next topic or post-test directly
          const nextTopicIndex = stateRef.current.topicIndex + 1;

          if (nextTopicIndex >= lessonData.topics.length) {
            // All topics done, move to post-test
            stateRef.current.phase = "posttest-intro";
            stateRef.current.topicIndex = nextTopicIndex;
            await simulateTyping(lessonData.postTestIntro, ["Start the quiz!"]);
          } else {
            stateRef.current.topicIndex = nextTopicIndex;
            const nextTopic = lessonData.topics[nextTopicIndex];
            const topicContent = formatTopicContent(nextTopic);
            await simulateTyping(`Great! Let's move on to the next topic!\n\n${topicContent}`, ["I understand, continue", "Learn More 💡"]);
          }
        }
        break;
      }

      case "topic-learn-more": {
        // Move to next topic or post-test after expanded content
        const nextTopicIndex = stateRef.current.topicIndex + 1;

        if (nextTopicIndex >= lessonData.topics.length) {
          // All topics done, move to post-test
          stateRef.current.phase = "posttest-intro";
          stateRef.current.topicIndex = nextTopicIndex;
          await simulateTyping(lessonData.postTestIntro, ["Start the quiz!"]);
        } else {
          stateRef.current.phase = "topic";
          stateRef.current.topicIndex = nextTopicIndex;
          const nextTopic = lessonData.topics[nextTopicIndex];
          const topicContent = formatTopicContent(nextTopic);
          await simulateTyping(`Great! Let's move on to the next topic!\n\n${topicContent}`, ["I understand, continue", "Learn More 💡"]);
        }
        break;
      }


      case "posttest-intro": {
        stateRef.current.phase = "posttest";
        stateRef.current.posttestIndex = 0;
        stateRef.current.posttestScore = 0;
        const firstQuestion = lessonData.postTest[0];
        const questionText = `**Question 1 of ${lessonData.postTest.length}:**\n\n${firstQuestion.question}`;
        await simulateTyping(questionText, firstQuestion.options);
        break;
      }

      case "posttest": {
        const currentQuestion = lessonData.postTest[stateRef.current.posttestIndex];

        // Check if answer is correct
        const userAnswer = content.trim();
        let isCorrect = false;

        // Handle both string and number-based correct answers
        if (typeof currentQuestion.correctAnswer === 'number') {
          // Index-based answer
          const correctOption = currentQuestion.options[currentQuestion.correctAnswer];
          isCorrect = userAnswer === correctOption ||
            userAnswer.toLowerCase() === correctOption?.toLowerCase() ||
            userAnswer.includes(correctOption);
        } else {
          // String-based answer
          isCorrect =
            userAnswer === currentQuestion.correctAnswer ||
            userAnswer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase() ||
            userAnswer.startsWith(currentQuestion.correctAnswer) ||
            currentQuestion.options.some(opt =>
              opt.startsWith(String(currentQuestion.correctAnswer)) &&
              (userAnswer === opt || userAnswer.includes(opt))
            );
        }

        if (isCorrect) {
          stateRef.current.posttestScore += 1;
        }

        const correctAnswerText = typeof currentQuestion.correctAnswer === 'number'
          ? currentQuestion.options[currentQuestion.correctAnswer]
          : currentQuestion.correctAnswer;

        const feedback = isCorrect
          ? `✅ **Correct!** ${currentQuestion.explanation}`
          : `❌ **Not quite.** The correct answer is "${correctAnswerText}". ${currentQuestion.explanation}`;

        const nextIndex = stateRef.current.posttestIndex + 1;

        if (nextIndex >= lessonData.postTest.length) {
          // Post-test complete
          stateRef.current.phase = "complete";
          const totalQuestions = lessonData.postTest.length;
          const finalScore = stateRef.current.posttestScore;
          const percentage = Math.round((finalScore / totalQuestions) * 100);
          const isPassing = percentage >= 80;

          // Store completion data for progress tracking
          setCompletionData({
            postTestScore: finalScore,
            postTestTotal: totalQuestions,
          });

          let gradeMessage: string;
          if (percentage >= 90) {
            gradeMessage = `🏆 **Outstanding!** You scored **${finalScore} out of ${totalQuestions}** (${percentage}%)! You've truly mastered this material!`;
          } else if (percentage >= 80) {
            gradeMessage = `🎉 **Excellent work!** You scored **${finalScore} out of ${totalQuestions}** (${percentage}%)! That's a passing grade! You clearly understand these concepts well.`;
          } else if (percentage >= 70) {
            gradeMessage = `👍 **Good job!** You scored **${finalScore} out of ${totalQuestions}** (${percentage}%). You're almost there! Consider reviewing the topics to strengthen your understanding.`;
          } else if (percentage >= 60) {
            gradeMessage = `💪 **Keep going!** You scored **${finalScore} out of ${totalQuestions}** (${percentage}%). Some concepts might need more practice. Feel free to retake this lesson anytime!`;
          } else {
            gradeMessage = `📚 **Don't give up!** You scored **${finalScore} out of ${totalQuestions}** (${percentage}%). Learning takes time, and every attempt makes you stronger. Try this lesson again when you're ready!`;
          }

          const passingNote = isPassing
            ? "\n\n✅ **Passing Grade Achieved!** (80% or higher)"
            : "\n\n📝 **Note:** 80% is considered passing. You can retake this lesson anytime!";

          const scoreMessage = `${feedback}\n\n${gradeMessage}${passingNote}\n\n${lessonData.lessonCompletion}`;
          await simulateTyping(scoreMessage, ["Ask a question", "Thanks, I'm done"]);
        } else {
          stateRef.current.posttestIndex = nextIndex;
          const nextQuestion = lessonData.postTest[nextIndex];
          const nextQuestionText = `${feedback}\n\n**Question ${nextIndex + 1} of ${lessonData.postTest.length}:**\n\n${nextQuestion.question}`;
          await simulateTyping(nextQuestionText, nextQuestion.options);
        }
        break;
      }

      case "complete": {
        const q = content.toLowerCase();
        console.log("GenericLesson complete phase. Content:", q);

        // Handle "Ask a question" - enter Q&A mode
        if (q.includes("ask") && (q.includes("question") || q.includes("questions"))) {
          questionAnswering.setQAMode(true);
          const welcome = questionAnswering.getWelcomeMessage();
          await simulateTyping(welcome);
          return false;
        }

        // Handle menu/back commands
        if (q.includes("menu") || q.includes("back") || q.includes("done")) {
          return true;
        }

        const lowerContent = content.toLowerCase();

        if (lowerContent.includes("thanks") || lowerContent.includes("done")) {
          await simulateTyping(
            "You're welcome! I'm glad I could help you learn today. Feel free to return whenever you're ready for more!",
            ["Back to menu"]
          );
        } else {
          // Implicitly start Q&A with the user's input
          console.log("Implicitly starting Q&A mode with question:", content);
          questionAnswering.setQAMode(true);
          const { answer } = await questionAnswering.processQuestion(content);
          if (answer) {
            await simulateTyping(answer, ["I understand, continue"]);
          }
        }
        break;
      }
    }

    return false;
  }, [addMessage, lessonData, simulateTyping, questionAnswering]);

  const resetLesson = useCallback(async () => {
    setMessages([]);
    setQuickReplies([]);
    setHasStarted(false);
    setCompletionData(null);
    stateRef.current = { ...initialState };
    questionAnswering.setQAMode(false); // Explicitly reset Q&A state
    // Removed DB purge to fix "Back button wipes progress" bug
  }, [questionAnswering]);

  const deleteProgress = useCallback(async () => {
    if (user && lessonId) {
      try {
        await supabase
          .from('lesson_states')
          .delete()
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId);

        toast.info("Progress cleared");
        resetLesson();
      } catch (err) {
        console.error("Error clearing state:", err);
      }
    }
  }, [user, lessonId, resetLesson]);

  return {
    messages,
    isTyping,
    quickReplies,
    sendMessage,
    startLesson,
    hasStarted,
    resetLesson,
    completionData,
    isLoadingState,
    deleteProgress,
    isQAMode: questionAnswering.isQAMode,
  };
};
