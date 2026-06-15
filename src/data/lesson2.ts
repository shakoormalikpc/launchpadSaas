// Lesson 2: Living on Your Own - Complete Module

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

export const lesson2Introduction = `Hey there! Welcome back to LaunchPad Money Mentor!

I'm thrilled you're here because this topic - Living on Your Own - is one of the biggest steps you'll ever take toward adulthood.

Whether you're about to graduate high school, heading off to college, joining the military, or jumping straight into the workforce, one thing's for sure: independence brings both freedom AND responsibility.

Living on your own means managing your money, your space, and your choices wisely. It's not just about having your own place - it's about learning how to make smart decisions that will set you up for success in the real world.

Ready to begin? First, let's take a quick Pre-Test to see what you already know!`;

export const preTestIntro = `Before we dive into the lesson, let's take a short Pre-Test.

This will help us see what you already know about living on your own. Don't worry - this isn't about getting everything right. It's about understanding where we're starting from so we can grow together!

I'll ask you 8 quick multiple-choice questions. Just pick the answer you think is best (A, B, C, or D) - there's no pressure here!`;

export const lesson2PreTest: PreTestQuestion[] = [
  {
    id: "pre1",
    question: "What does 'living on your own' really mean?",
    options: [
      "A. Having total freedom with no responsibilities",
      "B. Managing your personal, financial, and household responsibilities independently",
      "C. Letting someone else handle all your bills and chores",
      "D. Never having to follow any rules"
    ],
    correctAnswer: "B",
    explanation: "Living on your own means managing personal, financial, and household responsibilities independently. It's not about doing whatever you want - it's about balancing freedom with responsibility."
  },
  {
    id: "pre2",
    question: "Which of these is an example of a fixed expense?",
    options: [
      "A. Groceries",
      "B. Gas for your car",
      "C. Rent",
      "D. Entertainment"
    ],
    correctAnswer: "C",
    explanation: "Fixed expenses stay the same each month - like rent, car payments, or insurance. Because they're predictable, they make budgeting easier!"
  },
  {
    id: "pre3",
    question: "What is a security deposit mainly used for when renting?",
    options: [
      "A. To pay for your first month of internet",
      "B. To cover possible damage or unpaid rent",
      "C. To tip the landlord",
      "D. To buy furniture for the apartment"
    ],
    correctAnswer: "B",
    explanation: "A security deposit covers possible damage or unpaid rent. You usually get it back when you move out if everything is in good condition!"
  },
  {
    id: "pre4",
    question: "Which of the following is a responsibility of a tenant (renter)?",
    options: [
      "A. Paying rent on time and taking care of the property",
      "B. Setting the rent price",
      "C. Selling the building",
      "D. Choosing the neighbors"
    ],
    correctAnswer: "A",
    explanation: "Tenants are responsible for paying rent on time, taking care of the property, following lease rules, and reporting any maintenance issues to the landlord."
  },
  {
    id: "pre5",
    question: "What is a landlord required to do for their tenants?",
    options: [
      "A. Provide free furniture",
      "B. Pay the tenant's personal bills",
      "C. Provide a safe, livable space and handle repairs",
      "D. Visit the home anytime without notice"
    ],
    correctAnswer: "C",
    explanation: "Landlords must provide a safe and livable space, handle repairs, meet health and safety standards, and respect your privacy."
  },
  {
    id: "pre6",
    question: "Why is creating a budget before living on your own important?",
    options: [
      "A. It guarantees you'll become rich",
      "B. It helps you track spending and avoid overspending",
      "C. It removes the need to pay any bills",
      "D. It lets you ignore your expenses"
    ],
    correctAnswer: "B",
    explanation: "A budget helps you track expenses and prevents overspending. It's like a roadmap for your money that helps you plan for the unexpected."
  },
  {
    id: "pre7",
    question: "What should you do before signing a lease agreement?",
    options: [
      "A. Sign it quickly before someone else does",
      "B. Skip the fine print to save time",
      "C. Rely only on a friend's summary",
      "D. Read and understand every clause, and ask questions"
    ],
    correctAnswer: "D",
    explanation: "Always read and understand every term in the lease. Never sign anything you don't fully understand - ask questions first!"
  },
  {
    id: "pre8",
    question: "What can happen if you regularly spend more than your monthly income?",
    options: [
      "A. You build up savings automatically",
      "B. You accumulate debt and financial stress",
      "C. Your rent gets cheaper",
      "D. Nothing changes at all"
    ],
    correctAnswer: "B",
    explanation: "Spending more than you earn leads to debt. You end up borrowing money or using credit, which can cause serious financial stress later on."
  }
];

export const preTestComplete = `Awesome job completing the Pre-Test!

You've shown me where you're starting from, and now we're going to build on that knowledge together.

This part of the LaunchPad Financial Literacy program is designed to help students learn independently outside the classroom.

Let's dive into Topic 1!`;

