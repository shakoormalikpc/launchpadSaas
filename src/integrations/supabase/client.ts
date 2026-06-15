import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        "Missing environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your .env file."
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Use an in-tab, promise-based lock instead of the browser Web Locks API.
        // The default navigator lock can be "stolen" when several auth-dependent
        // calls run back to back (login → profile fetch → profile save), throwing
        // "Lock sb-...-auth-token was released because another request stole it"
        // and breaking sign-in / profile saves. processLock queues these calls
        // instead, eliminating the race.
        lock: processLock,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
