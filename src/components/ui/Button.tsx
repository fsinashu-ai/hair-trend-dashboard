import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary";
};

const variantClasses = {
  primary: "bg-stone-950 text-white hover:bg-stone-800",
  secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100",
};

export function Button({ children, href, variant = "primary" }: ButtonProps) {
  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 text-center text-sm font-semibold transition ${variantClasses[variant]}`}
      href={href}
    >
      {children}
    </Link>
  );
}
