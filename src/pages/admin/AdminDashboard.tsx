import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CertificateModal, type CertificateStudent } from "@/components/admin/CertificateModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PURCHASING_ENABLED, PURCHASING_DISABLED_MESSAGE } from "@/config/featureFlags";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsSection } from "@/components/admin/analytics/AnalyticsSection";
import type { StudentOption } from "@/components/admin/analytics/AnalyticsControls";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  UserPlus,
  CreditCard,
  GraduationCap,
  Loader2,
  Search,
  Link,
  Copy,
  Check,
  LogOut,
  Mail,
  Building2,
  BarChart2,
  Clock,
  AlertTriangle,
  Calendar,
  Shield,
  Award,
  CalendarDays,
  Timer,
  Pencil,
  KeyRound,
  UserMinus,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CourseBundle {
  id: string;
  name: string;
  price_per_seat: number;
  bundle_type: string;
}

interface LicenseRow {
  id: string;
  student_email: string;
  course_type: string;
  is_active: boolean;
  user_id: string | null;
  bundle_id: string | null;
  expires_at: string | null;
  subscription_type: string | null;
}

interface StudentProgressRow {
  student_email: string;
  student_first_name: string;
  student_last_name: string;
  bundle_name: string | null;
  lessons_completed: number;
  total_lessons: number;
  average_score: number;
  last_activity: string | null;
  expires_at: string | null;
}

interface BundleSeatSummary {
  bundle_id: string;
  bundle_name: string;
  purchased: number;
  assigned: number;
  available: number;
}

/** Donut chart colors for per-bundle breakdown (cycles if more than 5 bundles) */
const BUNDLE_COLORS = [
  "hsl(160 84% 39%)",  // primary teal
  "hsl(28 95% 55%)",   // secondary orange
  "hsl(142 71% 45%)",  // green-500
  "hsl(210 100% 56%)", // blue
  "hsl(270 67% 55%)",  // purple
];

