import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface Props { number: string; name: string; plan: string; issued: string; expires: string | null; status: string; token: string }

/**
 * Digital membership card. The QR encodes only a verification URL with an unguessable token
 * (see verify_membership_token RPC) — no personal data is embedded.
 */
export function MembershipCard(p: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [qr, setQr] = useState<string>("");
  const verifyUrl = `${window.location.origin}/verify/${p.token}`;

  useEffect(() => { QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, color: { dark: "#0a0a0a", light: "#f4f4f5" } }).then(setQr); }, [verifyUrl]);

  useEffect(() => {
    if (!qr || !canvas.current) return;
    const c = canvas.current; const ctx = c.getContext("2d")!;
    const W = 1012, Hh = 638; c.width = W; c.height = Hh;
    const g = ctx.createLinearGradient(0, 0, W, Hh); g.addColorStop(0, "#111111"); g.addColorStop(1, "#262626");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.strokeStyle = "#a1a1aa"; ctx.lineWidth = 3; ctx.strokeRect(14, 14, W - 28, Hh - 28);
    ctx.fillStyle = "#f4f4f5"; ctx.font = "64px 'Bebas Neue', Impact, sans-serif"; ctx.fillText("BLACK WOLF", 56, 110);
    ctx.fillStyle = "#a1a1aa"; ctx.font = "22px Inter, sans-serif"; ctx.fillText("MEMBERSHIP", 58, 145);
    ctx.fillStyle = "#f4f4f5"; ctx.font = "600 38px Inter, sans-serif"; ctx.fillText(p.name.slice(0, 26), 56, 300);
    ctx.fillStyle = "#d4d4d8"; ctx.font = "500 30px 'Courier New', monospace"; ctx.fillText(p.number, 56, 350);
    ctx.fillStyle = "#a1a1aa"; ctx.font = "20px Inter, sans-serif";
    ctx.fillText("PLAN", 56, 430); ctx.fillText("ISSUED", 380, 430); ctx.fillText("EXPIRES", 56, 520); ctx.fillText("STATUS", 380, 520);
    ctx.fillStyle = "#f4f4f5"; ctx.font = "600 28px Inter, sans-serif";
    ctx.fillText(p.plan.slice(0, 22), 56, 462); ctx.fillText(formatDate(p.issued), 380, 462);
    ctx.fillText(p.expires ? formatDate(p.expires) : "Lifetime", 56, 552); ctx.fillText(p.status.toUpperCase(), 380, 552);
    const img = new Image(); img.onload = () => { ctx.drawImage(img, W - 290, Hh - 290, 240, 240); }; img.src = qr;
  }, [qr, p.name, p.number, p.plan, p.issued, p.expires, p.status]);

  function download() {
    const a = document.createElement("a"); a.download = `black-wolf-${p.number}.png`; a.href = canvas.current!.toDataURL("image/png"); a.click();
  }

  return (
    <section>
      <h2 className="mb-3 text-3xl">Digital membership card</h2>
      <canvas ref={canvas} className="w-full max-w-xl rounded-xl border border-border shadow-2xl" aria-label={`Membership card ${p.number}`} />
      <Button className="mt-4" variant="outline" onClick={download} disabled={!qr}><Download className="h-4 w-4" /> Download card</Button>
    </section>
  );
}
