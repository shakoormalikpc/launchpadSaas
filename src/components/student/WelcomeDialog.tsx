import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";
import { getBundleLessonCount } from "@/hooks/useStudentBundle";

/** sessionStorage key holding the pending welcome payload (set on magic-link signup). */
export const WELCOME_STORAGE_KEY = "launchpad_welcome";
/** Window event dispatched right after the payload is stored, so an already-mounted
 *  dialog opens without needing a full page reload. */
export const WELCOME_EVENT = "launchpad:welcome";

interface WelcomePayload {
  orgName: string | null;
  bundleName: string | null;
}

/**
 * A one-time, centered welcome modal shown after a student joins via a magic
 * invite link. Reads its payload from sessionStorage (so it survives the
 * post-signup client-side navigation) and clears it once shown, so it never
 * reappears on subsequent visits.
 *
 * Mounted once globally in App so it can overlay whichever page the new student
 * lands on.
 *
 * @returns The welcome Dialog (renders nothing until a payload is present).
 */
export function WelcomeDialog(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<WelcomePayload | null>(null);

  useEffect(() => {
    const showFromStorage = (): void => {
      const raw = sessionStorage.getItem(WELCOME_STORAGE_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as WelcomePayload;
        setPayload(parsed);
        setOpen(true);
      } catch {
        // Corrupt payload — ignore.
      } finally {
        // Clear immediately so it shows exactly once.
        sessionStorage.removeItem(WELCOME_STORAGE_KEY);
      }
    };

    // Cover both paths: a fresh mount (e.g. hard reload) and a same-session
    // dispatch right after signup navigation.
    showFromStorage();
    window.addEventListener(WELCOME_EVENT, showFromStorage);
    return () => window.removeEventListener(WELCOME_EVENT, showFromStorage);
  }, []);

  if (!payload) return <></>;

  const orgName = payload.orgName?.trim() || "your organization";
  const lessonCount = getBundleLessonCount(payload.bundleName);
  const lessonsLabel = lessonCount === 14 ? "all 14 lessons" : `${lessonCount} lessons`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <PartyPopper className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-display font-bold">
            Welcome to {orgName}!
          </DialogTitle>
          <DialogDescription className="text-base">
            You&apos;re all set. You now have access to{" "}
            <span className="font-semibold text-foreground">{lessonsLabel}</span>
            {payload.bundleName ? (
              <>
                {" "}in <span className="font-semibold text-foreground">{payload.bundleName}</span>
              </>
            ) : null}
            . Let&apos;s start your financial journey.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button
            className="w-full sm:w-auto px-8 font-semibold"
            onClick={() => setOpen(false)}
          >
            Start Learning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