export default function AdminDashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, used: 0 });
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [students, setStudents] = useState<LicenseRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Share Link popover state
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Remove-student (revoke access) confirmation state
  const [studentToRemove, setStudentToRemove] = useState<LicenseRow | null>(null);
  const [removingStudent, setRemovingStudent] = useState(false);

  // Buy Seats dialog state
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [bundles, setBundles] = useState<CourseBundle[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");
  const [seatQuantity, setSeatQuantity] = useState(1);
  const [checkingOut, setCheckingOut] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<string>("academic_year");

  // Bundle name map for Participant Directory (bundle_id -> bundle name)
  const [bundleNames, setBundleNames] = useState<Record<string, string>>({});

  // Per-bundle seat summary (from RPC get_bundle_seat_summary)
  const [bundleSummary, setBundleSummary] = useState<BundleSeatSummary[]>([]);

  // Selected bundle for the Assign New Seat form
  const [assignBundleId, setAssignBundleId] = useState<string>("");

  // Per-bundle magic invite link: tracks which bundle's link is being minted /
  // was just copied (for button spinner + "Copied" feedback).
  const [invitingLinkBundleId, setInvitingLinkBundleId] = useState<string | null>(null);
  const [copiedBundleId, setCopiedBundleId] = useState<string | null>(null);

  // Student progress summary (Feature 2)
  const [studentProgress, setStudentProgress] = useState<StudentProgressRow[]>([]);

  // Subscription status (populated from org row)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("none");
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Org creation date (for "Member Since")
  const [orgCreatedAt, setOrgCreatedAt] = useState<string | null>(null);

  // Certificate modal
  const [certStudent, setCertStudent] = useState<CertificateStudent | null>(null);

  // Edit profile dialog
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editOrgName, setEditOrgName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Read ?payment= URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      toast.success("Payment successful! Your seats have been added.");
    } else if (payment === "cancelled") {
      toast.error("Payment was cancelled.");
    }
    if (payment) {
      params.delete("payment");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  // Effect 1: fetch org data when user is available, then set orgId
  useEffect(() => {
    if (!user) return;

    const fetchOrgData = async (): Promise<void> => {
      try {
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("*")
          .eq("admin_id", user.id)
          .maybeSingle();

        if (orgError) {
          toast.error("Failed to load organization data.");
        }

        if (org) {
          setStats({ total: org.total_seats, used: org.used_seats });
          setOrgName(org.name ?? "");
          // Fall back to "active" if the org has seats but the column is not yet set
          const derivedStatus = org.subscription_status && org.subscription_status !== "none"
            ? org.subscription_status
            : (org.total_seats > 0 ? "active" : "none");
          setSubscriptionStatus(derivedStatus);
          setStripeCustomerId(org.stripe_customer_id ?? null);
          setOrgCreatedAt(org.created_at ?? null);
          setOrgId(org.id); // triggers Effect 2
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };

    fetchOrgData();
  }, [user]);

  /**
   * Fetches bundle names for the given license rows and populates bundleNames map.
   * @param licenses - Array of license rows containing bundle_id values.
   * @returns Promise<void>
   */
  const fetchBundleNamesForLicenses = async (licenses: LicenseRow[]): Promise<void> => {
    const ids = [...new Set(licenses.map((l) => l.bundle_id).filter(Boolean))] as string[];
    if (ids.length === 0) return;

    const { data } = await supabase
      .from("course_bundles")
      .select("id, name")
      .in("id", ids);

    if (data) {
      const map: Record<string, string> = {};
      data.forEach((b) => { map[b.id] = b.name; });
      setBundleNames(map);
    }
  };

  /**
   * Calls the get_bundle_seat_summary RPC to get per-bundle seat availability for the org.
   * @param id - The organization's UUID.
   * @returns Promise<void>
   */
  const fetchBundleSummary = async (id: string): Promise<void> => {
    const { data, error } = await (supabase as any).rpc("get_bundle_seat_summary", {
      org_id_param: id,
    });

    if (error) {
      toast.error("Failed to load bundle seat summary.");
      return;
    }

    setBundleSummary((data as BundleSeatSummary[]) ?? []);
  };

  /**
   * Calls get_student_progress_summary RPC to populate the Student Progress section.
   * @param id - The organization's UUID.
   * @returns Promise<void>
   */
  const fetchStudentProgress = async (id: string): Promise<void> => {
    const { data, error } = await (supabase as any).rpc("get_student_progress_summary", {
      org_id_param: id,
    });

    if (error) {
      console.error("AdminDashboard: student progress fetch failed:", error.message);
      toast.error(`Failed to load student progress: ${error.message}`);
      return;
    }

    setStudentProgress((data as StudentProgressRow[]) ?? []);
  };

  // Effect 2: fetch licenses and bundle summary once orgId is set
  useEffect(() => {
    if (!orgId) return;

    const fetchLicenses = async (): Promise<void> => {
      try {
        const { data: licenses, error: licensesError } = await supabase
          .from("licenses")
          .select("id, student_email, course_type, is_active, user_id, bundle_id, expires_at, subscription_type")
          .eq("org_id", orgId);

        if (licensesError) {
          toast.error("Failed to load licenses.");
        }

        const rows = (licenses as LicenseRow[]) || [];
        setStudents(rows);
        await fetchBundleNamesForLicenses(rows);
        await fetchBundleSummary(orgId);
        await fetchStudentProgress(orgId);
      } catch {
        // no-op
      } finally {
        setLoading(false);
      }
    };

    fetchLicenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  /**
   * Refreshes org stats, licenses, and bundle summary after a mutation (e.g. invite).
   * @returns Promise<void>
   */
  const fetchDashboardData = async (): Promise<void> => {
    if (!user || !orgId) return;

    try {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("admin_id", user.id)
        .maybeSingle();

      if (orgError) {
        toast.error("Failed to refresh organization data.");
      }

      if (org) {
        setStats({ total: org.total_seats, used: org.used_seats });
        setOrgName(org.name ?? "");
        const derivedStatus = org.subscription_status && org.subscription_status !== "none"
          ? org.subscription_status
          : (org.total_seats > 0 ? "active" : "none");
        setSubscriptionStatus(derivedStatus);
        setStripeCustomerId(org.stripe_customer_id ?? null);
        setOrgCreatedAt(org.created_at ?? null);
      }

      const { data: licenses, error: licensesError } = await supabase
        .from("licenses")
        .select("id, student_email, course_type, is_active, user_id, bundle_id, expires_at, subscription_type")
        .eq("org_id", orgId);

      if (licensesError) {
        toast.error("Failed to refresh licenses.");
      }

      const rows = (licenses as LicenseRow[]) || [];
      setStudents(rows);
      await fetchBundleNamesForLicenses(rows);
      await fetchBundleSummary(orgId);
      await fetchStudentProgress(orgId);
    } catch {
      // no-op
    }
  };

  /**
   * Fetches all available course bundles from Supabase and opens the Buy Seats dialog.
   * @returns Promise<void>
   */
  const handleOpenBuyDialog = async (): Promise<void> => {
    // LAUNCH-PHASE LOCKDOWN: block self-service purchasing while Stripe is in test mode.
    if (!PURCHASING_ENABLED) {
      toast.info(PURCHASING_DISABLED_MESSAGE);
      return;
    }

    const { data, error } = await supabase
      .from("course_bundles")
      .select("id, name, price_per_seat, bundle_type")
      .eq("bundle_type", "student");

    if (error) {
      toast.error("Failed to load bundles. Please try again.");
      return;
    }

    setBundles((data as CourseBundle[]) ?? []);
    setSelectedBundleId("");
    setSeatQuantity(1);
    setSubscriptionType("academic_year");
    setBuyDialogOpen(true);
  };

  /**
   * Posts to the create-checkout-session Edge Function and redirects to Stripe.
   * @returns Promise<void>
   */
  const handleConfirmPurchase = async (): Promise<void> => {
    // LAUNCH-PHASE LOCKDOWN: defense-in-depth — never hit checkout while disabled.
    if (!PURCHASING_ENABLED) {
      toast.info(PURCHASING_DISABLED_MESSAGE);
      setBuyDialogOpen(false);
      return;
    }

    if (!selectedBundleId || !orgId) return;

    setCheckingOut(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            org_id: orgId,
            bundle_id: selectedBundleId,
            quantity: seatQuantity,
            subscription_type: subscriptionType,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.url) {
        toast.error(json.error ?? "Failed to create checkout session.");
        return;
      }

      window.location.href = json.url;
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  /**
   * Mints (or fetches) the per-bundle magic invite code and copies the full
   * /signup?code=... link to the clipboard for the admin to share. Every bundle
   * gets its own unique link; students joining via it receive that exact bundle.
   * @param bundleId - The bundle to generate the shareable invite link for.
   * @returns Promise<void>
   */
  const handleCopyInviteLink = async (bundleId: string): Promise<void> => {
    if (!orgId) {
      toast.error("Organization not loaded. Please refresh and try again.");
      return;
    }

    setInvitingLinkBundleId(bundleId);
    try {
      const { data: code, error } = await (supabase as any).rpc(
        "get_or_create_bundle_invite_code",
        { org_id_param: orgId, bundle_id_param: bundleId }
      );

      if (error || !code) {
        toast.error(error?.message ?? "Failed to generate invite link.");
        return;
      }

      const link = `${window.location.origin}/signup?code=${encodeURIComponent(code as string)}`;
      await navigator.clipboard.writeText(link);

      setCopiedBundleId(bundleId);
      setTimeout(() => setCopiedBundleId((cur) => (cur === bundleId ? null : cur)), 2000);
      toast.success(`Invite link copied! (${code})`);
    } catch {
      toast.error("Could not copy the invite link. Please try again.");
    } finally {
      setInvitingLinkBundleId(null);
    }
  };

  /**
   * Assigns a license (for the selected bundle) to a new student email and sends the invite link.
   * @param e - Form submit event.
   * @returns Promise<void>
   */
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignBundleId) {
      toast.error("Please select a bundle to assign.");
      return;
    }

    const selectedSummary = bundleSummary.find((b) => b.bundle_id === assignBundleId);
    if (!selectedSummary || selectedSummary.available <= 0) {
      toast.error("No seats available for the selected bundle.");
      return;
    }

    setInviting(true);
    try {
      if (!orgId) {
        toast.error("Organization not loaded. Please refresh and try again.");
        return;
      }

      const { error } = await supabase.from("licenses").insert({
        org_id: orgId,
        student_email: newStudentEmail,
        course_type: "Fundamentals",
        bundle_id: assignBundleId,
      });

      if (error) throw error;

      await supabase.rpc("increment_used_seats", { org_id_param: orgId });

      // Send invite email — non-blocking: a failure here does not roll back the license
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const emailRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ student_email: newStudentEmail, org_name: orgName }),
        }
      );

      if (emailRes.ok) {
        const emailJson = await emailRes.json();
        const signupLink = emailJson.signupLink as string;
        toast.success(`Invitation ready! Share this link: ${signupLink}`);
      } else {
        toast.warning("License assigned but invite link generation failed");
      }

      setNewStudentEmail("");
      setAssignBundleId("");
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || "Invitation failed");
    } finally {
      setInviting(false);
    }
  };

  /**
   * Revokes a student's access by deleting their license row, which returns the
   * seat to the org's pool (the seat RPC counts licenses, so removal frees it).
   * If the student had already signed up, their next visit shows a professional
   * "access unavailable" screen (see useStudentBundle `noAccess`).
   * @param license - The license row to remove.
   * @returns Promise<void>
   */
  const handleRemoveStudent = async (license: LicenseRow): Promise<void> => {
    if (!orgId) return;
    setRemovingStudent(true);
    try {
      const { error: delError } = await supabase
        .from("licenses")
        .delete()
        .eq("id", license.id);

      if (delError) throw delError;

      // Return the seat to the pool (mirrors increment_used_seats on assign).
      await supabase.rpc("decrement_used_seats", { org_id_param: orgId });

      toast.success(`Access removed for ${license.student_email}. Seat returned to your pool.`);
      setStudentToRemove(null);
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove student.");
    } finally {
      setRemovingStudent(false);
    }
  };

  /**
   * Opens the Stripe Billing Portal so the admin can manage their subscription,
   * update payment method, or view invoices.
   * @returns Promise<void>
   */
  const handleManageBilling = async (): Promise<void> => {
    if (!orgId) return;
    setOpeningPortal(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ org_id: orgId }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.url) {
        toast.error(json.error ?? "Failed to open billing portal.");
        return;
      }

      window.location.href = json.url;
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setOpeningPortal(false);
    }
  };

  /**
   * Opens the edit profile dialog pre-populated with current values.
   */
  const handleOpenEditProfile = (): void => {
    setEditFirstName(profile?.first_name ?? "");
    setEditLastName(profile?.last_name ?? "");
    setEditOrgName(orgName);
    setEditProfileOpen(true);
  };

  /**
   * Saves the edited display name and org name to Supabase, then refreshes the profile.
   * @returns Promise<void>
   */
  const handleSaveProfile = async (): Promise<void> => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ first_name: editFirstName.trim(), last_name: editLastName.trim() })
        .eq("id", user.id);

      if (profileErr) {
        toast.error("Failed to update profile.");
        return;
      }

      if (orgId && editOrgName.trim()) {
        const { error: orgErr } = await supabase
          .from("organizations")
          .update({ name: editOrgName.trim() })
          .eq("id", orgId);

        if (orgErr) {
          toast.error("Failed to update organization name.");
          return;
        }
        setOrgName(editOrgName.trim());
      }

      await refreshProfile();
      toast.success("Profile updated.");
      setEditProfileOpen(false);
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setSavingProfile(false);
    }
  };

  const adminFirstName = profile?.first_name || null;
  const adminDisplayName = profile
    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || user?.email
    : user?.email;

  const filteredStudents = searchQuery.trim()
    ? students.filter((s) =>
        s.student_email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students;

  // Roster for the analytics student filter: signed-up students (have a user_id),
  // de-duplicated by user_id, labeled by email.
  const analyticsRoster: StudentOption[] = (() => {
    const seen = new Set<string>();
    const out: StudentOption[] = [];
    for (const s of students) {
      if (s.user_id && !seen.has(s.user_id)) {
        seen.add(s.user_id);
        out.push({ userId: s.user_id, label: s.student_email });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  })();

  const selectedBundle = bundles.find((b) => b.id === selectedBundleId);
  const totalPrice = selectedBundle
    ? (selectedBundle.price_per_seat * seatQuantity).toFixed(2)
    : null;

  const availableCount = Math.max(0, stats.total - stats.used);
  const usedPct = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;

  // ── Subscription timeline derived from the latest-expiring license ──────
  const latestLicense = [...students]
    .filter((s) => s.expires_at)
    .sort((a, b) => new Date(b.expires_at!).getTime() - new Date(a.expires_at!).getTime())[0] ?? null;

  const orgExpiresAt = latestLicense?.expires_at ? new Date(latestLicense.expires_at) : null;
  const orgSubscriptionType = latestLicense?.subscription_type ?? null;

  const subscriptionStartDate: Date | null = (() => {
    if (!orgExpiresAt || !orgSubscriptionType) return null;
    const d = new Date(orgExpiresAt);
    if (orgSubscriptionType === "summer_camp") d.setDate(d.getDate() - 42);
    else d.setMonth(d.getMonth() - 10);
    return d;
  })();

  const now = new Date();
  const daysRemaining = orgExpiresAt
    ? Math.max(0, Math.ceil((orgExpiresAt.getTime() - now.getTime()) / 86_400_000))
    : null;

  const totalDays = orgSubscriptionType === "summer_camp" ? 42 : 304;
  const daysUsed = subscriptionStartDate
    ? Math.max(0, Math.floor((now.getTime() - subscriptionStartDate.getTime()) / 86_400_000))
    : 0;
  const timeUsedPct = Math.min(100, Math.round((daysUsed / totalDays) * 100));

  const daysColor =
    daysRemaining === null ? "text-muted-foreground"
    : daysRemaining <= 7   ? "text-red-600"
    : daysRemaining <= 30  ? "text-orange-500"
    : "text-green-600";

  const barColor =
    daysRemaining === null ? "bg-muted"
    : daysRemaining <= 7   ? "bg-red-500"
    : daysRemaining <= 30  ? "bg-orange-500"
    : "bg-green-500";

  const planLabel = orgSubscriptionType === "summer_camp"
    ? "Summer Camp / Youth Development"
    : orgSubscriptionType === "academic_year"
    ? "School / Workforce Preparation"
    : null;

  const billingLabel = orgSubscriptionType === "summer_camp"
    ? "One-time · 6-week access"
    : orgSubscriptionType === "academic_year"
    ? "Monthly recurring · 10-month term"
    : null;

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Per-bundle chart: each bundle is one segment; value = total purchased seats
  const chartData = bundleSummary
    .filter((b) => b.purchased > 0)
    .map((b, i) => ({
      name: b.bundle_name,
      value: b.purchased,
      available: b.available,
      color: BUNDLE_COLORS[i % BUNDLE_COLORS.length],
    }));

  // Bundles with seats still available (for Assign form dropdown)
  const assignableBundles = bundleSummary.filter((b) => b.available > 0);
  const noSeatsAvailable = bundleSummary.length > 0 && assignableBundles.length === 0;
  const selectedAssignSummary = bundleSummary.find((b) => b.bundle_id === assignBundleId);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10 space-y-8 animate-fade-in">

      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-soft"
           style={{ background: "linear-gradient(135deg, hsl(160 84% 39%), hsl(180 70% 45%))" }}>
        <div className="px-6 py-8 lg:px-10 lg:py-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-primary-foreground/70" />
              <span className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-widest">
                {orgName || "Organization"}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary-foreground">
              Welcome back{adminFirstName ? `, ${adminFirstName}` : ""}!
            </h1>
            <p className="text-primary-foreground/75 mt-1 text-sm">
              Here's what's happening with your program today.
            </p>

            {/* Subscription status pill */}
            {subscriptionStatus === "active" && (
              <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-400/20 text-green-100 border border-green-300/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                Monthly Subscription Active
              </span>
            )}
            {subscriptionStatus === "past_due" && (
              <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-400/20 text-red-100 border border-red-300/30">
                <span className="w-1.5 h-1.5 rounded-full bg-red-300" />
                Payment Past Due
              </span>
            )}
            {subscriptionStatus === "cancelled" && (
              <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/60 border border-white/20">
                Subscription Ended
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Admin chip */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 text-sm text-primary-foreground">
              <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center font-bold text-sm">
                {(profile?.first_name?.[0] ?? user?.email?.[0] ?? "A").toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="font-semibold truncate max-w-[120px]">{adminDisplayName}</p>
                <p className="text-[10px] text-primary-foreground/60 uppercase tracking-wider">Admin</p>
              </div>
            </div>

            {/* Manage Billing — only shown for subscription orgs */}
            {stripeCustomerId && (
              <Button
                className="bg-white/20 hover:bg-white/30 text-primary-foreground border border-white/30 backdrop-blur-sm shadow-none font-semibold"
                onClick={handleManageBilling}
                disabled={openingPortal}
              >
                {openingPortal ? (
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Manage Billing
              </Button>
            )}

            <Button
              className="bg-white/20 hover:bg-white/30 text-primary-foreground border border-white/30 backdrop-blur-sm shadow-none font-semibold"
              onClick={handleOpenBuyDialog}
            >
              <CreditCard className="mr-2 h-4 w-4" /> Buy More Seats
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              title="Sign out"
              className="text-primary-foreground hover:bg-white/20 border border-white/20"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabbed body: Overview vs Reports & Analytics ─────────────── */}
      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Reports &amp; Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-0">

      {/* ── Past-due warning banner ──────────────────────────────────── */}
      {subscriptionStatus === "past_due" && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">Payment Past Due</p>
            <p className="text-sm text-destructive/80 mt-0.5">
              Your last monthly payment failed. Student access will be suspended shortly.
              Please update your payment method to keep subscriptions active.
            </p>
          </div>
          {stripeCustomerId && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleManageBilling}
              disabled={openingPortal}
              className="shrink-0"
            >
              {openingPortal ? <Loader2 className="animate-spin h-4 w-4" /> : "Update Payment"}
            </Button>
          )}
        </div>
      )}

      {/* ── Admin Profile + Subscription Overview ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Admin Profile */}
        <Card className="border-none shadow-card bg-card">
          <CardContent className="p-6">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="shrink-0">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-display font-bold text-primary-foreground shadow-soft"
                    style={{ background: "linear-gradient(135deg, hsl(160 84% 39%), hsl(180 70% 45%))" }}
                  >
                    {(profile?.first_name?.[0] ?? user?.email?.[0] ?? "A").toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-display font-bold text-foreground truncate">
                  {adminDisplayName}
                </h3>
                <p className="text-sm text-muted-foreground truncate mt-0.5">{user?.email}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
                    <Shield className="h-3 w-3" /> Administrator
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-muted text-muted-foreground">
                    <Building2 className="h-3 w-3" /> {orgName || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Organization</p>
                <p className="text-sm font-medium text-foreground mt-0.5 truncate">{orgName || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Role</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Organization Admin</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Total Seats</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{stats.total} purchased · {stats.used} used</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Member Since</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {orgCreatedAt ? fmt(new Date(orgCreatedAt)) : "—"}
                </p>
              </div>
            </div>

            {/* Edit profile actions */}
            <div className="mt-4 flex gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={handleOpenEditProfile}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Profile
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => navigate("/profile")}
              >
                <KeyRound className="h-3.5 w-3.5" /> Security Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Overview */}
        <Card className="border-none shadow-card bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg font-display font-bold">Subscription</CardTitle>
              </div>

              {/* Status badge */}
              {subscriptionStatus === "active" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-green-500/10 text-green-600 tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Active
                </span>
              )}
              {subscriptionStatus === "past_due" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-red-500/10 text-red-600 tracking-wide">
                  <AlertTriangle className="h-3 w-3" /> Past Due
                </span>
              )}
              {subscriptionStatus === "cancelled" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-muted text-muted-foreground tracking-wide">
                  Ended
                </span>
              )}
              {(subscriptionStatus === "none" || !subscriptionStatus) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-muted text-muted-foreground tracking-wide">
                  No subscription
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {planLabel ? (
              <>
                {/* Plan + billing type */}
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{planLabel}</p>
                  <p className="text-xs text-muted-foreground">{billingLabel}</p>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Started</p>
                      <p className="text-sm font-medium text-foreground">
                        {subscriptionStartDate ? fmt(subscriptionStartDate) : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Expires</p>
                      <p className="text-sm font-medium text-foreground">
                        {orgExpiresAt ? fmt(orgExpiresAt) : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time remaining progress */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        Time Remaining
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${daysColor}`}>
                      {daysRemaining !== null
                        ? daysRemaining === 0 ? "Expired" : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left`
                        : "—"}
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${timeUsedPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{timeUsedPct}% used</span>
                    <span>{100 - timeUsedPct}% remaining</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {stripeCustomerId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handleManageBilling}
                      disabled={openingPortal}
                    >
                      {openingPortal
                        ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />
                        : <CreditCard className="h-3.5 w-3.5 mr-1.5" />}
                      Manage Billing
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className={stripeCustomerId ? "flex-1" : "w-full"}
                    onClick={handleOpenBuyDialog}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Buy More Seats
                  </Button>
                </div>
              </>
            ) : subscriptionStatus === "active" ? (
              /* Seats exist but license rows lack subscription_type yet — show generic active state */
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-sm font-semibold text-foreground">Seats Active</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your organization has {stats.total} purchased seat{stats.total !== 1 ? "s" : ""}.
                    Assign them to students from the Participant Directory below.
                  </p>
                </div>
                <div className="flex gap-2">
                  {stripeCustomerId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handleManageBilling}
                      disabled={openingPortal}
                    >
                      {openingPortal
                        ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />
                        : <CreditCard className="h-3.5 w-3.5 mr-1.5" />}
                      Manage Billing
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className={stripeCustomerId ? "flex-1" : "w-full"}
                    onClick={handleOpenBuyDialog}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Buy More Seats
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Award className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No active subscription</p>
                  <p className="text-xs text-muted-foreground mt-1">Purchase seats to get started.</p>
                </div>
                <Button size="sm" onClick={handleOpenBuyDialog}>
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Purchase Seats
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Remove Student (revoke access) confirmation ─────────────────── */}
      <AlertDialog open={!!studentToRemove} onOpenChange={(open) => !open && setStudentToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this student?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes access for{" "}
              <span className="font-semibold text-foreground">{studentToRemove?.student_email}</span>{" "}
              and returns their seat to your available pool. If they log in afterward, they&apos;ll
              be asked to contact your organization. You can re-invite them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingStudent}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removingStudent}
              onClick={(e) => {
                e.preventDefault();
                if (studentToRemove) handleRemoveStudent(studentToRemove);
              }}
            >
              {removingStudent ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Buy Seats Dialog ─────────────────────────────────────────── */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buy More Seats</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Course Bundle</label>
              <Select value={selectedBundleId} onValueChange={setSelectedBundleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bundle…" />
                </SelectTrigger>
                <SelectContent>
                  {bundles.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} — ${b.price_per_seat.toFixed(2)} / seat
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Subscription Type</label>
              <Select value={subscriptionType} onValueChange={setSubscriptionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subscription type…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summer_camp">Summer Camp / Youth Development — 6 Weeks</SelectItem>
                  <SelectItem value="academic_year">School / Workforce Preparation — 1 Academic Year (10 months)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Number of Seats</label>
              <Input
                type="number"
                min={1}
                value={seatQuantity}
                onChange={(e) =>
                  setSeatQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
              />
            </div>

            {totalPrice !== null && (
              <p className="text-sm text-muted-foreground">
                Total:{" "}
                <span className="font-semibold text-foreground">${totalPrice}</span>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyDialogOpen(false)} disabled={checkingOut}>
              Cancel
            </Button>
            <Button disabled={!selectedBundleId || checkingOut} onClick={handleConfirmPurchase}>
              {checkingOut ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Confirm &amp; Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stats Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Total Licenses */}
        <Card className="border-none shadow-card bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-right leading-tight">
                Total<br />Licenses
              </span>
            </div>
            <div className="text-5xl font-display font-bold text-foreground">{stats.total}</div>
            <p className="text-muted-foreground text-sm mt-1">Purchased seats</p>
          </CardContent>
        </Card>

        {/* Active Students */}
        <Card className="border-none shadow-card bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-green-500" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-right leading-tight">
                Active<br />Students
              </span>
            </div>
            <div className="text-5xl font-display font-bold text-foreground">{stats.used}</div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Seats used</span>
                <span className="font-semibold text-foreground">{usedPct}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Seats */}
        <Card className="border-none shadow-card bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                <UserPlus className="h-6 w-6 text-secondary" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-right leading-tight">
                Available<br />Seats
              </span>
            </div>
            <div className="text-5xl font-display font-bold text-foreground">{availableCount}</div>
            <p className="text-muted-foreground text-sm mt-1">
              {availableCount === 0 ? "All seats assigned" : "Ready to assign"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Chart + Invite Form ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Donut Chart — per-bundle breakdown */}
        <Card className="lg:col-span-2 border-none shadow-card bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display font-bold">Seat Overview</CardTitle>
            <p className="text-muted-foreground text-sm">Available seats by bundle</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-40 h-40 shrink-0">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={44}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number, name: string, props: any) => [
                          `${props.payload.available} avail / ${value} total`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    No data
                  </div>
                )}
              </div>

              <div className="space-y-3 flex-1 min-w-0">
                {chartData.length > 0 ? (
                  <>
                    {chartData.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: entry.color }} />
                          <span className="text-sm text-muted-foreground truncate">{entry.name}</span>
                        </div>
                        <span className="text-sm font-bold text-foreground shrink-0 whitespace-nowrap">
                          {entry.available} / {entry.value}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        avail / total
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {availableCount} / {stats.total}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No bundles purchased yet.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invite Students — per-bundle magic links */}
        <Card className="lg:col-span-3 border-none shadow-card bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Link className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-display font-bold">Invite Students</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Share each bundle&apos;s link — students self-enroll into that tier
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {bundleSummary.filter((b) => b.purchased > 0).length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">No bundles yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Purchase seats to generate shareable invite links.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleOpenBuyDialog}>
                  <CreditCard className="mr-2 h-4 w-4" /> Purchase Seats
                </Button>
              </div>
            ) : (
              <>
                {bundleSummary
                  .filter((b) => b.purchased > 0)
                  .map((b) => {
                    const isFull = b.available <= 0;
                    return (
                      <div
                        key={b.bundle_id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/60"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{b.bundle_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.available} of {b.purchased} seat{b.purchased !== 1 ? "s" : ""} available
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => handleCopyInviteLink(b.bundle_id)}
                          disabled={invitingLinkBundleId === b.bundle_id || isFull}
                          title={isFull ? "No seats left for this bundle" : "Copy this bundle's invite link"}
                        >
                          {invitingLinkBundleId === b.bundle_id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : copiedBundleId === b.bundle_id ? (
                            <Check className="mr-2 h-4 w-4 text-primary" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          {isFull ? "Seats full" : copiedBundleId === b.bundle_id ? "Copied!" : "Copy Invite Link"}
                        </Button>
                      </div>
                    );
                  })}
                <p className="text-xs text-muted-foreground pt-1">
                  Anyone with a bundle&apos;s link can self-enroll until that bundle&apos;s seats run out.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Student Progress ────────────────────────────────────────── */}
      {studentProgress.length > 0 && (() => {
        const now = new Date();

        /** Derive status badge for a progress row */
        const getStatus = (row: StudentProgressRow): "Completed" | "Expired" | "On Track" | "Behind" => {
          if (row.expires_at && new Date(row.expires_at) < now) return "Expired";
          if (row.lessons_completed >= row.total_lessons) return "Completed";
          if (row.last_activity && (now.getTime() - new Date(row.last_activity).getTime()) <= 7 * 24 * 60 * 60 * 1000) return "On Track";
          return "Behind";
        };

        const completedCount = studentProgress.filter(r => getStatus(r) === "Completed").length;
        const completionRate = studentProgress.length > 0 ? Math.round((completedCount / studentProgress.length) * 100) : 0;
        const avgScoreAll = studentProgress.length > 0
          ? Math.round(studentProgress.reduce((sum, r) => sum + Number(r.average_score), 0) / studentProgress.length)
          : 0;

        const statusStyles: Record<string, string> = {
          Completed: "bg-green-500/10 text-green-600",
          "On Track": "bg-primary/10 text-primary",
          Behind: "bg-orange-500/10 text-orange-600",
          Expired: "bg-red-500/10 text-red-600",
        };

        return (
          <Card className="border-none shadow-card bg-card">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-display font-bold">Student Progress</CardTitle>
                <p className="text-muted-foreground text-sm mt-0.5">Detailed progress for all active students</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-widest">
                      <th className="py-3 pl-6 pr-4 font-semibold">Student</th>
                      <th className="py-3 px-4 font-semibold">Bundle</th>
                      <th className="py-3 px-4 font-semibold">Progress</th>
                      <th className="py-3 px-4 font-semibold">Avg Score</th>
                      <th className="py-3 px-4 font-semibold">Last Active</th>
                      <th className="py-3 px-4 font-semibold">Expires</th>
                      <th className="py-3 px-4 font-semibold text-right">Status</th>
                      <th className="py-3 pl-4 pr-6 font-semibold text-right">Certificate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentProgress.map((row, idx) => {
                      const status = getStatus(row);
                      const progressPct = row.total_lessons > 0
                        ? Math.round((row.lessons_completed / row.total_lessons) * 100)
                        : 0;
                      const expiresDate = row.expires_at ? new Date(row.expires_at) : null;
                      const isExpiredRow = expiresDate ? expiresDate < now : false;
                      const isExpiringSoon = expiresDate && !isExpiredRow
                        ? (expiresDate.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000
                        : false;

                      return (
                        <tr
                          key={`${row.student_email}-${idx}`}
                          className={`text-sm transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"}`}
                        >
                          <td className="py-3.5 pl-6 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                {row.student_email[0].toUpperCase()}
                              </div>
                              <span className="font-medium text-foreground truncate max-w-[180px]">
                                {row.student_email}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {row.bundle_name ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-primary/10 text-primary tracking-wide">
                                {row.bundle_name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 min-w-[140px]">
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{row.lessons_completed} / {row.total_lessons} lessons</span>
                                <span className="font-semibold text-foreground">{progressPct}%</span>
                              </div>
                              <Progress value={progressPct} className="h-1.5" />
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-foreground">
                              {row.average_score > 0 ? `${Math.round(Number(row.average_score))}%` : "—"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground">
                            {row.last_activity ? (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                <span>{new Date(row.last_activity).toLocaleDateString()}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">No activity</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {expiresDate ? (
                              <span className={`text-sm font-medium ${
                                isExpiredRow ? "text-red-600" : isExpiringSoon ? "text-orange-500" : "text-green-600"
                              }`}>
                                {expiresDate.toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${statusStyles[status]}`}>
                              {status}
                            </span>
                          </td>
                          <td className="py-3.5 pl-4 pr-6 text-right">
                            {status === "Completed" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
                                onClick={() => setCertStudent({
                                  student_email: row.student_email,
                                  student_first_name: row.student_first_name,
                                  student_last_name: row.student_last_name,
                                  bundle_name: row.bundle_name,
                                  lessons_completed: row.lessons_completed,
                                  total_lessons: row.total_lessons,
                                  average_score: row.average_score,
                                  last_activity: row.last_activity,
                                })}
                              >
                                <Award className="h-3 w-3" /> Generate
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Summary row */}
                  <tfoot>
                    <tr className="border-t border-border bg-muted/30 text-sm font-semibold">
                      <td className="py-3 pl-6 pr-4 text-foreground">
                        {studentProgress.length} student{studentProgress.length !== 1 ? "s" : ""} total
                      </td>
                      <td className="py-3 px-4" />
                      <td className="py-3 px-4 text-foreground">
                        Completion: {completionRate}%
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        Avg: {avgScoreAll > 0 ? `${avgScoreAll}%` : "—"}
                      </td>
                      <td colSpan={4} className="py-3 pl-4 pr-6" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Participant Directory ────────────────────────────────────── */}
      <Card className="border-none shadow-card bg-card">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-xl font-display font-bold">Participant Directory</CardTitle>
            <p className="text-muted-foreground text-sm mt-0.5">
              {filteredStudents.length} of {students.length} participant{students.length !== 1 ? "s" : ""}
              {searchQuery ? " match your search" : " total"}
            </p>
          </div>
          <div className="relative w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search participants…"
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-widest">
                  <th className="py-3 pl-6 pr-4 font-semibold">Student</th>
                  <th className="py-3 px-4 font-semibold">Course</th>
                  <th className="py-3 px-4 font-semibold">Bundle</th>
                  <th className="py-3 px-4 font-semibold">Expires</th>
                  <th className="py-3 px-4 font-semibold text-right">Status</th>
                  <th className="py-3 pl-4 pr-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, idx) => {
                  const initial = s.student_email[0].toUpperCase();
                  const isEven = idx % 2 === 0;

                  // Expiry color logic
                  const now = new Date();
                  const expiresDate = s.expires_at ? new Date(s.expires_at) : null;
                  const isLicenseExpired = expiresDate ? expiresDate < now : false;
                  const isExpiringSoon = expiresDate && !isLicenseExpired
                    ? (expiresDate.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000
                    : false;

                  return (
                    <tr
                      key={s.id}
                      className={`text-sm transition-colors hover:bg-primary/5 ${isEven ? "bg-card" : "bg-muted/20"}`}
                    >
                      <td className="py-3.5 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {initial}
                          </div>
                          <span className="font-medium text-foreground truncate max-w-[200px]">
                            {s.student_email}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-sm">
                        {s.course_type}
                      </td>
                      <td className="py-3.5 px-4">
                        {s.bundle_id && bundleNames[s.bundle_id] ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-primary/10 text-primary tracking-wide">
                            {bundleNames[s.bundle_id]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {expiresDate ? (
                          <span className={`text-sm font-medium ${
                            isLicenseExpired
                              ? "text-red-600"
                              : isExpiringSoon
                              ? "text-orange-500"
                              : "text-green-600"
                          }`}>
                            {expiresDate.toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                            s.is_active
                              ? "bg-green-500/10 text-green-600"
                              : "bg-secondary/10 text-secondary"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s.is_active ? "bg-green-500" : "bg-secondary"}`} />
                          {s.is_active ? "Active" : "Pending"}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                        {!s.is_active && (
                          <Popover
                            open={openPopoverId === s.id}
                            onOpenChange={(open) => setOpenPopoverId(open ? s.id : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10">
                                <Link className="h-3 w-3" />
                                Share Link
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-3" align="end">
                              <p className="text-xs font-medium mb-2 text-foreground">
                                Signup link for <span className="text-primary">{s.student_email}</span>
                              </p>
                              <div className="flex gap-2">
                                <Input
                                  readOnly
                                  value={`${window.location.origin}/signup?email=${encodeURIComponent(s.student_email)}`}
                                  className="h-8 text-xs"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-8 shrink-0 transition-colors ${copiedId === s.id ? "text-green-600 border-green-500 bg-green-500/5" : ""}`}
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      `${window.location.origin}/signup?email=${encodeURIComponent(s.student_email)}`
                                    );
                                    setCopiedId(s.id);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}
                                >
                                  {copiedId === s.id ? (
                                    <><Check className="h-3 w-3 mr-1" />Copied</>
                                  ) : (
                                    <><Copy className="h-3 w-3 mr-1" />Copy</>
                                  )}
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setStudentToRemove(s)}
                          >
                            <UserMinus className="h-3 w-3" />
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-sm">
                          {searchQuery ? "No participants match your search." : "No participants assigned yet."}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <AnalyticsSection orgId={orgId} orgName={orgName} roster={analyticsRoster} />
        </TabsContent>
      </Tabs>

      {/* ── Edit Profile Dialog ─────────────────────────────────────── */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-first-name">First Name</Label>
                <Input
                  id="edit-first-name"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-last-name">Last Name</Label>
                <Input
                  id="edit-last-name"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-org-name">Organization Name</Label>
              <Input
                id="edit-org-name"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                placeholder="Organization name"
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              To change your email or password, use{" "}
              <button
                className="text-primary underline underline-offset-2 font-medium"
                onClick={() => { setEditProfileOpen(false); navigate("/profile"); }}
              >
                Security Settings
              </button>
              .
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfileOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {certStudent && (
        <CertificateModal
          open={!!certStudent}
          onClose={() => setCertStudent(null)}
          student={certStudent}
          orgName={orgName}
          adminName={adminDisplayName as string}
        />
      )}
    </div>
  );
}
