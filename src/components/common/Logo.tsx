import { cn } from "@/lib/utils";

/**
 * Placeholder wordmark. The real BLACK WOLF logo will be supplied separately:
 * drop the file at /public/logo.svg (or .png) and it is used automatically everywhere via this component.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src="/logo.svg" alt="" className="h-8 w-auto" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      <span className="font-display text-[23px] font-semibold tracking-[0.14em] sm:text-[25px]">BLACK WOLF</span>
    </span>
  );
}
