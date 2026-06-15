import { useState, useCallback } from "react";
import { useQuestionAnswering } from "./useQuestionAnswering";

export interface Message {
  id: string;
  role: "user" | "mentor";
  content: string;
}

interface LessonStep {
  mentorMessage: string;
  quickReplies?: string[];
  nextStep?: (userResponse: string) => number;
}

// Lesson flow based on the curriculum
const lessonFlow: LessonStep[] = [
  {
    mentorMessage: `Hey there! 👋 Welcome to the LaunchPad Money Mentor!

I'm excited to be your guide on this financial literacy journey. This is part of our interactive learning program designed to help students like you learn about money—independently, at your own pace.

Today's lesson is all about Earning Money. We're going to explore what earning means, different ways you can start making money, and how to think about your future income.

Ready to get started? First, let me ask you something simple...`,
    quickReplies: ["I'm ready!", "Tell me more first"],
    nextStep: () => 1,
  },
  {
    mentorMessage: `Great! So here's a question to kick things off:

What does money mean to you?

Think about it for a second. Is it about buying things you want? Helping your family? Saving for something big? There's no wrong answer here—I just want to know what comes to mind.`,
    quickReplies: ["Freedom to buy what I want", "Security for the future", "Being able to help others"],
  },
  {
    mentorMessage: `That's a great perspective! 💡

Here's the thing: money is a tool. It's not good or bad on its own—it's about how you use it. And earning money? That's really about creating value for others.

When you help someone, solve a problem, or do something useful—people are willing to pay for that. That's the foundation of earning.

So let me ask you: What are some ways you think teens like you can earn money?`,
    quickReplies: ["Part-time jobs", "Selling things online", "Helping neighbors", "I'm not sure"],
  },
  {
    mentorMessage: `Yes! You're thinking right! 🎯

Here are some real ways teens earn money:

• Employment – Part-time jobs at stores, restaurants, tutoring
• Entrepreneurship – Starting a small business, selling crafts, offering services
• Gig work – Babysitting, lawn care, pet sitting, car washing
• Creative work – Art commissions, content creation, photography

The cool thing is, you don't have to wait until you're an adult to start. Many successful people started earning as teenagers!

Which of these sounds most interesting to you?`,
    quickReplies: ["Getting a part-time job", "Starting my own thing", "Doing gigs for neighbors", "Creative work"],
  },
  {
    mentorMessage: `Nice choice! Here's something important to understand:

Learning to generate income is one of the most powerful skills you can develop.

Why? Because it gives you control over your future. When you know how to earn money, you're not dependent on luck or waiting for things to happen—you can make things happen.

Think about it: How do you think learning to earn money could change your future?`,
    quickReplies: ["I'd be more independent", "I could afford my goals", "I'd have more choices"],
  },
  {
    mentorMessage: `Exactly! 🚀 Independence, goals, choices—that's financial empowerment!

Now, let's talk about something real: not everyone earns the same amount. Here are some factors that affect how much money people make:

✅ Things you CAN control:
• Education and skills you develop
• Your attitude and work ethic
• How much you practice and improve
• The opportunities you seek out

❌ Things you CAN'T fully control:
• The economy
• Industry demand
• Where you were born

The good news? The controllable factors matter A LOT. What's one skill you'd like to develop that could help you earn money?`,
    quickReplies: ["Communication skills", "Tech/coding", "Creative skills", "Business skills"],
  },
  {
    mentorMessage: `That's a solid choice! 💪

Here's the secret: the skills you develop now can shape your entire career. And speaking of careers...

Career planning isn't just for adults. Starting to think about what you enjoy, what you're good at, and what careers match those things—that's powerful.

Quick question: What's something you enjoy doing that you could imagine getting paid for one day?`,
    quickReplies: ["Working with technology", "Helping people", "Creating things", "Leading/organizing"],
  },
  {
    mentorMessage: `I love that! 🌟

You know what's cool? The thing you just mentioned—that enjoyment you feel—that's called alignment. When your work matches your interests and strengths, you're more likely to succeed AND be happy doing it.

Let me leave you with some key takeaways from today:

📌 Earning money = creating value for others
📌 You can start earning now, even as a teen
📌 Skills, attitude, and learning affect your income potential
📌 Career planning starts with knowing yourself

This was just a taste of the LaunchPad Financial Literacy program. The full course goes much deeper!

What's one thing from today's lesson that you'll remember?`,
    quickReplies: ["Money is a tool", "I can start now", "Skills matter", "Know myself"],
  },
  {
    mentorMessage: `Perfect! That's a great takeaway! 🎉

You did awesome today. Remember: this is part of the LaunchPad Financial Literacy program, designed to help students learn independently outside the classroom.

If you want to learn more about:
• Budgeting and saving
• Investing basics
• Building financial goals
• And so much more...

...keep exploring the LaunchPad program!

Feel free to ask me any questions about earning money, or type "restart" to go through the lesson again. I'm here to help! 🚀`,
    quickReplies: ["What jobs pay well?", "How do I start a business?", "Restart the lesson"],
  },
];

