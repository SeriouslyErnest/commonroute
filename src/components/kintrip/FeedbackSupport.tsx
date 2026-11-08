import { ExternalLink, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small, unobtrusive link to the project's public feedback and support page.
 * Purely presentational: no backend, no in-app form, no tracking.
 */
export const FEEDBACK_URL = "https://seriouslyernest.github.io/#feedback";

export function FeedbackSupportLink({
  className = "",
  hint = false,
}: {
  className?: string;
  hint?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 flex-col items-center gap-0.5", className)}>
      <a
        href={FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-bold text-secondary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <LifeBuoy className="size-4 shrink-0" aria-hidden />
        Feedback & Support
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      </a>
      {hint ? (
        <span className="max-w-md text-xs text-muted-foreground">
          Ideas, feature requests and bug reports — plus Ko-fi if you'd like to support the project.
        </span>
      ) : null}
    </span>
  );
}
