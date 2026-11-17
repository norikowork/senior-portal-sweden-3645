import type { ReactNode } from "react";

/** A sign-in step as page content: a centered card with the page's heading. */
export default function AuthCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6 sm:py-16">
      <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className={icon ? "flex flex-col items-center text-center" : undefined}>
          {icon}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {children && <div className="mt-6">{children}</div>}
      </section>
    </div>
  );
}
