import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/utils";

export const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground" role="status">
    <Loader2 className="h-5 w-5 animate-spin" /> {label}
  </div>
);

export const ErrorState = ({ error, retry }: { error: unknown; retry?: () => void }) => (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <AlertCircle className="h-8 w-8 text-destructive" />
    <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
    {retry && <Button variant="outline" size="sm" onClick={retry}>Try again</Button>}
  </div>
);

export const EmptyState = ({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-2 py-16 text-center">
    <Inbox className="h-8 w-8 text-muted-foreground" />
    <p className="font-display text-2xl">{title}</p>
    {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

/** Renders loading / error / empty / data for a TanStack Query result. */
export function QueryBoundary<T>({ query, empty, children }: {
  query: { isLoading: boolean; error: unknown; data: T | undefined; refetch: () => unknown };
  empty?: { title: string; hint?: string; action?: React.ReactNode };
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const d = query.data as T;
  if (empty && (d == null || (Array.isArray(d) && d.length === 0))) return <EmptyState {...empty} />;
  return <>{children(d)}</>;
}