// Open-ended response handler for questions
const getOpenResponse = (question: string): string => {
  const q = question.toLowerCase();

  if (q.includes("restart")) {
    return "RESTART";
  }

  if (q.includes("jobs") && q.includes("pay")) {
    return `Great question! 💰

Jobs that typically pay well often require specialized skills or education:

• Healthcare – Doctors, nurses, therapists
• Technology – Software developers, data scientists
• Finance – Accountants, financial analysts
• Trades – Electricians, plumbers (these are in high demand!)
• Business – Managers, entrepreneurs

But here's the key: high-paying jobs usually require investment in yourself—whether that's education, training, or building skills over time.

What matters most is finding something that matches your interests AND has good earning potential. What field interests you?`;
  }

  if (q.includes("business") || q.includes("start")) {
    return `Love the entrepreneurial spirit! 🚀

Here's how many teens start their first business:

1. Find a problem to solve – What do people need help with?
2. Start small – Offer one simple service or product
3. Tell people about it – Let family, friends, and neighbors know
4. Deliver great quality – Happy customers tell others!
5. Reinvest – Put some earnings back into growing

Ideas to start with: lawn care, tutoring, pet sitting, handmade crafts, social media help for local businesses.

The best part? You learn SO much by doing it—even if it's small! What kind of business idea interests you?`;
  }

  if (q.includes("save") || q.includes("saving")) {
    return `Saving is super important! 🏦

Here's a simple rule many people use: the 50/30/20 rule
• 50% for needs (things you must have)
• 30% for wants (fun stuff)
• 20% for savings (future you!)

Even if you're only earning a little right now, building the habit of saving something from each paycheck is what matters. Future you will thank present you!

Want to know more about budgeting or investing?`;
  }

  return `That's a thoughtful question! 🤔

While I'm focused on the basics of earning money in this demo lesson, the full LaunchPad program covers many more topics like budgeting, saving, investing, and financial planning.

Is there anything specific about earning money I can help clarify? Or would you like to restart the lesson?`;
};

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

