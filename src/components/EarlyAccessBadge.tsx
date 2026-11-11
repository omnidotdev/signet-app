import cn from "@/lib/utils";

/**
 * "Early Access" status pill shown alongside the Signet wordmark while the
 * product is in its early-access phase. Remove once Signet exits early access.
 */
export function EarlyAccessBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary uppercase leading-none tracking-wide",
        className,
      )}
    >
      Early Access
    </span>
  );
}
