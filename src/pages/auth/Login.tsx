import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import launchpadLogo from "@/assets/launchpad-logo.png";

export default function Login() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ email: "", password: "" });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });

            if (error) throw error;

            // AuthContext's onAuthStateChange (SIGNED_IN) will fetch the profile.
            // ProtectedRoute at "/" will redirect to the correct dashboard based on role.
            toast.success("Login successful!");
            navigate("/", { replace: true });
        } catch (error: unknown) {
            toast.error((error as { message?: string }).message || "Error logging in");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
            <div className="hidden bg-muted lg:block">
                 <div className="h-full w-full object-cover bg-slate-900 relative flex flex-col items-center justify-center p-12 text-center text-white">
                    <img src={launchpadLogo} alt="Logo" className="h-24 w-auto mb-8" />
                    <h2 className="text-3xl font-bold mb-4">Welcome Back</h2>
                    <p className="text-slate-300">Access your financial education portal.</p>
                </div>
            </div>

            <div className="flex items-center justify-center py-12 px-4 sm:px-8">
                <div className="mx-auto grid w-full max-w-sm gap-6">
                    <h1 className="text-3xl font-semibold tracking-tight">Sign In</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input name="email" type="email" required value={formData.email} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input name="password" type="password" required value={formData.password} onChange={handleChange} />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sign In
                        </Button>
                    </form>
                    <p className="text-center text-sm text-muted-foreground">
                        Don't have an organization account? <Link to="/signup" className="text-primary font-semibold hover:underline">Register Org</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