export const lesson2Topics: LessonTopic[] = [
  {
    id: "topic1",
    title: "Earning a Living & Managing Your Time Wisely",
    content: `When you live on your own, every hour has value. The way you spend your time directly affects your ability to earn, learn, and grow.

Freedom can be exciting - but it's also deceptive. If you spend too much time just hanging out, sleeping in, or scrolling on your phone, you might miss opportunities that move your life forward.

Earning a living means more than just having a job - it's about developing discipline, showing up on time, and learning the habits that help you succeed long-term.

Time is your most valuable asset, and unlike money, you can't earn it back once it's gone.`,
    analogy: "Think of your day like a paycheck. Every 24 hours, you get a new 'deposit' of time. How you budget it determines your results. Spend it wisely on things that build your skills, health, and relationships - and you'll always be 'time rich.' Waste it on distractions, and that account goes broke fast.",
    scenario: "You start your first job after graduation. At first, you love the freedom - no parents, no teachers. But after a few late nights and missed alarms, you notice your paychecks are short and your bills pile up. That's when you realize: freedom isn't about doing anything you want - it's about managing your time so you can do everything you need.",
    discussionQuestion: "How can you balance enjoying your freedom with being responsible for your work and goals?"
  },
  {
    id: "topic2",
    title: "What Independence Really Means",
    content: `Living on your own doesn't just mean moving out - it means stepping into a new level of maturity.

Whether you're moving into a dorm, military housing, or your own apartment, independence requires managing time, money, and responsibilities.

When you live alone, you handle everything from budgeting to cleaning to paying bills. It's your life, your rules - but also your responsibility.`,
    analogy: "Think of independence like running your own mini business. You're the CEO of You, Inc., responsible for managing income, expenses, and operations.",
    scenario: "You've just graduated and landed a job earning $2,500 a month. Rent is $1,200, utilities are $150, and groceries cost $300. Suddenly, that paycheck doesn't stretch as far as you thought. What adjustments can you make to stay on budget?",
    discussionQuestion: "What's one new responsibility you'll have when you start living on your own - and how will you prepare for it?"
  },
  {
    id: "topic3",
    title: "The Real Cost of Living",
    content: `Many students underestimate how expensive independence can be.

Rent, food, utilities, transportation, and personal expenses can add up fast. Beyond the basics, there are hidden costs like internet service, laundry, and maintenance supplies.

That's why creating a detailed budget before moving out is essential.`,
    analogy: "Think of your budget like a map - it helps you get where you're going without getting lost.",
    scenario: "You plan to share an apartment with a friend, but your share of rent and utilities still adds up to $1,000 a month. How can you make room in your budget for savings and emergencies?",
    discussionQuestion: "Which expense might surprise you most once you're living independently - and why?"
  },
  {
    id: "topic4",
    title: "Rights and Responsibilities of Tenants and Landlords",
    content: `Understanding your rights and responsibilities keeps you protected.

As a tenant, you must pay rent on time, take care of the property, and report maintenance issues.

Your landlord must provide safe living conditions, handle repairs promptly, and respect your privacy.

Knowing these rules helps prevent conflicts and keeps your housing stable.`,
    analogy: "Think of the tenant-landlord relationship like a team project - each side has responsibilities that make the living arrangement work.",
    scenario: "Your heat goes out in the middle of winter. You report it, and the landlord fixes it quickly. That's how the system is supposed to work - you do your part, they do theirs.",
    discussionQuestion: "Why is it important to understand both your rights and your responsibilities when renting a place?"
  },
  {
    id: "topic5",
    title: "Budgeting for Independent Living",
    content: `Budgeting is your survival tool when living alone.

Start with your monthly income and subtract essential expenses like rent, utilities, and groceries. Then plan for savings, emergencies, and fun.

Tracking where your money goes keeps you from running out before the month ends.`,
    analogy: "A budget is like a workout plan for your money - it strengthens your financial health and keeps you disciplined.",
    scenario: "You budget $250 for groceries, but you've spent $300 by the third week. You decide to cook more at home and cut back on fast food next month to stay within budget.",
    discussionQuestion: "What's one way you could track or control your spending when you're living on your own?"
  },
  {
    id: "topic6",
    title: "Reading and Understanding Lease Agreements",
    content: `A lease is a legal document that outlines the rules of your rental.

It details your rent amount, due dates, length of stay, and responsibilities.

LaunchPad Money Mentor tip: Always read the fine print! Make sure you understand what happens if you break the lease early, have a roommate, or want to renew.`,
    analogy: "Think of your lease as a playbook - it tells everyone their role and what's expected.",
    scenario: "You find a great apartment but notice a clause about 'no pets.' You have a cat. What should you do? Ask questions before signing, or you could face penalties later.",
    discussionQuestion: "What's one question you'd ask a landlord before signing a lease?"
  }
];

