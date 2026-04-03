import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/types/auth";

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const useAuth = () => {
    return useContext(AuthContext);
};

const MAX_RETRIES = 3;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const hasInitialized = useRef(false);
    // Prevents two concurrent fetchProfileData calls (e.g. INITIAL_SESSION + SIGNED_IN arriving simultaneously)
    const isFetchingProfile = useRef(false);
    // Tracks which userId already has a loaded profile so repeated SIGNED_IN events are skipped
    const profileLoadedForUserId = useRef<string | null>(null);

    /**
     * Fetches the user profile from the database with retry logic.
     * @param userId - The authenticated user's ID.
     * @param retries - Remaining retry attempts.
     * @returns The user's profile or null if not found.
     */
    const fetchProfileData = async (userId: string, retries = MAX_RETRIES): Promise<Profile | null> => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, role, group_name, avatar_url, created_at')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error("AuthContext: Query error when fetching profile:", error);
                if (retries > 1 && error.code !== 'PGRST100') {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return fetchProfileData(userId, retries - 1);
                }
                return null;
            }

            if (!data) {
                console.warn("AuthContext: Profile not found for user:", userId);
                if (retries > 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return fetchProfileData(userId, retries - 1);
                }
                return null;
            }

            return data as Profile;
        } catch (error: unknown) {
            console.error("AuthContext: Unexpected profile fetch error:", error);
            return null;
        }
    };

    useEffect(() => {
        const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timed out`)), ms)
            );
            return Promise.race([promise, timeout]);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            // TOKEN_REFRESHED / USER_UPDATED: only sync session state, never re-fetch profile.
            // These fire frequently (tab focus, token expiry) and do not indicate a new login.
            if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
                return;
            }

            // SIGNED_OUT: clear everything and reset guards.
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setProfile(null);
                hasInitialized.current = false;
                isFetchingProfile.current = false;
                profileLoadedForUserId.current = null;
                setLoading(false);
                return;
            }

            // For all other events (INITIAL_SESSION, SIGNED_IN, PASSWORD_RECOVERY, etc.)
            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            if (!currentSession?.user) {
                setProfile(null);
                profileLoadedForUserId.current = null;
                if (!hasInitialized.current) {
                    setLoading(false);
                    hasInitialized.current = true;
                }
                return;
            }

            const userId = currentSession.user.id;

            // Skip profile fetch if we already have this user's profile loaded.
            // This handles repeated SIGNED_IN events for the same user without re-fetching.
            if (profileLoadedForUserId.current === userId) {
                if (!hasInitialized.current) {
                    setLoading(false);
                    hasInitialized.current = true;
                }
                return;
            }

            // Guard against concurrent fetches: INITIAL_SESSION and SIGNED_IN can fire
            // nearly simultaneously. The first one wins; the second is dropped.
            if (isFetchingProfile.current) {
                return;
            }

            if (!hasInitialized.current) {
                setLoading(true);
            }

            isFetchingProfile.current = true;
            try {
                const profileData = await withTimeout(
                    fetchProfileData(userId),
                    10000,
                    "fetchProfile"
                );
                setProfile(profileData ?? null);
                // Only mark as loaded when fetch succeeded (profileData non-null).
                // If null (no profile row yet), we want the next SIGNED_IN to retry.
                if (profileData) {
                    profileLoadedForUserId.current = userId;
                }

                if (!profileData) {
                    console.warn("AuthContext: Profile is null after auth state change for user", userId);
                }
            } catch (error: unknown) {
                console.error("AuthContext: Error fetching profile on auth state change:", (error as Error).message);
                setProfile(null);
            } finally {
                isFetchingProfile.current = false;
                setLoading(false);
                hasInitialized.current = true;
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
            // onAuthStateChange SIGNED_OUT will clear state; also clear here for immediacy.
            setProfile(null);
            setSession(null);
            setUser(null);
            profileLoadedForUserId.current = null;
        } catch (error: unknown) {
            console.error("AuthContext: Error signing out:", error);
        }
    };

    /**
     * Forces a re-fetch of the current user's profile from the database.
     * Clears the loaded-user guard so the next auth event will also re-fetch if needed.
     * @returns void
     */
    const refreshProfile = async () => {
        if (!user) return;
        try {
            const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error("Profile refresh timed out")), 10000)
            );
            const profileData = await Promise.race([fetchProfileData(user.id), timeoutPromise]);
            setProfile(profileData ?? null);
            profileLoadedForUserId.current = profileData ? user.id : null;
        } catch (error: unknown) {
            console.error("AuthContext: Error refreshing profile:", (error as Error).message);
        }
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
