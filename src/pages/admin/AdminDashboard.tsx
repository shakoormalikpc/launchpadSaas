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

  // Effect 2: fetch licenses once orgId is set (runs after Effect 1 sets orgId)
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
   * Refreshes both org stats and licenses after a mutation (e.g. invite).
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
   * Assigns a license to a new student email and sends the invite link.
   * @param e - Form submit event.
   * @returns Promise<void>
   */
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stats.used >= stats.total) {
      toast.error("No seats available. Please purchase more licenses.");
      return;
    }

    setInviting(true);
    try {
      if (!orgId) {
        toast.error("Organization not loaded. Please refresh and try again.");
        return;
      }

      // Resolve bundle_id from the org's latest purchase
      const { data: latestPurchase, error: purchaseError } = await supabase
        .from("purchases")
        .select("bundle_id")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (purchaseError || !latestPurchase?.bundle_id) {
        toast.error("No active bundle found. Please buy seats first.");
        return;
      }

      const { error } = await supabase.from("licenses").insert({
        org_id: orgId,
        student_email: newStudentEmail,
        course_type: "Fundamentals",
        bundle_id: latestPurchase.bundle_id,
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
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || "Invitation failed");
    } finally {
      setInviting(false);
    }
  };

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

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tight">
            Org Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your student licenses and track learning progress.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Admin profile chip */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
              {(profile?.first_name?.[0] ?? user?.email?.[0] ?? "A").toUpperCase()}
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-foreground truncate max-w-[140px]">{adminDisplayName}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{orgName || "Admin"}</p>
            </div>
          </div>
          <Button
            className="bg-primary hover:opacity-90 shadow-lg shadow-primary/20"
            onClick={handleOpenBuyDialog}
          >
            <CreditCard className="mr-2 h-4 w-4" /> Buy More Seats
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={signOut}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Buy Seats Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buy More Seats</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Bundle select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Course Bundle</label>
              <Select
                value={selectedBundleId}
                onValueChange={setSelectedBundleId}
              >
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

            {/* Quantity input */}
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

            {/* Total price */}
            {totalPrice !== null && (
              <p className="text-sm text-muted-foreground">
                Total:{" "}
                <span className="font-semibold text-foreground">
                  ${totalPrice}
                </span>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBuyDialogOpen(false)}
              disabled={checkingOut}
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedBundleId || checkingOut}
              onClick={handleConfirmPurchase}
            >
              {checkingOut ? (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              ) : null}
              Confirm &amp; Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-card bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">
              Total Licenses
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-card bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">
              Active Students
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.used}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-card bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">
              Available Seats
            </CardTitle>
            <UserPlus className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total - stats.used}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Invite Form */}
        <Card className="lg:col-span-1 border-none shadow-card bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Assign New Seat</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Student Email Address
                </label>
                <Input
                  type="email"
                  placeholder="student@example.com"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={inviting}>
                {inviting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Assign License"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card className="lg:col-span-2 border-none shadow-card bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold">
              Participant Directory
            </CardTitle>
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8 h-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Student Email</th>
                    <th className="pb-3 font-semibold">Course</th>
                    <th className="pb-3 font-semibold">Bundle</th>
                    <th className="pb-3 font-semibold text-right">Status</th>
                    <th className="pb-3 font-semibold text-right">Invite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredStudents.map((s) => {
                    return (
                      <tr
                        key={s.id}
                        className="text-sm hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                              {s.student_email[0].toUpperCase()}
                            </div>
                            <p className="font-medium truncate">{s.student_email}</p>
                          </div>
                        </td>
                        <td className="py-4 text-muted-foreground">
                          {s.course_type}
                        </td>
                        <td className="py-4">
                          {s.bundle_id && bundleNames[s.bundle_id] ? (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary">
                              {bundleNames[s.bundle_id]}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                              s.is_active
                                ? "bg-green-500/10 text-green-500"
                                : "bg-orange-500/10 text-orange-500"
                            }`}
                          >
                            {s.is_active ? "Active" : "Pending"}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          {!s.is_active && (
                            <Popover
                              open={openPopoverId === s.id}
                              onOpenChange={(open) =>
                                setOpenPopoverId(open ? s.id : null)
                              }
                            >
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                                  <Link className="h-3 w-3" />
                                  Share Link
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-3" align="end">
                                <p className="text-xs font-medium mb-2">Signup link for {s.student_email}</p>
                                <div className="flex gap-2">
                                  <Input
                                    readOnly
                                    value={`${window.location.origin}/signup?email=${encodeURIComponent(s.student_email)}`}
                                    className="h-8 text-xs"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`h-8 shrink-0 transition-colors ${copiedId === s.id ? "text-green-500 border-green-500" : ""}`}
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
                      <td
                        colSpan={5}
                        className="py-10 text-center text-muted-foreground italic"
                      >
                        {searchQuery ? "No students match your search." : "No students assigned yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
