import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import launchpadLogo from "@/assets/launchpad-logo.png";

export default function SignUp() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const inviteEmail = searchParams.get("email") ?? "";
    const isStudentSignup = inviteEmail !== "";

    const [loading, setLoading] = useState(false);

    // Org admin fields
    const [adminForm, setAdminForm] = useState({
        firstName: "",
        lastName: "",
        groupName: "",
        email: "",
        password: "",
    });

    // Student fields
    const [studentForm, setStudentForm] = useState({
        password: "",
        confirmPassword: "",
    });

    const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAdminForm({ ...adminForm, [e.target.name]: e.target.value });
    };

    const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStudentForm({ ...studentForm, [e.target.name]: e.target.value });
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

            // Wait for the Supabase auth lock to settle before making a DB call.
            await new Promise<void>((r) => setTimeout(r, 500));

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

            // Wait for the Supabase auth lock to settle before making DB calls.
            await new Promise<void>((r) => setTimeout(r, 500));

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

            // 3. Create student profile (name filled in at /complete-profile)
            const studentProfilePayload = {
                id: data.user.id,
                first_name: '',
                last_name: '',
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
                navigate("/complete-profile");
                return;
            }

            toast.success("Account created! Please complete your profile.");
            navigate("/complete-profile");
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
                        {isStudentSignup ? (
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
                    {isStudentSignup ? (
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
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <Input
                                        name="password"
                                        type="password"
                                        required
                                        value={studentForm.password}
                                        onChange={handleStudentChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirm Password</Label>
                                    <Input
                                        name="confirmPassword"
                                        type="password"
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
                                    <Input name="password" type="password" required value={adminForm.password} onChange={handleAdminChange} />
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
