// Lesson 1: Earning Money - Complete Module
// Built from the client-provided Earning Money Lesson Plan, Pre-test, and Post-test.
// Uses the same structure as Lesson 2 so it runs on the generic lesson engine
// (intro -> pre-test -> topics -> post-test -> graded result, 80% passing).

export interface PreTestQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface PostTestQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface LessonTopic {
  id: string;
  title: string;
  content: string;
  analogy: string;
  scenario: string;
  discussionQuestion: string;
}

export const lessonIntroduction = `Hey there! 👋 Welcome to the LaunchPad Money Mentor!

I'm excited to be your guide for this first lesson: Earning Money.

Earning money isn't an end in itself - it's a tool that helps you reach financial security, support the people you care about, and build the kind of life you want. Over the next few minutes we'll explore what "making money" really means, the different ways people earn, how career planning works, and the factors that shape how much you can earn.

Ready to begin? First, let's take a quick Pre-Test to see what you already know!`;

export const preTestIntro = `Before we dive into the lesson, let's take a short Pre-Test.

This will help us see what you already know about earning money. Don't worry - this isn't graded! It's just a starting point so we can grow together.

I'll ask you 10 quick multiple-choice questions. Just pick the answer you think is best (A, B, C, or D) - there's no pressure here!`;

export const preTest: PreTestQuestion[] = [
  {
    id: "pre1",
    question: "Which type of income comes directly from working?",
    options: [
      "A. Passive income",
      "B. Earned income",
      "C. Investment income",
      "D. Rental income"
    ],
    correctAnswer: "B",
    explanation: "Earned income is money you get directly from working - like wages, salaries, or tips."
  },
  {
    id: "pre2",
    question: "Wealth is generally determined by:",
    options: [
      "A. Income minus taxes",
      "B. Savings minus spending",
      "C. Assets minus liabilities",
      "D. Earnings minus expenses"
    ],
    correctAnswer: "C",
    explanation: "Wealth is what you own (assets) minus what you owe (liabilities). It's about net worth, not just how much you earn."
  },
  {
    id: "pre3",
    question: "What is one advantage of entrepreneurship?",
    options: [
      "A. Flexible decision-making and ownership",
      "B. Guaranteed profits",
      "C. No financial risk",
      "D. Limited responsibility"
    ],
    correctAnswer: "A",
    explanation: "Entrepreneurs enjoy flexible decision-making and ownership of what they build. It comes with risk, but also freedom and control."
  },
  {
    id: "pre4",
    question: "Which of the following is an example of passive income?",
    options: [
      "A. Hourly wages",
      "B. Commissions",
      "C. Rental income",
      "D. Overtime pay"
    ],
    correctAnswer: "C",
    explanation: "Rental income is passive - it keeps coming in without you trading hours for it, unlike wages, commissions, or overtime."
  },
  {
    id: "pre5",
    question: "Why is career planning important?",
    options: [
      "A. It helps align goals, skills, and opportunities",
      "B. It guarantees a high salary",
      "C. It eliminates competition",
      "D. It removes the need for education"
    ],
    correctAnswer: "A",
    explanation: "Career planning helps you align your goals, skills, and the opportunities around you so you can move toward work that fits you."
  },
  {
    id: "pre6",
    question: "What should be considered when making financial decisions?",
    options: [
      "A. Potential risks",
      "B. Potential benefits",
      "C. Long-term goals",
      "D. All of the above"
    ],
    correctAnswer: "D",
    explanation: "Good financial decisions weigh the risks, the benefits, AND your long-term goals - all of the above."
  },
  {
    id: "pre7",
    question: "Which of the following is NOT a major income classification discussed in the lesson?",
    options: [
      "A. Earned Income",
      "B. Investment Income",
      "C. Passive Income",
      "D. Gift Income"
    ],
    correctAnswer: "D",
    explanation: "The three major income classifications are earned, investment, and passive income. 'Gift income' is not one of them."
  },
  {
    id: "pre8",
    question: "Why is understanding the value of money important?",
    options: [
      "A. It helps people make thoughtful spending decisions",
      "B. It increases earning power automatically",
      "C. It eliminates financial mistakes",
      "D. It reduces the need for budgeting"
    ],
    correctAnswer: "A",
    explanation: "When you understand the value of money, you make thoughtful, intentional spending decisions instead of impulsive ones."
  },
  {
    id: "pre9",
    question: "Which factor is most likely to increase future earnings?",
    options: [
      "A. Developing skills and experience",
      "B. Changing jobs frequently",
      "C. Spending more money",
      "D. Avoiding challenges"
    ],
    correctAnswer: "A",
    explanation: "Developing your skills and experience is the most reliable way to increase what you can earn over time."
  },
  {
    id: "pre10",
    question: "What is the ultimate goal of earning and managing money wisely?",
    options: [
      "A. Financial stability and well-being",
      "B. Owning expensive items",
      "C. Avoiding all expenses",
      "D. Retiring immediately"
    ],
    correctAnswer: "A",
    explanation: "The real goal is financial stability and well-being - money is a tool to support the life you want, not the goal itself."
  }
];

