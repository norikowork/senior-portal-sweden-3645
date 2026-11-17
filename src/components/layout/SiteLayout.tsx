import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/roles";

/** The name the header and footer link home with. */
const SITE_NAME = "Seniorportalen";

/**
 * The site's layout: header, page, footer. Every route renders inside it, the auth_basic sign-in
 * and account pages included.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  const { user, signedIn, loading } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(40_30%_97%)] text-foreground">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link className="text-2xl font-bold text-primary" to="/">
            {SITE_NAME}
          </Link>
          <nav aria-label="Konto" className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="ghost" className="text-base">
              <Link to="/bli-utforare">Bli utförare</Link>
            </Button>
            {!loading && signedIn && isAdmin(user) && (
              <Button asChild size="sm" variant="ghost" className="text-base">
                <Link to="/admin">Admin</Link>
              </Button>
            )}
            {!loading && signedIn && (
              <Button asChild size="sm" className="text-base">
                <Link to="/mina-sidor">Mina sidor</Link>
              </Button>
            )}
            {!loading && !signedIn && pathname !== "/login" && (
              <Button asChild size="sm" className="text-base">
                <Link to="/login">Logga in / Skapa konto</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-base text-muted-foreground sm:px-6">
          <Link className="underline-offset-4 hover:text-foreground hover:underline" to="/">
            {SITE_NAME}
          </Link>
          <span>© Seniorportalen – trygg hjälp i hemmet</span>
        </div>
      </footer>
    </div>
  );
}
