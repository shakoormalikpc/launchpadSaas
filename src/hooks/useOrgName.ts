import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseOrgNameResult {
    orgName: string | null;
    orgLoading: boolean;
}

/**
 * Fetches the organization name for a student by looking up their license record via student_email.
 * Returns null if the student has no associated license or organization.
 * @param studentEmail - The authenticated student's email address.
 * @returns An object containing the organization name and loading state.
 */
export function useOrgName(studentEmail: string | null | undefined): UseOrgNameResult {
    const [orgName, setOrgName] = useState<string | null>(null);
    const [orgLoading, setOrgLoading] = useState(true);

    useEffect(() => {
        if (!studentEmail) {
            setOrgLoading(false);
            return;
        }

        let cancelled = false;

        const fetchOrgName = async () => {
            setOrgLoading(true);

            const { data: license, error: licErr } = await supabase
                .from('licenses')
                .select('org_id')
                .eq('student_email', studentEmail)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

            if (cancelled) return;

            if (licErr || !license?.org_id) {
                setOrgLoading(false);
                return;
            }

            const { data: org, error: orgErr } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', license.org_id)
                .maybeSingle();

            if (cancelled) return;

            if (!orgErr && org?.name) {
                setOrgName(org.name);
            }
            setOrgLoading(false);
        };

        fetchOrgName();

        return () => {
            cancelled = true;
        };
    }, [studentEmail]);

    return { orgName, orgLoading };
}
