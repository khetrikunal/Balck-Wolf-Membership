import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-lg border border-border bg-card text-card-foreground", className)} {...p} />
);
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-5", className)} {...p} />
);
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-xl", className)} {...p} />
);
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-5 pt-0", className)} {...p} />
);

const tone: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300", paid: "bg-emerald-500/15 text-emerald-300", delivered: "bg-emerald-500/15 text-emerald-300",
  completed: "bg-emerald-500/15 text-emerald-300", accepted: "bg-emerald-500/15 text-emerald-300", approved: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-300", pending_payment: "bg-amber-500/15 text-amber-300", submitted: "bg-amber-500/15 text-amber-300",
  under_review: "bg-amber-500/15 text-amber-300", quotation_sent: "bg-sky-500/15 text-sky-300", sent: "bg-sky-500/15 text-sky-300",
  processing: "bg-sky-500/15 text-sky-300", shipped: "bg-sky-500/15 text-sky-300", in_production: "bg-sky-500/15 text-sky-300",
  expired: "bg-zinc-500/20 text-zinc-300", inactive: "bg-zinc-500/20 text-zinc-300", draft: "bg-zinc-500/20 text-zinc-300", archived: "bg-zinc-500/20 text-zinc-300",
  suspended: "bg-red-500/15 text-red-300", cancelled: "bg-red-500/15 text-red-300", rejected: "bg-red-500/15 text-red-300",
  failed: "bg-red-500/15 text-red-300", refunded: "bg-red-500/15 text-red-300",
};
export const Badge = ({ status, children }: { status: string; children?: React.ReactNode }) => (
  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", tone[status] ?? "bg-accent text-accent-foreground")}>
    {children ?? status.replace(/_/g, " ")}
  </span>
);
