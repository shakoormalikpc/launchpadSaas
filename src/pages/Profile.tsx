
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

/** Returns "weak" | "medium" | "strong" based on password content. */
function getPasswordStrength(password: string): "weak" | "medium" | "strong" | null {
    if (!password) return null;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

    if (password.length < 8) return "weak";
    if (score <= 2) return "medium";
    return "strong";
}

const STRENGTH_LABEL: Record<"weak" | "medium" | "strong", string> = {
    weak: "Weak",
    medium: "Medium",
    strong: "Strong",
};

const STRENGTH_COLOR: Record<"weak" | "medium" | "strong", string> = {
    weak: "text-red-500",
    medium: "text-yellow-500",
    strong: "text-green-500",
};

const STRENGTH_BAR: Record<"weak" | "medium" | "strong", string> = {
    weak: "w-1/3 bg-red-500",
    medium: "w-2/3 bg-yellow-500",
    strong: "w-full bg-green-500",
};

export default function Profile() {
    const { profile, user, refreshProfile } = useAuth();
    const navigate = useNavigate();

    const [profileLoading, setProfileLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        groupName: "",
        avatarUrl: "",
    });

    const [passwordData, setPasswordData] = useState({
        password: "",
        confirmPassword: "",
    });

    const [newEmail, setNewEmail] = useState("");
    const [passwordError, setPasswordError] = useState("");

    useEffect(() => {
        if (profile) {
            setFormData({
                firstName: profile.first_name || "",
                lastName: profile.last_name || "",
                groupName: profile.group_name || "",
                avatarUrl: profile.avatar_url || "",
            });
        }
    }, [profile]);

    /**
     * Uploads a new avatar image to Supabase Storage and updates avatarUrl in local state.
     * @param e - File input change event
     */
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;

        setAvatarLoading(true);
        try {
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
            toast.success("Image uploaded! Click 'Save Profile' to apply.");
        } catch (error: unknown) {
            console.error("Avatar upload error:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            toast.error(
                `Failed to upload image. Ensure the 'avatars' bucket exists and is set to public in Supabase Storage. (${message})`
            );
        } finally {
            setAvatarLoading(false);
        }
    };

    /**
     * Saves first name, last name, group name, and avatar URL to the profiles table.
     * @param e - Form submit event
     */
    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setProfileLoading(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    group_name: formData.groupName,
                    avatar_url: formData.avatarUrl,
                })
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Profile updated successfully!");
            await refreshProfile();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to update profile";
            toast.error(message);
        } finally {
            setProfileLoading(false);
        }
    };

    /**
     * Updates the authenticated user's password via Supabase Auth.
     * Validates minimum length and match before submitting.
     * @param e - Form submit event
     */
    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        const strength = getPasswordStrength(passwordData.password);
        if (!passwordData.password || passwordData.password.length < 8) {
            setPasswordError("Password must be at least 8 characters.");
            return;
        }
        if (passwordData.password !== passwordData.confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }

        setPasswordError("");
        setPasswordLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordData.password,
            });

            if (error) throw error;
            toast.success("Password updated successfully!");
            setPasswordData({ password: "", confirmPassword: "" });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to update password";
            toast.error(message);
        } finally {
            setPasswordLoading(false);
        }
    };

    /**
     * Sends a confirmation email to the new address via Supabase Auth.
     * @param e - Form submit event
     */
    const handleEmailUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim()) return;

        setEmailLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
            if (error) throw error;
            toast.success("Confirmation email sent! Check your new inbox to verify the change.");
            setNewEmail("");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to update email";
            toast.error(message);
        } finally {
            setEmailLoading(false);
        }
    };

    const strength = getPasswordStrength(passwordData.password);

    return (
        <div className="flex flex-col h-screen bg-background">
            <ChatHeader />

            <div className="flex-1 overflow-y-auto p-6 md:p-12">
                <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/")}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back
                        </Button>
                        <h1 className="text-3xl font-bold font-display">Profile Settings</h1>
                    </div>

                    {/* Personal Information */}
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Personal Information</h2>

                        {/* Current email — read-only display */}
                        {user?.email && (
                            <div className="mb-4 space-y-1">
                                <Label className="text-muted-foreground text-sm">Current Email</Label>
                                <p className="text-sm font-medium bg-muted px-3 py-2 rounded-md border border-border">
                                    {user.email}
                                </p>
                            </div>
                        )}

                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First name</Label>
                                    <Input
                                        id="firstName"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last name</Label>
                                    <Input
                                        id="lastName"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="groupName">Group / Class Name</Label>
                                <Input
                                    id="groupName"
                                    value={formData.groupName}
                                    onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="avatar">Profile Picture</Label>
                                <div className="flex gap-4 items-center">
                                    {formData.avatarUrl && (
                                        <img
                                            src={formData.avatarUrl}
                                            alt="Avatar preview"
                                            className="w-12 h-12 rounded-full object-cover border"
                                        />
                                    )}
                                    <div className="flex-1">
                                        <Input
                                            id="avatar"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarUpload}
                                            disabled={avatarLoading}
                                            className="cursor-pointer"
                                        />
                                    </div>
                                    {avatarLoading && (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Upload a JPG or PNG image. Requires the 'avatars' bucket to be public in Supabase Storage.
                                </p>
                            </div>

                            <div className="pt-2">
                                <Button type="submit" disabled={profileLoading || avatarLoading}>
                                    {profileLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Profile
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Change Email */}
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h2 className="text-xl font-semibold mb-1">Change Email</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Enter a new email address below. A confirmation link will be sent to the new address before the change takes effect.
                        </p>
                        <form onSubmit={handleEmailUpdate} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="newEmail">New Email Address</Label>
                                <Input
                                    id="newEmail"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                />
                            </div>
                            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 border border-border rounded-md px-3 py-2">
                                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>A confirmation email will be sent to your new address. Your email will not change until you click the link.</span>
                            </div>
                            <div className="pt-2">
                                <Button type="submit" variant="outline" disabled={emailLoading || !newEmail.trim()}>
                                    {emailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Send Confirmation
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Security — Password Update */}
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Security</h2>
                        <form onSubmit={handlePasswordUpdate} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={passwordData.password}
                                    onChange={(e) => {
                                        setPasswordData({ ...passwordData, password: e.target.value });
                                        setPasswordError("");
                                    }}
                                />
                                {/* Strength indicator */}
                                {strength && (
                                    <div className="space-y-1">
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${STRENGTH_BAR[strength]}`} />
                                        </div>
                                        <p className={`text-xs font-medium ${STRENGTH_COLOR[strength]}`}>
                                            {STRENGTH_LABEL[strength]}
                                        </p>
                                    </div>
                                )}
                                {passwordError && (
                                    <p className="text-xs text-red-500">{passwordError}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                />
                            </div>

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    variant="outline"
                                    disabled={passwordLoading || !passwordData.password}
                                >
                                    {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Password
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
