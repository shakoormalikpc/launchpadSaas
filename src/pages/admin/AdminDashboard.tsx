import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
} from "lucide-react";

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
  const { user, profile, signOut } = useAuth();
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

  // Buy Seats dialog state
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [bundles, setBundles] = useState<CourseBundle[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");
  const [seatQuantity, setSeatQuantity] = useState(1);
  const [checkingOut, setCheckingOut] = useState(false);

  // Bundle name map for Participant Directory (bundle_id -> bundle name)
  const [bundleNames, setBundleNames] = useState<Record<string, string>>({});

  // Per-bundle seat summary (from RPC get_bundle_seat_summary)
  const [bundleSummary, setBundleSummary] = useState<BundleSeatSummary[]>([]);

  // Selected bundle for the Assign New Seat form
  const [assignBundleId, setAssignBundleId] = useState<string>("");

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

  // Effect 2: fetch licenses and bundle summary once orgId is set
  useEffect(() => {
    if (!orgId) return;

    const fetchLicenses = async (): Promise<void> => {
      try {
        const { data: licenses, error: licensesError } = await supabase
          .from("licenses")
          .select("id, student_email, course_type, is_active, user_id, bundle_id")
          .eq("org_id", orgId);

        if (licensesError) {
          toast.error("Failed to load licenses.");
        }

        const rows = (licenses as LicenseRow[]) || [];
        setStudents(rows);
        await fetchBundleNamesForLicenses(rows);
        await fetchBundleSummary(orgId);
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
      }

      const { data: licenses, error: licensesError } = await supabase
        .from("licenses")
        .select("id, student_email, course_type, is_active, user_id, bundle_id")
        .eq("org_id", orgId);

      if (licensesError) {
        toast.error("Failed to refresh licenses.");
      }

      const rows = (licenses as LicenseRow[]) || [];
      setStudents(rows);
      await fetchBundleNamesForLicenses(rows);
      await fetchBundleSummary(orgId);
    } catch {
      // no-op
    }
  };

  /**
   * Fetches all available course bundles from Supabase and opens the Buy Seats dialog.
   * @returns Promise<void>
   */
  const handleOpenBuyDialog = async (): Promise<void> => {
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
    setBuyDialogOpen(true);
  };

  /**
   * Posts to the create-checkout-session Edge Function and redirects to Stripe.
   * @returns Promise<void>
   */
  const handleConfirmPurchase = async (): Promise<void> => {
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

  const adminFirstName = profile?.first_name || null;
  const adminDisplayName = profile
    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || user?.email
    : user?.email;

  const filteredStudents = searchQuery.trim()
    ? students.filter((s) =>
        s.student_email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students;

  const selectedBundle = bundles.find((b) => b.id === selectedBundleId);
  const totalPrice = selectedBundle
    ? (selectedBundle.price_per_seat * seatQuantity).toFixed(2)
    : null;

  const availableCount = Math.max(0, stats.total - stats.used);
  const usedPct = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;

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

        {/* Assign New Seat form */}
        <Card className="lg:col-span-3 border-none shadow-card bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-display font-bold">Assign New Seat</CardTitle>
                <p className="text-muted-foreground text-sm">Student will receive an invite link via email</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {noSeatsAvailable ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">No seats available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    All purchased seats are assigned. Buy more seats to invite new students.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenBuyDialog}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Purchase More Seats
                </Button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Course Bundle
                  </label>
                  <Select value={assignBundleId} onValueChange={setAssignBundleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a bundle…" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableBundles.map((b) => (
                        <SelectItem key={b.bundle_id} value={b.bundle_id}>
                          {b.bundle_name} — {b.available} seat{b.available !== 1 ? "s" : ""} available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignableBundles.length === 0 && bundleSummary.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No bundles found. Purchase seats first.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Student Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="email"
                      placeholder="student@example.com"
                      value={newStudentEmail}
                      onChange={(e) => setNewStudentEmail(e.target.value)}
                      required
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    An invitation link will be generated and sent to this address.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60">
                  <div className="text-sm">
                    {selectedAssignSummary ? (
                      <>
                        <span className="text-muted-foreground">Available for this bundle: </span>
                        <span className="font-bold text-foreground">{selectedAssignSummary.available}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Total available seats: </span>
                        <span className="font-bold text-foreground">{availableCount}</span>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:opacity-90 shadow-soft font-semibold"
                  disabled={inviting || !assignBundleId}
                >
                  {inviting ? (
                    <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Sending Invite…</>
                  ) : (
                    <><UserPlus className="mr-2 h-4 w-4" /> Assign License &amp; Send Invite</>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

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
                  <th className="py-3 px-4 font-semibold text-right">Status</th>
                  <th className="py-3 pl-4 pr-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, idx) => {
                  const initial = s.student_email[0].toUpperCase();
                  const isEven = idx % 2 === 0;
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
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
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

    </div>
  );
}