export const preTestComplete = `Awesome job completing the Pre-Test!

You've shown me where you're starting from, and now we're going to build on that knowledge together.

This part of the LaunchPad Financial Literacy program is designed to help students learn independently outside the classroom.

Let's dive into Topic 1!`;

export const topics: LessonTopic[] = [
  {
    id: "topic1",
    title: "What Earning Money Really Means",
    content: `Earning money is not the end goal - it's a tool. It helps you reach financial security, fulfill personal goals, support the people you love, and enjoy a comfortable life.

When you understand the value of money, you make thoughtful spending decisions instead of impulsive ones. You start asking: "Is this worth my time and effort?" rather than just "Can I buy it?"

The ultimate goal isn't owning the most expensive things - it's financial stability and well-being. Money works best when it serves your life, not the other way around.`,
    analogy: "Think of money like fuel in a car. Fuel isn't the destination - it's what gets you there. Hoarding fuel or burning it carelessly both leave you stuck. Using it wisely gets you where you want to go.",
    scenario: "You get your first paycheck of $400. One friend says, 'Spend it on the new sneakers!' Another says, 'Save some and cover what you actually need.' Understanding the value of money helps you pause and decide what really matters to you - not just what feels good in the moment.",
    discussionQuestion: "What does money mean to you - and what are your personal goals when it comes to earning it?"
  },
  {
    id: "topic2",
    title: "The Three Types of Income",
    content: `There are three major classifications of income:

• Earned income - money you get directly from working, like wages, salaries, and tips.
• Investment income - money your money makes for you, like interest, dividends, or profit from stocks.
• Passive income - money that keeps coming in without trading hours for it, like rental income or royalties.

(Heads up: "gift income" is NOT one of the major classifications!)

The big idea: earned income is great, but it stops when you stop working. Building investment and passive income streams over time gives you more freedom and security.`,
    analogy: "Earned income is like fishing - you only eat on the days you catch something. Investment and passive income are like owning a fish pond that keeps restocking itself, feeding you even on days you rest.",
    scenario: "Maria works a part-time job (earned income), keeps some savings in an account that pays interest (investment income), and rents out a parking spot she owns (passive income). Three different streams means if one slows down, she's not stuck.",
    discussionQuestion: "Which type of income do you have - or want to build - and why?"
  },
  {
    id: "topic3",
    title: "Building Wealth: Assets vs. Liabilities",
    content: `Earning money and building wealth are not the same thing. Plenty of people earn a lot but stay broke - and some people with modest incomes build real wealth.

Wealth is determined by your assets minus your liabilities:
• Assets are things you own that have value (savings, investments, property).
• Liabilities are things you owe (debts, loans, unpaid bills).

The goal over time is to grow your assets and keep your liabilities under control. That gap between the two - your net worth - is your real financial picture.`,
    analogy: "Think of a bucket. Assets are the water you pour in; liabilities are the holes leaking it out. It doesn't matter how fast you pour if the holes are bigger - wealth is about keeping more water in the bucket than leaks out.",
    scenario: "Two people both earn $3,000 a month. One owes $2,800 in monthly debt payments; the other owes $800 and invests the rest. Same income - very different wealth, because one is growing assets and the other is drowning in liabilities.",
    discussionQuestion: "What's one asset you could start building, and one liability you'd want to avoid?"
  },
  {
    id: "topic4",
    title: "Ways to Make Money & Entrepreneurship",
    content: `There are many avenues for generating income:

• Employment and careers
• Entrepreneurship (starting your own business)
• Investments
• Online opportunities
• Creative pursuits
• The gig economy
• Rental income, royalties, and licensing

Entrepreneurship stands out because of its advantages: flexible decision-making and ownership. You control your direction and you own what you build. It does come with financial risk and responsibility - that's the trade-off for the freedom it offers.`,
    analogy: "Being an employee is like riding a bus - someone else picks the route and schedule, and you get a reliable ride. Entrepreneurship is like driving your own car - more responsibility and risk, but you choose the destination and own the vehicle.",
    scenario: "Jordan starts a small lawn-care service. Some weeks are slow, and Jordan covers the costs (the risk). But Jordan sets the prices, picks the clients, and keeps the profit - that's the ownership and flexible decision-making entrepreneurship gives you.",
    discussionQuestion: "If you started a small business tomorrow, what would it be - and what risk would you have to manage?"
  },
  {
    id: "topic5",
    title: "Career Planning & Growing Your Earnings",
    content: `Career planning is the process of aligning your goals, your skills, and the opportunities available to you. It doesn't guarantee a high salary or remove competition - but it helps you move with purpose instead of drifting.

The single most reliable way to increase your future earnings is developing your skills and experience. The more valuable you become at solving real problems, the more your work is worth.

Some key skills and qualities that boost income generation: communication, problem-solving, adaptability, networking, and financial literacy.`,
    analogy: "Career planning is like using a GPS. It doesn't drive the car or remove traffic, but it lines up where you are, where you want to go, and the best route to get there.",
    scenario: "Sam wants to work in tech. Instead of waiting, Sam takes a free online coding course, builds a small project, and connects with people in the field. A year later those skills and that experience open a paid opportunity - planning turned into earning.",
    discussionQuestion: "What's one skill you could develop this year that would raise your earning potential?"
  },
  {
    id: "topic6",
    title: "Smart Financial Decisions & The Factors That Affect Income",
    content: `Every money decision deserves real thought. When making financial decisions, consider all of the following: the potential risks, the potential benefits, AND your long-term goals.

Your income is also shaped by factors - some you control, some you don't:
• Things you influence: education, skills, experience, and your work ethic.
• Things you don't fully control: industry demand, market conditions, and economic and political factors.

The good news? The controllable factors matter a lot. Focusing your energy there is how you take charge of your financial well-being.`,
    analogy: "Making a financial decision is like checking the weather before a trip. You can't control the weather (economic and political factors), but you can pack smart and choose your route (skills, planning, and goals) to reach your destination safely.",
    scenario: "Alex is offered two jobs: one pays slightly more now, the other offers training and growth. By weighing the risks, benefits, and long-term goals - not just today's paycheck - Alex picks the role that builds skills and bigger earnings down the road.",
    discussionQuestion: "Think of a recent money choice you made. Did you weigh the risks, benefits, and your long-term goals?"
  }
];

