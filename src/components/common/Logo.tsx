import { cn } from "@/lib/utils";

/**
 * Placeholder wordmark. The real BLACK WOLF logo will be supplied separately:
 * drop the file at /public/logo.svg (or .png) and it is used automatically everywhere via this component.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("brand-logo-window relative inline-flex h-12 w-28 shrink-0 items-center justify-center overflow-hidden bg-black mix-blend-screen sm:w-32", className)}>
      <img src="/01%20Black%20Wolf%20Logo.png" alt="BLACK WOLF" className="absolute left-1/2 top-1/2 h-auto w-[350%] max-w-none -translate-x-1/2 -translate-y-1/2" />
    </span>
  );
}
