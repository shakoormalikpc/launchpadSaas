import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import launchpadLogo from "@/assets/launchpad-logo.png";

export default function SignUp() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const inviteEmail = searchParams.get("email") ?? "";
    const inviteCode = (searchParams.get("code") ?? "").trim();
    // Per-bundle magic-link signup takes precedence over the legacy email invite.
    const isCodeSignup = inviteCode !== "";
    const isStudentSignup = !isCodeSignup && inviteEmail !== "";

    const [loading, setLoading] = useState(false);

    // Org admin fields
    const [adminForm, setAdminForm] = useState({
        firstName: "",
        lastName: "",
        groupName: "",
        email: "",
        password: "",
    });

    // Student fields (legacy email-invite flow)
    const [studentForm, setStudentForm] = useState({
        firstName: "",
        lastName: "",
        password: "",
        confirmPassword: "",
    });

    // Magic-link (per-bundle invite code) flow — email is collected here.
    const [codeForm, setCodeForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAdminForm({ ...adminForm, [e.target.name]: e.target.value });
    };

    const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStudentForm({ ...studentForm, [e.target.name]: e.target.value });
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCodeForm({ ...codeForm, [e.target.name]: e.target.value });
    };

    /**
     * Handles student signup via a per-bundle magic invite code: creates the auth
     * user, then asks the join-via-code Edge Function to atomically claim a seat
     * for the code's bundle. A full bundle (HTTP 409) blocks registration.
     * @param e - Form submit event.
     * @returns Promise<void>
     */
    const handleCodeSignUp = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();

        if (!codeForm.firstName.trim() || !codeForm.lastName.trim()) {
            toast.error("First name and last name are required");
            return;
        }
        if (!codeForm.email.trim()) {
            toast.error("Email is required");
            return;
        }
        if (codeForm.password !== codeForm.confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            // 1. Create the auth user.
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: codeForm.email.trim(),
                password: codeForm.password,
            });

            if (signUpError) throw new Error(`Auth Error: ${signUpError.message}`);
            if (!data.user) throw new Error("Authentication failed - no user returned.");

            // getUser() confirms the session and waits for the local auth storage
            // lock (held by signUp) to release before any authenticated call.
            await supabase.auth.getUser();

            // 2. Create the student profile FIRST. licenses.user_id has a foreign
            //    key to profiles(id), so the profile row must exist before the
            //    seat claim inserts a license referencing this user.
            const studentProfilePayload = {
                id: data.user.id,
                first_name: codeForm.firstName.trim(),
                last_name: codeForm.lastName.trim(),
                role: 'student',
                created_at: new Date().toISOString(),
            };

            let { error: profileError } = await supabase
                .from('profiles')
                .upsert(studentProfilePayload, { onConflict: 'id' });

            if (profileError) {
                await new Promise<void>((r) => setTimeout(r, 600));
                ({ error: profileError } = await supabase
                    .from('profiles')
                    .upsert(studentProfilePayload, { onConflict: 'id' }));
            }

            if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

            // 3. Claim a seat for this code's bundle (atomic, server-side).
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            const joinRes = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-via-code`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ invite_code: inviteCode }),
                }
            );

            const joinJson = await joinRes.json().catch(() => ({}));

            if (!joinRes.ok) {
                // Seat not granted — block registration. Sign back out so the
                // half-provisioned account can't reach the app with no license.
                await supabase.auth.signOut();

                if (joinRes.status === 409) {
                    toast.error(
                        "Registration failed. All available seats for this organization's bundle are completely filled."
                    );
                } else if (joinRes.status === 404) {
                    toast.error(
                        joinJson.error ?? "This invite link is invalid. Please check it with your organization."
                    );
                } else {
                    toast.error(joinJson.error ?? "Registration failed. Please try again or contact your admin.");
                }
                return;
            }

            // Stash the org welcome payload so the global WelcomeDialog can greet
            // the student once they land (survives the client-side navigation).
            try {
                sessionStorage.setItem(
                    "launchpad_welcome",
                    JSON.stringify({
                        orgName: joinJson.org_name ?? null,
                        bundleName: joinJson.bundle_name ?? null,
                    })
                );
                window.dispatchEvent(new Event("launchpad:welcome"));
            } catch {
                // Non-fatal — signup still succeeds without the popup.
            }

            toast.success("Account created! Welcome to LaunchPad.");
            navigate("/");
        } catch (error: unknown) {
            toast.error((error as { message?: string }).message || "An error occurred during signup");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handles org admin signup: creates auth user, profile, and organization.
     * @param e - Form submit event.
     */
    const handleAdminSignUp = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!adminForm.firstName.trim() || !adminForm.lastName.trim()) {
            toast.error("First name and last name are required");
            return;
        }
        if (!adminForm.groupName.trim()) {
            toast.error("Organization name is required");
            return;
        }

        setLoading(true);

        try {
            // 1. Create auth user
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: adminForm.email,
                password: adminForm.password,
            });

            if (signUpError) throw new Error(`Auth Error: ${signUpError.message}`);
            if (!data.user) throw new Error("Authentication failed - no user returned.");

            // getUser() confirms the session server-side and waits for the local
            // auth storage lock (held by signUp) to be released before we make
            // any DB call that needs the JWT.
            await supabase.auth.getUser();

            // 2. Create profile row (upsert for idempotency)
            const adminProfilePayload = {
                id: data.user.id,
                first_name: adminForm.firstName.trim(),
                last_name: adminForm.lastName.trim(),
                group_name: adminForm.groupName.trim(),
                role: 'org_admin',
                created_at: new Date().toISOString(),
            };

            let { error: profileError } = await supabase
                .from('profiles')
                .upsert(adminProfilePayload, { onConflict: 'id' });

            if (profileError) {
                await new Promise<void>((r) => setTimeout(r, 600));
                ({ error: profileError } = await supabase
                    .from('profiles')
                    .upsert(adminProfilePayload, { onConflict: 'id' }));
            }

            if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

            // 3. Create organization entry (non-blocking)
            try {
                const { error: orgError } = await supabase
                    .from('organizations')
                    .insert({
                        admin_id: data.user.id,
                        name: adminForm.groupName.trim(),
                        total_seats: 0,
                        used_seats: 0,
                    });

                if (orgError) console.warn("SignUp: Org creation issue (non-blocking):", orgError);
            } catch (orgCatch: unknown) {
                console.warn("SignUp: Organization creation failed (non-blocking):", orgCatch);
            }

            toast.success("Organization account created successfully!");
            navigate("/login");
        } catch (error: unknown) {
            toast.error((error as { message?: string }).message || "An error occurred during signup");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handles student signup via invite link: validates license, creates auth user,
     * profile, and activates the license.
     * @param e - Form submit event.
     */
    const handleStudentSignUp = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!studentForm.firstName.trim() || !studentForm.lastName.trim()) {
            toast.error("First name and last name are required");
            return;
        }

        if (studentForm.password !== studentForm.confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            // 1. Create auth user
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: inviteEmail,
                password: studentForm.password,
            });

            if (signUpError) throw new Error(`Auth Error: ${signUpError.message}`);
            if (!data.user) throw new Error("Authentication failed - no user returned.");

            // getUser() confirms the session server-side and waits for the local
            // auth storage lock (held by signUp) to be released before any DB call.
            await supabase.auth.getUser();

            // 2. Verify an active invitation exists for this email
            const { data: license, error: licenseError } = await supabase
                .from('licenses')
                .select('id, org_id, course_type')
                .eq('student_email', inviteEmail)
                .eq('is_active', false)
                .limit(1)
                .maybeSingle();

            if (licenseError) throw new Error(`License check failed: ${licenseError.message}`);

            if (!license) {
                toast.error("No invitation found for this email. Please contact your organization admin.");
                // Roll back the auth user we just created so the email stays available
                await supabase.auth.signOut();
                return;
            }

            // 3. Create student profile with the name captured here (no separate
            // /complete-profile step needed).
            const studentProfilePayload = {
                id: data.user.id,
                first_name: studentForm.firstName.trim(),
                last_name: studentForm.lastName.trim(),
                role: 'student',
                created_at: new Date().toISOString(),
            };

            let { error: profileError } = await supabase
                .from('profiles')
                .upsert(studentProfilePayload, { onConflict: 'id' });

            if (profileError) {
                await new Promise<void>((r) => setTimeout(r, 600));
                ({ error: profileError } = await supabase
                    .from('profiles')
                    .upsert(studentProfilePayload, { onConflict: 'id' }));
            }

            if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

            // 4. Activate the license and link it to this user
            const { data: updatedLicense, error: licenseUpdateError } = await supabase
                .from('licenses')
                .update({ is_active: true, user_id: data.user.id })
                .eq('id', license.id)
                .select('id');

            if (licenseUpdateError) {
                console.error('SignUp: License activation error:', licenseUpdateError);
                throw new Error(`License activation failed: ${licenseUpdateError.message}`);
            }

            if (!updatedLicense || updatedLicense.length === 0) {
                console.error('SignUp: License update blocked — 0 rows affected (likely RLS). License id:', license.id, 'User id:', data.user.id);
                toast.error("Account created but license activation failed. Please contact your admin.");
                navigate("/");
                return;
            }

            toast.success("Account created! Welcome to LaunchPad.");
            navigate("/");
        } catch (error: unknown) {
            toast.error((error as { message?: string }).message || "An error occurred during signup");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 bg-background font-sans">
            <div className="hidden bg-muted lg:block">
                <div className="h-full w-full bg-slate-900 relative flex flex-col items-center justify-center p-12 text-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
                    <div className="relative z-10 flex flex-col items-center text-white">
                        <img src={launchpadLogo} alt="Logo" className="h-24 w-auto mb-8" />
                        {(isStudentSignup || isCodeSignup) ? (
                            <>
                                <h2 className="text-4xl font-bold mb-4">You're Invited!</h2>
                                <p className="text-slate-400 max-w-md text-lg">Create your student account to access your financial literacy courses.</p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-4xl font-bold mb-4">Partner with LaunchPad</h2>
                                <p className="text-slate-400 max-w-md text-lg">Manage your students and licenses professionally.</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center py-12 px-6 bg-background">
                <div className="mx-auto grid w-full max-w-[400px] gap-8">
                    {isCodeSignup ? (
                        <>
                            <div className="text-center lg:text-left">
                                <h1 className="text-3xl font-bold">Create Student Account</h1>
                                <p className="text-sm text-muted-foreground">Join your organization using your invite link</p>
                            </div>

                            <form onSubmit={handleCodeSignUp} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>First Name</Label>
                                        <Input
                                            name="firstName"
                                            required
                                            value={codeForm.firstName}
                                            onChange={handleCodeChange}
                                            placeholder="Jane"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Last Name</Label>
                                        <Input
                                            name="lastName"
                                            required
                                            value={codeForm.lastName}
                                            onChange={handleCodeChange}
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
                                        value={codeForm.email}
                                        onChange={handleCodeChange}
                                        placeholder="you@example.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <PasswordInput
                                        name="password"
                                        required
                                        value={codeForm.password}
                                        onChange={handleCodeChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirm Password</Label>
                                    <PasswordInput
                                        name="confirmPassword"
                                        required
                                        value={codeForm.confirmPassword}
                                        onChange={handleCodeChange}
                                    />
                                </div>
                                <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 animate-spin" /> : "Create Account"}
                                </Button>
                            </form>
                        </>
                    ) : isStudentSignup ? (
                        <>
                            <div className="text-center lg:text-left">
                                <h1 className="text-3xl font-bold">Create Student Account</h1>
                                <p className="text-sm text-muted-foreground">Complete your registration to get started</p>
                            </div>

                            <form onSubmit={handleStudentSignUp} className="space-y-5">
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        value={inviteEmail}
                                        readOnly
                                        className="bg-muted text-muted-foreground cursor-not-allowed"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>First Name</Label>
                                        <Input
                                            name="firstName"
                                            required
                                            value={studentForm.firstName}
                                            onChange={handleStudentChange}
                                            placeholder="Jane"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Last Name</Label>
                                        <Input
                                            name="lastName"
                                            required
                                            value={studentForm.lastName}
                                            onChange={handleStudentChange}
                                            placeholder="Smith"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <PasswordInput
                                        name="password"
                                        required
                                        value={studentForm.password}
                                        onChange={handleStudentChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirm Password</Label>
                                    <PasswordInput
                                        name="confirmPassword"
                                        required
                                        value={studentForm.confirmPassword}
                                        onChange={handleStudentChange}
                                    />
                                </div>
                                <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 animate-spin" /> : "Create Account"}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <>
                            <div className="text-center lg:text-left">
                                <h1 className="text-3xl font-bold">Create Organization</h1>
                                <p className="text-sm text-muted-foreground">Register as a Group Leader</p>
                            </div>

                            <form onSubmit={handleAdminSignUp} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>First Name</Label>
                                        <Input name="firstName" required value={adminForm.firstName} onChange={handleAdminChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Last Name</Label>
                                        <Input name="lastName" required value={adminForm.lastName} onChange={handleAdminChange} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Organization Name</Label>
                                    <Input name="groupName" required value={adminForm.groupName} onChange={handleAdminChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input name="email" type="email" required value={adminForm.email} onChange={handleAdminChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <PasswordInput name="password" required value={adminForm.password} onChange={handleAdminChange} />
                                </div>
                                <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 animate-spin" /> : "Create Account"}
                                </Button>
                            </form>
                        </>
                    )}

                    <p className="text-center text-sm">
                        Already have an account? <Link to="/login" className="text-primary font-bold">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
