import { Link } from "@tanstack/react-router";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold shadow-sm transition-[transform,background-color,box-shadow] active:scale-[0.98] disabled:opacity-60";

const variants = {
  primary: "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 hover:shadow-md",
  secondary: "bg-secondary text-secondary-foreground shadow-secondary/20 hover:bg-secondary/90 hover:shadow-md",
  outline: "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
  ghost: "text-secondary hover:bg-secondary-soft",
} as const;

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

export function LinkButton({
  to,
  variant = "primary",
  className,
  children,
}: {
  to: string;
  variant?: keyof typeof variants;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(base, variants[variant], className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("kin-card p-4", className)}>{children}</div>;
}

export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "coral" | "lime" | "sunny" | "secondary";
}) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary-soft text-foreground",
    coral: "bg-coral-soft text-foreground",
    lime: "bg-lime-soft text-foreground",
    sunny: "bg-sunny-soft text-foreground",
    secondary: "bg-secondary-soft text-foreground",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full min-h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";
