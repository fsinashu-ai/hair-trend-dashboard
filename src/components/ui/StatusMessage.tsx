import type { ReactNode } from "react";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

type StatusMessageProps = {
  children: ReactNode;
  isLoading?: boolean;
  tone?: StatusTone;
};

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-stone-200 bg-white text-stone-700",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-teal-200 bg-teal-50 text-teal-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
};

export function StatusMessage({
  children,
  isLoading = false,
  tone = "neutral",
}: StatusMessageProps) {
  return (
    <section
      aria-live="polite"
      className={`rounded-lg border p-4 text-sm shadow-sm ${toneClasses[tone]}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        {isLoading ? (
          <span
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        <div className="leading-6">{children}</div>
      </div>
    </section>
  );
}