export const useChatbot = (lessonId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [completionData, setCompletionData] = useState<{ postTestScore: number; postTestTotal: number } | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(false);

  // Aggregate full lesson context for AI
  const fullContext = lessonFlow.map(step => step.mentorMessage).join('\n\n');

  const questionAnswering = useQuestionAnswering(
    [], // Lesson 1 has no structured topics
    "Earning Money",
    fullContext
  );

  // We need a ref to track state for saving, similar to other hooks
  // Since this legacy hook uses multiple state variables, we'll sync them to a ref for the saver
  const stateRef = useRef({
    currentStep: 0,
    hasStarted: false,
    completionData: null as { postTestScore: number; postTestTotal: number } | null
  });

  // Sync ref with state
  useEffect(() => {
    stateRef.current = { currentStep, hasStarted, completionData };
  }, [currentStep, hasStarted, completionData]);

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
          const savedState = data.state as any;
          const savedMessages = data.messages as Message[];

          // Don't resume a finished lesson — reopening it should restart from
          // the beginning so "Try Again" works, not reload the completed screen.
          if (savedState && savedMessages && savedMessages.length > 0 && !savedState.completionData) {
            setCurrentStep(savedState.currentStep);
            setHasStarted(savedState.hasStarted);
            setCompletionData(savedState.completionData);
            setMessages(savedMessages);

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
  }, [user, lessonId]);

  // Save state on changes
  const saveProgress = useCallback(async () => {
    if (!user || !lessonId || !stateRef.current.hasStarted) return;

    // Don't save if in step 0 with no messages (start)
    if (stateRef.current.currentStep === 0 && messages.length === 0) return;

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
  }, [user, lessonId, messages]); // dependent on messages changing

  // Debounced save
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProgress();
    }, 1000);
    return () => clearTimeout(timer);
  }, [saveProgress]);

  const addMessage = useCallback((role: "user" | "mentor", content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const simulateTyping = useCallback(async (content: string, replies?: string[]) => {
    setIsTyping(true);
    setQuickReplies([]);

    // Simulate typing delay based on content length
    const delay = Math.min(1500 + content.length * 5, 3000);
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

    const firstStep = lessonFlow[0];
    await simulateTyping(firstStep.mentorMessage, firstStep.quickReplies);
  }, [hasStarted, simulateTyping]);

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    addMessage("user", content);

    // Check if in Q&A mode
    if (questionAnswering.isQAMode) {
      const { answer, shouldExit } = await questionAnswering.processQuestion(content);

      if (answer) {
        await simulateTyping(answer, ["I understand, continue"]);
      }

      if (shouldExit) {
        questionAnswering.setQAMode(false);
        // Resuming logic for Lesson 1
        if (!answer && currentStep < lessonFlow.length - 1) {
          await simulateTyping("Resuming the lesson...", ["Continue"]);
        } else if (!answer) {
          // End of lesson resume
          await simulateTyping("What would you like to do next?", ["Ask a question", "Restart the lesson"]);
        }
      }
      return;
    }

    // Check if user is asking a question
    if (questionAnswering.isLikelyQuestion(content)) {
      questionAnswering.setQAMode(true);
      const { answer } = await questionAnswering.processQuestion(content);
      if (answer) {
        await simulateTyping(answer, ["I understand, continue"]);
      }
      return;
    }

    // Check for restart
    if (content.toLowerCase().includes("restart")) {
      questionAnswering.setQAMode(false);
      setCurrentStep(0);
      setCompletionData(null);
      await simulateTyping(lessonFlow[0].mentorMessage, lessonFlow[0].quickReplies);
      return;
    }

    // If we're in the lesson flow
    if (currentStep < lessonFlow.length - 1) {
      const nextStepIndex = currentStep + 1;
      setCurrentStep(nextStepIndex);

      const nextStep = lessonFlow[nextStepIndex];
      await simulateTyping(nextStep.mentorMessage, nextStep.quickReplies);

      // Mark as complete when reaching the final step (lesson 1 has no post-test, so we give 100%)
      if (nextStepIndex === lessonFlow.length - 1) {
        setCompletionData({ postTestScore: 1, postTestTotal: 1 });
      }
    } else {
      // We're at the end
      const q = content.toLowerCase();

      // Handle "Ask a question" triggers (explicit)
      if (q.includes("ask") && (q.includes("question") || q.includes("questions"))) {
        questionAnswering.setQAMode(true);
        const welcome = questionAnswering.getWelcomeMessage();
        await simulateTyping(welcome);
        return;
      }

      // Check hardcoded open responses first
      const response = getOpenResponse(content);
      if (response !== "RESTART" && !response.includes("thoughtful question")) {
        await simulateTyping(response, ["Ask a question", "Restart the lesson"]);
        return;
      }

      // If generic response, try AI
      questionAnswering.setQAMode(true);
      const { answer } = await questionAnswering.processQuestion(content);
      if (answer) {
        await simulateTyping(answer, ["I understand, continue"]);
      }
    }
  }, [addMessage, currentStep, simulateTyping, questionAnswering]);

  const resetLesson = useCallback(() => {
    setMessages([]);
    setCurrentStep(0);
    setQuickReplies([]);
    setHasStarted(false);
    setCompletionData(null);
    questionAnswering.setQAMode(false); // Explicitly reset Q&A state
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
