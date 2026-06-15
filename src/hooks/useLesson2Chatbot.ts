import { useState, useCallback, useRef } from "react";
import { useQuestionAnswering } from "./useQuestionAnswering";
import {
  lesson2Introduction,
  preTestIntro,
  lesson2PreTest,
  preTestComplete,
  lesson2Topics,
  postTestIntro,
  lesson2PostTest,
  lesson2Completion,
} from "@/data/lesson2";
import { generateTopicAnalogy } from "@/data/topicAnalogies";

export interface Message {
  id: string;
  role: "user" | "mentor";
  content: string;
}

type Lesson2Phase =
  | "intro"
  | "pretest-intro"
  | "pretest"
  | "pretest-complete"
  | "topic"
  | "topic-learn-more"
  | "posttest-intro"
  | "posttest"
  | "complete";

interface Lesson2State {
  phase: Lesson2Phase;
  pretestIndex: number;
  pretestResponses: string[];
  pretestCorrect: number;
  topicIndex: number;
  posttestIndex: number;
  posttestScore: number;
}

const initialState: Lesson2State = {
  phase: "intro",
  pretestIndex: 0,
  pretestResponses: [],
  pretestCorrect: 0,
  topicIndex: 0,
  posttestIndex: 0,
  posttestScore: 0,
};

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LessonCompletionData } from "./useGenericLesson";
import { useEffect } from "react";