export const postTestIntro = `Alright, it's quiz time!

Let's see how much you've learned about earning money, building wealth, and making smart financial decisions.

I'll ask you 10 multiple-choice questions. Read carefully and choose the best answer for each one. Remember - you'll need 80% or higher to pass!`;

export const postTest: PostTestQuestion[] = [
  {
    id: "post1",
    question: "Which type of income comes directly from working?",
    options: [
      "A. Passive income",
      "B. Earned income",
      "C. Investment income",
      "D. Rental income"
    ],
    correctAnswer: "B",
    explanation: "Earned income is money you get directly from working - wages, salaries, and tips."
  },
  {
    id: "post2",
    question: "Wealth is generally determined by:",
    options: [
      "A. Income minus taxes",
      "B. Savings minus spending",
      "C. Assets minus liabilities",
      "D. Earnings minus expenses"
    ],
    correctAnswer: "C",
    explanation: "Wealth equals your assets (what you own) minus your liabilities (what you owe) - that's your net worth."
  },
  {
    id: "post3",
    question: "What is one advantage of entrepreneurship?",
    options: [
      "A. Flexible decision-making and ownership",
      "B. Guaranteed profits",
      "C. No financial risk",
      "D. Limited responsibility"
    ],
    correctAnswer: "A",
    explanation: "Entrepreneurship offers flexible decision-making and ownership - though it carries real risk and responsibility too."
  },
  {
    id: "post4",
    question: "Which of the following is an example of passive income?",
    options: [
      "A. Hourly wages",
      "B. Commissions",
      "C. Rental income",
      "D. Overtime pay"
    ],
    correctAnswer: "C",
    explanation: "Rental income is passive - it comes in without trading hours for it, unlike wages, commissions, or overtime."
  },
  {
    id: "post5",
    question: "Why is career planning important?",
    options: [
      "A. It helps align goals, skills, and opportunities",
      "B. It guarantees a high salary",
      "C. It eliminates competition",
      "D. It removes the need for education"
    ],
    correctAnswer: "A",
    explanation: "Career planning aligns your goals, skills, and opportunities so you can move toward work that fits you."
  },
  {
    id: "post6",
    question: "What should be considered when making financial decisions?",
    options: [
      "A. Potential risks",
      "B. Potential benefits",
      "C. Long-term goals",
      "D. All of the above"
    ],
    correctAnswer: "D",
    explanation: "Smart financial decisions weigh the risks, the benefits, and your long-term goals - all of the above."
  },
  {
    id: "post7",
    question: "Which of the following is NOT a major income classification discussed in the lesson?",
    options: [
      "A. Earned Income",
      "B. Investment Income",
      "C. Passive Income",
      "D. Gift Income"
    ],
    correctAnswer: "D",
    explanation: "The three major classifications are earned, investment, and passive income - 'gift income' is not one of them."
  },
  {
    id: "post8",
    question: "Why is understanding the value of money important?",
    options: [
      "A. It helps people make thoughtful spending decisions",
      "B. It increases earning power automatically",
      "C. It eliminates financial mistakes",
      "D. It reduces the need for budgeting"
    ],
    correctAnswer: "A",
    explanation: "Understanding the value of money leads to thoughtful, intentional spending decisions."
  },
  {
    id: "post9",
    question: "Which factor is most likely to increase future earnings?",
    options: [
      "A. Developing skills and experience",
      "B. Changing jobs frequently",
      "C. Spending more money",
      "D. Avoiding challenges"
    ],
    correctAnswer: "A",
    explanation: "Developing your skills and experience is the most reliable way to grow what you can earn over time."
  },
  {
    id: "post10",
    question: "What is the ultimate goal of earning and managing money wisely?",
    options: [
      "A. Financial stability and well-being",
      "B. Owning expensive items",
      "C. Avoiding all expenses",
      "D. Retiring immediately"
    ],
    correctAnswer: "A",
    explanation: "The real goal is financial stability and well-being - money is a tool to support the life you want."
  }
];

export const lessonCompletion = `Congratulations! You've completed the Earning Money module! 🎉

Remember: earning money is a tool, not the goal. The real win is using it to build financial stability and well-being.

Here's what you'll carry forward:
• Earned, investment, and passive income are the three ways money comes in
• Wealth is your assets minus your liabilities
• Entrepreneurship offers ownership and flexibility - with risk
• Career planning aligns your goals, skills, and opportunities
• Growing your skills and experience grows your earnings
• Smart financial decisions weigh risks, benefits, and long-term goals

This is part of the LaunchPad Financial Literacy program, designed to help students learn independently outside the classroom.

Keep growing, keep learning, and keep believing in your power to build your future!

Type "menu" to go back to the lesson selection, or ask me any questions about earning money!`;
