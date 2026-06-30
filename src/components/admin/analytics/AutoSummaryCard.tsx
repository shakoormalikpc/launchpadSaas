import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface AutoSummaryCardProps {
  summary: string;
}

/**
 * Displays the auto-generated, grantor-ready performance summary with a
 * one-click copy button so admins can paste it into reports or emails.
 * @param props - The generated summary text.
 * @returns The summary card element.
 */
export function AutoSummaryCard({ summary }: AutoSummaryCardProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  /** Copies the summary to the clipboard with transient "Copied" feedback. */
  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Could not copy summary.");
    }
  };

  return (
    <Card className="border-none shadow-card bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-display font-bold">Auto Summary</CardTitle>
              <p className="text-muted-foreground text-sm">Grantor-ready overview of the current view</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
      </CardContent>
    </Card>
  );
}
