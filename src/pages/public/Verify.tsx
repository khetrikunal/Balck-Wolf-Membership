import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Loading } from "@/components/common/States";
import { formatDate } from "@/lib/utils";

/** Public QR landing page. Shows only membership number, plan, status and expiry — never personal data. */
export default function Verify() {
  const { token = "" } = useParams();
  const q = useQuery({ queryKey: ["verify", token], queryFn: async () => { const { data, error } = await supabase.rpc("verify_membership_token", { p_token: token }); if (error) throw error; return data as { valid: boolean; membership_number?: string; plan?: string; status?: string; expires_at?: string | null }; } });
  if (q.isLoading) return <Loading />;
  const d = q.data;
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
      {d?.valid ? <CheckCircle2 className="h-14 w-14 text-emerald-400" /> : <XCircle className="h-14 w-14 text-destructive" />}
      <h1 className="text-5xl">{d?.valid ? "Valid member" : d?.membership_number ? "Membership not active" : "Card not recognised"}</h1>
      {d?.membership_number && <p className="text-muted-foreground">{d.membership_number} · {d.plan} · {d.expires_at ? `expires ${formatDate(d.expires_at)}` : "lifetime"}</p>}
    </div>
  );
}
