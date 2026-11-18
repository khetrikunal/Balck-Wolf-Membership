import { useEffect, type ReactNode } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { errorMessage } from "@/lib/utils";

export const AdminTitle = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-5xl">{title}</h1><div className="flex gap-2">{children}</div></div>
);

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Card className={`my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} p-6`}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-3xl">{title}</h2><button aria-label="Close" onClick={onClose}><X /></button></div>
        {children}
      </Card>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground"><tr>{head.map((h) => <th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-border [&_td]:p-3 [&_td]:align-middle">{children}</tbody>
      </table>
    </div>
  );
}

export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <Card className="p-5"><p className="eyebrow">{label}</p><p className="mt-2 font-display text-5xl">{value}</p>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</Card>
);

/** Mutation helper: toast on success/error and refresh the given query keys. */
export function useAction<V>(fn: (v: V) => Promise<unknown>, opts: { invalidate: QueryKey[]; success?: string; onDone?: () => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { opts.invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })); if (opts.success) toast.success(opts.success); opts.onDone?.(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