export const postTestIntro = `Alright, it's quiz time!

Let's see how much you've learned about living independently, managing money, and making smart choices.

I'll ask you 10 multiple-choice questions. Read carefully and choose the best answer for each one!`;

export const lesson2PostTest: PostTestQuestion[] = [
  {
    id: "post1",
    question: "Living on your own means:",
    options: [
      "A. Total freedom with no responsibilities",
      "B. Managing personal, financial, and household responsibilities",
      "C. Having someone else handle your bills",
      "D. Moving back home after every mistake"
    ],
    correctAnswer: "B",
    explanation: "Living on your own is about managing personal, financial, and household responsibilities independently. It's freedom WITH responsibility!"
  },
  {
    id: "post2",
    question: "Which of the following best shows independence?",
    options: [
      "A. Ignoring your bills",
      "B. Planning meals and paying rent on time",
      "C. Waiting for reminders from parents",
      "D. Spending all your income at once"
    ],
    correctAnswer: "B",
    explanation: "True independence means taking responsibility - planning ahead, paying bills on time, and managing your own affairs!"
  },
  {
    id: "post3",
    question: "Managing your time wisely helps you:",
    options: [
      "A. Earn more opportunities",
      "B. Have less structure in your day",
      "C. Sleep through important meetings",
      "D. Avoid planning ahead"
    ],
    correctAnswer: "A",
    explanation: "When you manage time well, you create more opportunities for growth, learning, and earning!"
  },
  {
    id: "post4",
    question: "Earning a living includes:",
    options: [
      "A. Doing as little work as possible",
      "B. Building discipline and showing up consistently",
      "C. Only working when you feel like it",
      "D. Avoiding long-term goals"
    ],
    correctAnswer: "B",
    explanation: "Earning a living is about developing discipline, being reliable, and building habits that lead to long-term success!"
  },
  {
    id: "post5",
    question: "Which of these is a fixed expense?",
    options: [
      "A. Groceries",
      "B. Rent",
      "C. Gas for your car",
      "D. Entertainment"
    ],
    correctAnswer: "B",
    explanation: "Rent is a fixed expense - it stays the same each month. Groceries, gas, and entertainment can vary!"
  },
  {
    id: "post6",
    question: "Why is a budget important?",
    options: [
      "A. It limits your freedom",
      "B. It helps you track spending and plan ahead",
      "C. It makes life complicated",
      "D. It means you can't have fun"
    ],
    correctAnswer: "B",
    explanation: "A budget is a tool that helps you track spending, plan for the future, and actually have MORE freedom because you're in control!"
  },
  {
    id: "post7",
    question: "Before signing a lease, you should:",
    options: [
      "A. Read it carefully and ask questions",
      "B. Sign it quickly before anyone else does",
      "C. Ignore the small print",
      "D. Rely on your friend's summary"
    ],
    correctAnswer: "A",
    explanation: "Always read every part of a lease and ask questions about anything you don't understand. Never sign something you haven't fully read!"
  },
  {
    id: "post8",
    question: "A landlord must:",
    options: [
      "A. Fix unsafe conditions and provide a livable space",
      "B. Let tenants handle all repairs",
      "C. Change rent amounts randomly",
      "D. Ignore maintenance requests"
    ],
    correctAnswer: "A",
    explanation: "Landlords are legally required to maintain safe, livable conditions and handle necessary repairs!"
  },
  {
    id: "post9",
    question: "Managing your time well means:",
    options: [
      "A. Doing everything at the last minute",
      "B. Prioritizing what matters most",
      "C. Wasting time on distractions",
      "D. Avoiding schedules"
    ],
    correctAnswer: "B",
    explanation: "Good time management is about prioritizing what's important and making sure the most valuable things get done!"
  },
  {
    id: "post10",
    question: "What's the best habit for living independently?",
    options: [
      "A. Waiting for others to solve problems",
      "B. Taking responsibility for your actions and choices",
      "C. Ignoring your financial situation",
      "D. Spending money as soon as you earn it"
    ],
    correctAnswer: "B",
    explanation: "The #1 habit for independent living is taking responsibility for your own actions, choices, and finances!"
  }
];

export const lesson2Completion = `Congratulations! You've completed the Living on Your Own module!

Remember, independence is about more than just living in your own space - it's about owning your choices, managing your money wisely, and staying focused on your goals.

Whether you're headed to college, joining the military, or starting your first job, you now have the tools to make smart decisions that will help you thrive.

This is part of the LaunchPad Financial Literacy program, designed to help students learn independently outside the classroom.

Keep growing, keep learning, and keep believing in your power to lead your own life!

Type "menu" to go back to the lesson selection, or ask me any questions about living on your own!`;
