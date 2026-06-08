import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Lock,
  Rocket,
  BookOpen,
  Brain,
  DollarSign,
} from "lucide-react";
import launchpadLogo from "@/assets/launchpad-logo.png";

const DEMO_LESSONS = [
  {
    number: 1,
    title: "Earning Money",
    description:
      "Discover different ways to earn income and build your financial foundation.",
    icon: DollarSign,
  },
  {
    number: 2,
    title: "Living on Your Own",
    description:
      "Learn to budget for rent, utilities, groceries, and everyday expenses.",
    icon: BookOpen,
  },
  {
    number: 3,
    title: "Understanding Wants & Needs",
    description:
      "Master the difference between necessities and desires to make smarter choices.",
    icon: Brain,
  },
];

const FULL_VERSION_FEATURES = [
  "AI-powered financial mentor chat",
  "Pre & post-lesson quizzes with scoring",
  "Interactive multi-topic lessons",
  "Progress tracking & grade dashboard",
  "Resume lessons anytime",
  "Completion badges & PDF certificates",
];

/**
 * Public demo landing page. Shows what the demo includes and links to demo signup.
 * @returns The rendered Demo landing page component.
 */
export default function Demo() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Sticky header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <img src={launchpadLogo} alt="LaunchPad" className="h-10 w-auto" />
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/demo/signup">
              <Button size="sm">Try Free Demo</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
        <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
          Free Demo — No Credit Card Required
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 font-display leading-tight">
          Try LaunchPad Free
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Experience 3 interactive financial literacy lessons with AI-powered
          guidance. See how LaunchPad helps students master money management.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/demo/signup">
            <Button size="lg" className="px-8 font-bold text-base w-full sm:w-auto">
              <Rocket className="w-5 h-5 mr-2" />
              Start Free Demo
            </Button>
          </Link>
          <Link to="/login">
            <Button
              size="lg"
              variant="outline"
              className="px-8 text-base w-full sm:w-auto"
            >
              Already have an account? Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Demo lessons */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Included in Your Demo
          </h2>
          <p className="text-muted-foreground">
            3 of 14 lessons available — upgrade anytime to unlock them all
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {DEMO_LESSONS.map((lesson) => {
            const Icon = lesson.icon;
            return (
              <div
                key={lesson.number}
                className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6 relative"
              >
                <Badge className="absolute top-4 right-4 bg-primary/10 text-primary border-primary/20 text-xs">
                  Included
                </Badge>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs font-medium text-primary mb-1">
                  Lesson {lesson.number}
                </p>
                <h3 className="font-semibold text-foreground mb-2">
                  {lesson.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {lesson.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Locked teaser */}
        <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center">
          <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground mb-1">
            11 More Lessons in the Full Version
          </p>
          <p className="text-sm text-muted-foreground">
            Saving & Investing · Budgeting · Credit Score · Tax Deductions ·
            Consumer Privacy · and more.
          </p>
        </div>
      </section>

      {/* What you get */}
      <section className="bg-muted/30 border-y border-border py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            What You Get in the Demo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FULL_VERSION_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-foreground mb-3">
          Ready to get started?
        </h2>
        <p className="text-muted-foreground mb-8">
          Create your free demo account in under a minute.
        </p>
        <Link to="/demo/signup">
          <Button size="lg" className="px-10 font-bold text-base">
            <Rocket className="w-5 h-5 mr-2" />
            Create Free Demo Account
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} LaunchPad Money Mentor. All rights
          reserved.
        </p>
      </footer>
    </div>
  );
}
