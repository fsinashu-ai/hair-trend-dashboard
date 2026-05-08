import type { ReactNode } from "react";

type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  title: string;
};

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center shadow-sm">
      <h3 className="text-base font-semibold text-stone-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
