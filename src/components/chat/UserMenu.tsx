
import { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { LogOut, LayoutDashboard, Settings, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEMO_GROUP_NAME = "__demo__";

export const UserMenu = () => {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isDemoUser = profile?.group_name === DEMO_GROUP_NAME;

    const handleSignOut = async () => {
        await signOut();
        navigate("/login");
    };

    /**
     * Deletes the current demo account via the delete-account Edge Function,
     * then signs out and redirects to the demo landing page.
     */
    const handleDeleteAccount = async (): Promise<void> => {
        setDeleting(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                }
            );

            // The function may not be deployed yet, or could return a non-JSON
            // error page — parse defensively so we surface a useful message.
            let json: { success?: boolean; error?: string } | null = null;
            try {
                json = await res.json();
            } catch {
                json = null;
            }

            if (!res.ok || !json?.success) {
                const message =
                    json?.error ??
                    `Delete failed (status ${res.status}). The delete-account function may not be deployed.`;
                console.error("delete-account failed:", res.status, json);
                toast.error(message);
                return;
            }

            // Clear the local session, then hard-redirect to the public demo
            // homepage. A full reload avoids the ProtectedRoute race that would
            // otherwise bounce the now-signed-out user to /login.
            await supabase.auth.signOut();
            toast.success("Your demo account has been deleted.");
            window.location.href = "/demo";
        } catch (err) {
            console.error("delete-account error:", err);
            toast.error(
                err instanceof Error
                    ? `${err.message} — the delete-account function may not be deployed.`
                    : "An unexpected error occurred. Please try again."
            );
        } finally {
            setDeleting(false);
            setDeleteOpen(false);
        }
    };

    const initials = profile?.first_name && profile?.last_name
        ? `${profile.first_name[0]}${profile.last_name[0]}`
        : "U";

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger className="focus:outline-none">
                    <Avatar className="h-9 w-9 border-2 border-primary/20 hover:border-primary transition-colors cursor-pointer">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">
                                {profile?.first_name} {profile?.last_name}
                            </p>
                            <p className="text-xs leading-none text-muted-foreground">
                                {profile?.group_name || "Student"}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/dashboard")} className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Profile Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                    {isDemoUser && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setDeleteOpen(true)}
                                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete Account</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete your demo account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes your demo account and all of your lesson
                            progress. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteAccount();
                            }}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting…
                                </>
                            ) : (
                                "Delete Account"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
