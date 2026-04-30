import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Award } from "lucide-react";
import launchpadLogo from "@/assets/launchpad-logo.png";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export interface CertificateStudent {
  student_email: string;
  student_first_name: string;
  student_last_name: string;
  bundle_name: string | null;
  lessons_completed: number;
  total_lessons: number;
  average_score: number;
  last_activity: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  student: CertificateStudent;
  orgName: string;
  adminName: string;
}

/**
 * Renders a printable certificate of completion and provides a one-click
 * PDF download using html2canvas + jsPDF.
 *
 * @param open - Controls dialog visibility.
 * @param onClose - Called when the dialog should close.
 * @param student - The student whose certificate is being generated.
 * @param orgName - The organisation name printed at the bottom.
 * @param adminName - The admin's display name used as the signature.
 */
export function CertificateModal({ open, onClose, student, orgName, adminName }: Props) {
  const certRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const studentName =
    [student.student_first_name, student.student_last_name].filter(Boolean).join(" ") ||
    student.student_email;

  const completionDate = student.last_activity
    ? new Date(student.last_activity).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const score =
    student.average_score > 0 ? Math.round(Number(student.average_score)) : null;

  /**
   * Captures the certificate element at 2× resolution, embeds it in a
   * landscape PDF, then triggers a browser download.
   */
  const handleDownload = async (): Promise<void> => {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width / 2, canvas.height / 2],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
      const safeName = studentName.replace(/[^a-z0-9]/gi, "_");
      pdf.save(`${safeName}_Certificate_of_Completion.pdf`);
    } catch (err) {
      console.error("CertificateModal: PDF generation failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] w-full">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <DialogTitle>Certificate of Completion — {studentName}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Scrollable preview — certificate is fixed at 800 × 566 px */}
        <div className="overflow-x-auto rounded-xl border border-border bg-muted/30 p-4">
          <div
            ref={certRef}
            style={{
              width: 800,
              minHeight: 566,
              background: "#ffffff",
              padding: "52px 64px 44px",
              position: "relative",
              fontFamily: "Georgia, 'Times New Roman', serif",
              color: "#1a1a1a",
              boxSizing: "border-box",
            }}
          >
            {/* Outer border frame */}
            <div style={{ position: "absolute", inset: 10, border: "3px double hsl(160,84%,39%)", opacity: 0.25, pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 16, border: "1px solid hsl(160,84%,39%)", opacity: 0.12, pointerEvents: "none" }} />

            {/* Corner ornaments */}
            {[
              { top: 8, left: 8 },
              { top: 8, right: 8 },
              { bottom: 8, left: 8 },
              { bottom: 8, right: 8 },
            ].map((pos, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 20,
                  height: 20,
                  borderColor: "hsl(160,84%,39%)",
                  borderStyle: "solid",
                  borderWidth: 0,
                  opacity: 0.35,
                  borderTopWidth: i < 2 ? 2 : 0,
                  borderBottomWidth: i >= 2 ? 2 : 0,
                  borderLeftWidth: i % 2 === 0 ? 2 : 0,
                  borderRightWidth: i % 2 === 1 ? 2 : 0,
                  ...pos,
                }}
              />
            ))}

            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <img
                src={launchpadLogo}
                alt="LaunchPad"
                style={{ height: 56, width: "auto", display: "inline-block" }}
                crossOrigin="anonymous"
              />
            </div>

            {/* Programme label */}
            <p style={{
              textAlign: "center",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "hsl(160,84%,30%)",
              fontFamily: "Arial, sans-serif",
              fontWeight: 700,
              margin: "0 0 6px 0",
            }}>
              LaunchPad Financial Literacy Program
            </p>

            {/* Main title */}
            <h1 style={{
              textAlign: "center",
              fontSize: 34,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 10px 0",
              letterSpacing: "0.01em",
            }}>
              Certificate of Completion
            </h1>

            {/* Decorative rule */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 60px 18px" }}>
              <div style={{ height: 1, flex: 1, background: "hsl(160,84%,39%)", opacity: 0.35 }} />
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: i === 1 ? 8 : 5, height: i === 1 ? 8 : 5, borderRadius: "50%", background: "hsl(160,84%,39%)", opacity: i === 1 ? 1 : 0.45, marginTop: i === 1 ? 0 : 1.5 }} />
                ))}
              </div>
              <div style={{ height: 1, flex: 1, background: "hsl(160,84%,39%)", opacity: 0.35 }} />
            </div>

            {/* Certify text */}
            <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", margin: "0 0 6px 0" }}>
              This is to certify that
            </p>

            {/* Student name */}
            <h2 style={{
              textAlign: "center",
              fontSize: 30,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 8px 0",
              letterSpacing: "-0.01em",
            }}>
              {studentName}
            </h2>

            {/* Course description */}
            <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", margin: "0 0 6px 0" }}>
              has successfully completed all {student.total_lessons} lessons in
            </p>

            {/* Bundle name */}
            <h3 style={{
              textAlign: "center",
              fontSize: 20,
              fontWeight: 700,
              color: "hsl(160,84%,30%)",
              margin: "0 0 8px 0",
            }}>
              {student.bundle_name || "Financial Literacy Program"}
            </h3>

            {/* Score */}
            {score !== null && (
              <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280", margin: "0 0 4px 0" }}>
                with an average score of{" "}
                <span style={{ fontWeight: 700, color: "#374151" }}>{score}%</span>
              </p>
            )}

            {/* Date */}
            <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", margin: "0 0 28px 0", fontFamily: "Arial, sans-serif" }}>
              Issued on {completionDate}
            </p>

            {/* Signature row */}
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 170, borderTop: "1px solid #9ca3af", margin: "0 auto 5px" }} />
                <p style={{ fontSize: 12, color: "#374151", margin: 0, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>
                  {adminName}
                </p>
                <p style={{ fontSize: 10, color: "#9ca3af", margin: 0, fontFamily: "Arial, sans-serif" }}>
                  Administrator
                </p>
              </div>

              {/* Seal */}
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                border: "3px solid hsl(160,84%,39%)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                opacity: 0.3,
              }}>
                <div style={{ fontSize: 9, fontFamily: "Arial, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", color: "hsl(160,84%,25%)", lineHeight: 1.3 }}>
                  LaunchPad<br />Certified
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ width: 170, borderTop: "1px solid #9ca3af", margin: "0 auto 5px" }} />
                <p style={{ fontSize: 12, color: "#374151", margin: 0, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>
                  {orgName}
                </p>
                <p style={{ fontSize: 10, color: "#9ca3af", margin: 0, fontFamily: "Arial, sans-serif" }}>
                  Organization
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Generating PDF…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
