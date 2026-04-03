import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { session, profile, loading: authLoading } = useAuth();
    const location = useLocation();
    const [progress, setProgress] = useState(0);
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        let progressInterval: NodeJS.Timeout;
        let timeoutTimer: NodeJS.Timeout;

        if (authLoading) {
            setProgress(0); // Reset so the bar starts fresh on each loading cycle
            progressInterval = setInterval(() => {
                setProgress((prev) => (prev >= 90 ? prev : prev + 2));
            }, 200);

            // 15 sec timeout for slow connections
            timeoutTimer = setTimeout(() => {
                setTimedOut(true);
            }, 15000);
        }

        return () => {
            clearInterval(progressInterval);
            clearTimeout(timeoutTimer);
        };
    }, [authLoading]);

    // 1. Loading State (Sirf tab dikhayen jab AuthContext loading ho)
    if (authLoading && !timedOut) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background p-6">
                <div className="w-full max-w-xs space-y-6 text-center">
                    <div className="mb-8 animate-bounce">
                         <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto border border-primary/20 text-primary">
                            <Loader2 className="w-8 h-8 animate-spin" />
                         </div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-foreground tracking-tight">Securing connection...</h3>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Verifying Credentials</p>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Timeout State
    if (timedOut && !session) {
        return (
            <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-background">
                <h2 className="text-2xl font-bold">Connection is taking too long</h2>
                <button onClick={() => window.location.reload()} className="mt-4 px-8 py-3 bg-primary text-white rounded-xl font-bold">
                    Retry Connection
                </button>
            </div>
        );
    }

    // 3. Authentication Check
    if (!authLoading && !session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 4. Profile Check (User is authenticated but profile is missing)
    // Skip this check for login/signup pages and complete-profile page
    const isAuthPage = ['/login', '/signup', '/complete-profile'].some(path => location.pathname.startsWith(path));
    
    if (!authLoading && session && !profile && !isAuthPage) {
        console.warn("ProtectedRoute: User authenticated but profile is null. Redirecting to complete-profile.");
        return <Navigate to="/complete-profile" state={{ from: location }} replace />;
    }

    // --- ROLE PROTECTION LOGIC (Using Profile from AuthContext) ---
    const userRole = profile?.role;

    // Prevent students from accessing admin pages
    if (location.pathname.startsWith("/admin-dashboard") && userRole === "student") {
        console.log("ProtectedRoute: Student trying to access admin-dashboard, redirecting to dashboard");
        return <Navigate to="/dashboard" replace />;
    }

    // Prevent admins from accessing student dashboard (redirect to admin-dashboard)
    if (location.pathname.startsWith("/dashboard") && userRole === "org_admin") {
        console.log("ProtectedRoute: Admin trying to access student dashboard, redirecting to admin-dashboard");
        return <Navigate to="/admin-dashboard" replace />;
    }

    // Root path (/) redirect based on role
    // Students stay at "/" (ChatContainer is their home/lesson selector)
    if (location.pathname === "/" && !authLoading) {
        if (userRole === "org_admin") {
            console.log("ProtectedRoute: Root path - redirecting org_admin to admin-dashboard");
            return <Navigate to="/admin-dashboard" replace />;
        }
        // No role yet → complete profile first
        if (!userRole) {
            console.log("ProtectedRoute: Root path - no role found, redirecting to complete-profile");
            return <Navigate to="/complete-profile" replace />;
        }
        // student (or any other role) → stay at "/"
    }

    return <>{children}</>;
};