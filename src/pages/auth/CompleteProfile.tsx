import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Determines the post-login destination based on the user's role.
 * @param role - The user's role string from their profile.
 * @returns The route path to redirect to.
 */
function getDestinationByRole(role: string | null | undefined): string {
    return role === "org_admin" ? "/admin-dashboard" : "/";
}

/**
 * Page shown to newly authenticated users who have not yet set their name.
 * Collects first and last name, upserts the profile without altering the role,
 * then redirects to the appropriate dashboard.
 */
export default function CompleteProfile() {
    const navigate = useNavigate();
    const { user, profile, loading: authLoading, refreshProfile } = useAuth();
    const [saving, setSaving] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    // Hard timeout: if auth/profile never resolves within 3 s, force-show the form.
    const [timedOut, setTimedOut] = useState(false);

    // Track whether we've ever observed authLoading=true in this mount.
    //
    // WHY THIS MATTERS: AuthContext only sets loading=true for the very first
    // INITIAL_SESSION/SIGNED_IN event (hasInitialized guard). If INITIAL_SESSION
    // fires with a null session and then SIGNED_IN fires (fresh sign-in), loading
    // stays false throughout the profile fetch. In that window:
    //   user = set (sync), profile = null (fetch in flight), authLoading = false
    // Without this guard the form renders briefly before the profile arrives.
    //
    // seenLoadingRef.current starts true if authLoading is already true on mount
    // (normal page-refresh path) or becomes true via the effect below.
    const seenLoadingRef = useRef<boolean>(authLoading);
    useEffect(() => {
        if (authLoading) seenLoadingRef.current = true;
    }, [authLoading]);

    useEffect(() => {
        const id = setTimeout(() => setTimedOut(true), 3000);
        return () => clearTimeout(id);
    }, []);

    // "Profile resolved" means we've confirmed the profile fetch has finished.
    // Either:
    //  (a) We went through a full loading cycle (seenLoadingRef=true) and auth is done, OR
    //  (b) Profile is already non-null, meaning the fetch completed regardless of loading flag.
    const profileResolved = !authLoading && (seenLoadingRef.current || profile !== null);

    // Redirect away once profile is resolved and the user already has a name set.
    useEffect(() => {
        if (!profileResolved) return;
        if (!profile) return;
        if (profile.first_name && profile.first_name.trim() !== '') {
            if (profile.role === 'org_admin') navigate('/admin-dashboard', { replace: true });
            else navigate('/', { replace: true });
        }
    }, [profile, profileResolved, navigate]);

    /**
     * Handles form submission: upserts first/last name (preserves existing role),
     * refreshes the AuthContext profile, then navigates to the correct dashboard.
     * @param e - The form submit event.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedFirst = firstName.trim();
        const trimmedLast = lastName.trim();

        if (!trimmedFirst || !trimmedLast) {
            toast.error("First name and last name are required");
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase
                .from("profiles")
                .upsert(
                    { id: user!.id, first_name: trimmedFirst, last_name: trimmedLast },
                    { onConflict: "id" }
                );

            if (error) throw new Error(`Failed to save profile: ${error.message}`);

            toast.success("Profile saved!");

            await refreshProfile();

            // Use the role that was already on the profile — we never changed it.
            navigate(getDestinationByRole(profile?.role));
        } catch (error: unknown) {
            console.error("CompleteProfile: save error:", error);
            toast.error((error as Error).message || "An error occurred");
        } finally {
            setSaving(false);
        }
    };

    // Show spinner while auth is loading OR while profile fetch is still in-flight
    // (covers the SIGNED_IN race where authLoading never goes true).
    if (!timedOut && (authLoading || !profileResolved)) {
        return (
            <div className="w-full min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Render nothing while a redirect is pending (profile has first_name → useEffect will redirect).
    if (!user || (profile?.first_name && profile.first_name.trim() !== '')) return null;

    return (
        <div className="w-full min-h-screen flex items-center justify-center bg-background p-6">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Complete Your Profile</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                        Please provide your name to get started
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                                id="firstName"
                                name="firstName"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="First"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                                id="lastName"
                                name="lastName"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Last"
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full h-11 font-bold" disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Complete Profile"
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
