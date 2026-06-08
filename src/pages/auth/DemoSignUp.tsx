import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import launchpadLogo from "@/assets/launchpad-logo.png";

/** Sentinel value stored in group_name to identify demo accounts. */
export const DEMO_GROUP_NAME = "__demo__";

/**
 * Demo signup page. Creates a student account with access to 3 lessons only.
 * No invite link or organization required.
 * @returns The rendered DemoSignUp component.
 */
export default function DemoSignUp() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /**
   * Creates a demo student account: auth user + profile with demo group flag.
   * @param e - Form submit event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // 1. Create auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });

      if (signUpError) throw new Error(signUpError.message);
      if (!data.user) throw new Error("Account creation failed. Please try again.");

      // Wait for the Supabase auth lock to settle before making a DB call.
      // signUp() triggers onAuthStateChange which holds the auth storage lock;
      // the immediate profile insert competes for the same lock without this delay.
      await new Promise<void>((r) => setTimeout(r, 500));

      // 2. Create student profile tagged as demo (upsert for idempotency)
      const profilePayload = {
        id: data.user.id,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        role: "student",
        group_name: DEMO_GROUP_NAME,
        created_at: new Date().toISOString(),
      };

      let { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });

      if (profileError) {
        // One retry after an additional delay in case the lock was still contested.
        await new Promise<void>((r) => setTimeout(r, 600));
        ({ error: profileError } = await supabase
          .from("profiles")
          .upsert(profilePayload, { onConflict: "id" }));
      }

      if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

      toast.success("Demo account created! Welcome to LaunchPad.");
      navigate("/");
    } catch (error: unknown) {
      toast.error(
        (error as { message?: string }).message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 bg-background font-sans">
      {/* Left panel */}
      <div className="hidden lg:block">
        <div className="h-full w-full bg-slate-900 relative flex flex-col items-center justify-center p-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          <div className="relative z-10 flex flex-col items-center text-white">
            <img src={launchpadLogo} alt="Logo" className="h-24 w-auto mb-8" />
            <h2 className="text-4xl font-bold mb-4">Try 3 Free Lessons</h2>
            <p className="text-slate-400 max-w-md text-lg mb-8">
              No credit card required. Explore financial literacy with our
              AI-powered mentor.
            </p>
            <div className="space-y-3 text-left w-full max-w-sm">
              {[
                "Earning Money",
                "Living on Your Own",
                "Understanding Wants & Needs",
              ].map((lesson, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3"
                >
                  <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                    Lesson {i + 1}
                  </span>
                  <span className="text-sm text-white">{lesson}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center py-12 px-6 bg-background">
        <div className="mx-auto grid w-full max-w-[400px] gap-8">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold">Create Demo Account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Free access to 3 lessons — no card needed
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  name="firstName"
                  required
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  name="lastName"
                  required
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                name="password"
                type="password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="Min. 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                name="confirmPassword"
                type="password"
                required
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </div>
            <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Create Demo Account"
              )}
            </Button>
          </form>

          <div className="space-y-2 text-center text-sm">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-bold">
                Sign in
              </Link>
            </p>
            <p className="text-muted-foreground">
              Want full access?{" "}
              <Link to="/signup" className="text-primary font-bold">
                Register your organization
              </Link>
            </p>
            <p>
              <Link to="/demo" className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2">
                Back to demo overview
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