export const useLesson2Chatbot = (lessonId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [completionData, setCompletionData] = useState<LessonCompletionData | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(false);

  // Aggregate full lesson context for AI
  const fullContext = `
  Introduction: ${lesson2Introduction}
  
  Pre-Test:
  ${lesson2PreTest.map(q => `Q: ${q.question}\nA: ${q.correctAnswer}\nExplanation: ${q.explanation}`).join('\n')}
  
  Post-Test:
  ${lesson2PostTest.map(q => `Q: ${q.question}\nA: ${q.correctAnswer}\nExplanation: ${q.explanation}`).join('\n')}
  
  Completion: ${lesson2Completion}
  `;

  const questionAnswering = useQuestionAnswering(
    lesson2Topics,
    "Living on Your Own",
    fullContext
  );

  const stateRef = useRef<Lesson2State>(initialState);
  const [, forceUpdate] = useState({});

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

        if (error && error.code !== 'PGRST116') {
          console.error("Error loading lesson state:", error);
          return;
        }

        if (data) {
          const savedState = data.state as Lesson2State;
          const savedMessages = data.messages as Message[];

          if (savedState && savedMessages && savedMessages.length > 0) {
            stateRef.current = savedState;
            setMessages(savedMessages);
            setHasStarted(true);

            if (savedState.phase === 'complete') {
              const score = savedState.posttestScore;
              setCompletionData({ postTestScore: score, postTestTotal: lesson2PostTest.length });
            }

            toast.success("Resumed from where you left off!");
            forceUpdate({});
          }
        }
      } catch (err) {
        console.error("Failed to load state:", err);
      } finally {
        setIsLoadingState(false);
      }
    };

    loadState();
  }, [user, lessonId]);

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
          state: stateRef.current as any,
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

    const delay = Math.min(1500 + content.length * 3, 2500);
    await new Promise((resolve) => setTimeout(resolve, delay));

    setIsTyping(false);
    addMessage("mentor", content);

    if (replies) {
      setQuickReplies(replies);
    }
  }, [addMessage]);

  const startLesson = useCallback(async () => {
    if (hasStarted) return;
    setHasStarted(true);
    await simulateTyping(lesson2Introduction, ["Let's do the Pre-Test!", "Tell me more"]);
  }, [hasStarted, simulateTyping]);

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
        if (!answer) await simulateTyping("Resuming the lesson...", ["Continue"]);
      }
      return false;
    }

    const state = stateRef.current;
    const isQuizPhase = state.phase === "pretest" || state.phase === "posttest";

    // Check if user is asking a question (but NOT during a quiz, where free-text
    // answers can be misread as questions and stall the lesson)
    if (!isQuizPhase && questionAnswering.isLikelyQuestion(content)) {
      questionAnswering.setQAMode(true);
      const { answer } = await questionAnswering.processQuestion(content);
      if (answer) {
        await simulateTyping(answer, ["I understand, continue"]);
      }
      return false;
    }

    // Check for menu command at any point
    if (content.toLowerCase().includes("menu")) {
      return true;
    }

    const updateState = (updates: Partial<Lesson2State>) => {
      stateRef.current = { ...stateRef.current, ...updates };
      forceUpdate({});
    };

    switch (state.phase) {
      case "intro":
        updateState({ phase: "pretest-intro" });
        await simulateTyping(preTestIntro, ["I'm ready!"]);
        break;

      case "pretest-intro": {
        updateState({ phase: "pretest", pretestCorrect: 0 });
        const firstQ = lesson2PreTest[0];
        await simulateTyping(
          `Question 1 of ${lesson2PreTest.length}:\n\n${firstQ.question}\n\n${firstQ.options.join("\n")}`,
          firstQ.options.map(opt => opt.split(". ")[0])
        );
        break;
      }

      case "pretest": {
        const { pretestIndex } = state;
        const currentQuestion = lesson2PreTest[pretestIndex];

        const userAnswer = content.trim().toUpperCase().charAt(0);
        const isCorrect = userAnswer === currentQuestion.correctAnswer;

        // Track the pre-test score (for display only — the post-test is final).
        const correctSoFar = state.pretestCorrect + (isCorrect ? 1 : 0);

        // Pre-test is ungraded, so keep feedback encouraging either way.
        const feedback = isCorrect
          ? `Nice! ${currentQuestion.explanation}`
          : `Good guess — and no worries, this is just to see where you're starting! The best answer is ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`;

        await simulateTyping(feedback);

        if (pretestIndex < lesson2PreTest.length - 1) {
          const nextIndex = pretestIndex + 1;
          updateState({ pretestIndex: nextIndex, pretestCorrect: correctSoFar });

          await new Promise(resolve => setTimeout(resolve, 500));
          const nextQ = lesson2PreTest[nextIndex];
          await simulateTyping(
            `Question ${nextIndex + 1} of ${lesson2PreTest.length}:\n\n${nextQ.question}\n\n${nextQ.options.join("\n")}`,
            nextQ.options.map(opt => opt.split(". ")[0])
          );
        } else {
          updateState({ phase: "pretest-complete", pretestCorrect: correctSoFar });

          const total = lesson2PreTest.length;
          const percentage = Math.round((correctSoFar / total) * 100);

          let encouragement: string;
          if (percentage >= 80) {
            encouragement = `🌟 **Great start!** You got ${correctSoFar} out of ${total} correct (${percentage}%)!\n\nYou already know quite a bit — let's build on that and make you an expert.`;
          } else if (percentage >= 60) {
            encouragement = `👍 **Good effort!** You got ${correctSoFar} out of ${total} correct (${percentage}%).\n\nYou've got a solid base to build on. By the end of this lesson, these ideas will click even more.`;
          } else if (percentage >= 40) {
            encouragement = `💪 **Nice try!** You got ${correctSoFar} out of ${total} correct (${percentage}%).\n\nThat's exactly why we're here — to learn together! This is just a starting point, not a grade.`;
          } else {
            encouragement = `🤝 **No worries at all!** You got ${correctSoFar} out of ${total} correct (${percentage}%).\n\nThis is a pre-test, not a grade! Everyone starts somewhere — by the end of this lesson you'll be amazed at how much you've grown.`;
          }

          await new Promise(resolve => setTimeout(resolve, 500));
          await simulateTyping(`${encouragement}\n\n${preTestComplete}`, ["Let's learn!", "I'm ready"]);
        }
        break;
      }

      case "pretest-complete": {
        // Start first topic
        const topic = lesson2Topics[0];
        const topicContent = `📚 **Topic 1: ${topic.title}**\n\n${topic.content}\n\n💡 **Analogy:** ${topic.analogy}\n\n🎯 **Real-Life Scenario:** ${topic.scenario}`;
        updateState({ phase: "topic", topicIndex: 0 });
        await simulateTyping(topicContent, ["I understand, continue", "Learn More 💡"]);
        break;
      }

      case "topic": {
        const { topicIndex } = stateRef.current;
        const topic = lesson2Topics[topicIndex];

        // Check if they want to learn more
        if (content.toLowerCase().includes("learn more") || content.toLowerCase().includes("more")) {
          updateState({ phase: "topic-learn-more" });
          const analogy = generateTopicAnalogy(topic.title, topic.content);

          const expandedContent = `💡 **Let's Make This Real!**\n\n**Analogy:** ${analogy.analogy}\n\n**Real-World Example:** ${analogy.realWorldExample}${analogy.funFact ? `\n\n🎯 **Fun Fact:** ${analogy.funFact}` : ""}`;

          await simulateTyping(expandedContent, ["Got it! Continue", "That helps!"]);
        } else {
          // Move to next topic or post-test
          if (topicIndex < lesson2Topics.length - 1) {
            const nextIndex = topicIndex + 1;
            updateState({ phase: "topic", topicIndex: nextIndex });

            const nextTopic = lesson2Topics[nextIndex];
            const topicContent = `📚 **Topic ${nextIndex + 1}: ${nextTopic.title}**\n\n${nextTopic.content}\n\n💡 **Analogy:** ${nextTopic.analogy}\n\n🎯 **Real-Life Scenario:** ${nextTopic.scenario}`;

            await simulateTyping(`Great! Let's move on to the next topic!\n\n${topicContent}`, ["I understand, continue", "Learn More 💡"]);
          } else {
            updateState({ phase: "posttest-intro" });
            await simulateTyping(postTestIntro, ["Start the quiz!"]);
          }
        }
        break;
      }

      case "topic-learn-more": {
        // Move to next topic or post-test after expanded content
        const { topicIndex } = stateRef.current;

        if (topicIndex < lesson2Topics.length - 1) {
          const nextIndex = topicIndex + 1;
          updateState({ phase: "topic", topicIndex: nextIndex });

          const nextTopic = lesson2Topics[nextIndex];
          const topicContent = `📚 **Topic ${nextIndex + 1}: ${nextTopic.title}**\n\n${nextTopic.content}\n\n💡 **Analogy:** ${nextTopic.analogy}\n\n🎯 **Real-Life Scenario:** ${nextTopic.scenario}`;

          await simulateTyping(`Great! Let's move on to the next topic!\n\n${topicContent}`, ["I understand, continue", "Learn More 💡"]);
        } else {
          updateState({ phase: "posttest-intro" });
          await simulateTyping(postTestIntro, ["Start the quiz!"]);
        }
        break;
      }

      case "posttest-intro": {
        updateState({ phase: "posttest" });
        const firstQ = lesson2PostTest[0];
        await simulateTyping(
          `Question 1 of ${lesson2PostTest.length}:\n\n${firstQ.question}\n\n${firstQ.options.join("\n")}`,
          firstQ.options.map(opt => opt.split(". ")[0])
        );
        break;
      }

      case "posttest": {
        const { posttestIndex, posttestScore } = state;
        const currentQuestion = lesson2PostTest[posttestIndex];

        const userAnswer = content.trim().toUpperCase().charAt(0);
        const isCorrect = userAnswer === currentQuestion.correctAnswer;
        const newScore = isCorrect ? posttestScore + 1 : posttestScore;

        const feedback = isCorrect
          ? `Correct! ${currentQuestion.explanation}`
          : `Not quite. The correct answer is ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`;

        await simulateTyping(feedback);

        if (posttestIndex < lesson2PostTest.length - 1) {
          const nextIndex = posttestIndex + 1;
          updateState({ posttestIndex: nextIndex, posttestScore: newScore });

          await new Promise(resolve => setTimeout(resolve, 500));
          const nextQ = lesson2PostTest[nextIndex];
          await simulateTyping(
            `Question ${nextIndex + 1} of ${lesson2PostTest.length}:\n\n${nextQ.question}\n\n${nextQ.options.join("\n")}`,
            nextQ.options.map(opt => opt.split(". ")[0])
          );
        } else {
          const finalScore = newScore;
          const percentage = Math.round((finalScore / lesson2PostTest.length) * 100);

          updateState({ phase: "complete", posttestScore: finalScore });
          setCompletionData({ postTestScore: finalScore, postTestTotal: lesson2PostTest.length });

          await new Promise(resolve => setTimeout(resolve, 500));

          let scoreMessage = "";
          if (percentage >= 90) {
            scoreMessage = `Amazing! You scored ${finalScore}/${lesson2PostTest.length} (${percentage}%)! You've mastered this material!`;
          } else if (percentage >= 70) {
            scoreMessage = `Great job! You scored ${finalScore}/${lesson2PostTest.length} (${percentage}%)! You have a solid understanding!`;
          } else {
            scoreMessage = `You scored ${finalScore}/${lesson2PostTest.length} (${percentage}%). Keep reviewing the material - you've got this!`;
          }

          await simulateTyping(scoreMessage);
          await new Promise(resolve => setTimeout(resolve, 800));
          await simulateTyping(lesson2Completion, ["Back to menu", "Ask a question"]);
        }
        break;
      }

      case "complete": {
        const q = content.toLowerCase();

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

        // Implicitly start Q&A with the user's input
        questionAnswering.setQAMode(true);
        const { answer } = await questionAnswering.processQuestion(content);
        if (answer) {
          await simulateTyping(answer, ["I understand, continue"]);
        }
        break;
      }
    }

    return false;
  }, [addMessage, simulateTyping, questionAnswering]);

  const resetLesson = useCallback(async () => {
    setMessages([]);
    setQuickReplies([]);
    setHasStarted(false);
    setCompletionData(null);
    stateRef.current = initialState;
    questionAnswering.setQAMode(false); // Explicitly reset Q&A state
    forceUpdate({});
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
