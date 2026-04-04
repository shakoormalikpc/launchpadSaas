import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntroVideoModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen overlay modal that plays the LaunchPad intro video via YouTube embed.
 * Auto-plays on open. Closes on X button or backdrop click.
 * @param open - Whether the modal is visible
 * @param onClose - Callback invoked when the modal is dismissed
 * @returns The intro video dialog element
 */
export const IntroVideoModal = ({ open, onClose }: IntroVideoModalProps) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/80",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />

        {/* Content */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "w-full max-w-[800px] bg-black rounded-lg overflow-hidden shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          {/* Close button */}
          <DialogPrimitive.Close
            className="absolute top-2 right-2 z-10 rounded-full p-1.5 text-white bg-black/40 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close intro video"
          >
            <X className="w-5 h-5" />
          </DialogPrimitive.Close>

          <iframe
            src="https://www.youtube.com/embed/7AkVimW8Lrs?autoplay=1&rel=0"
            width="100%"
            height="450"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="block"
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
