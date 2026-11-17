import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LogOut, Loader2, Shield, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { accountCards, type AccountCard } from "@/lib/accountHub";
import { accountDisplayName, draftFromUser } from "@/lib/authAccount";

/**
 * Profile and Security are shipped by this spine, so they are always here. Everything
 * else on this page is contributed by whichever spine owns the destination — see
 * `@/lib/accountHub`. That is why there is no Orders or Billing entry hard-coded below:
 * a card whose route is not installed would be a link to Not Found.
 */
const OWN_CARDS: AccountCard[] = [
  {
    key: "profile",
    to: "/account/profile",
    title: "Profil",
    description: "Ditt namn och e-postadressen du loggar in med.",
    order: 10,
    icon: UserRound,
  },
  {
    key: "security",
    to: "/account/security",
    title: "Säkerhet",
    description: "Lösenord, nycklar (passkeys), verifieringskod och inloggade enheter.",
    order: 20,
    icon: Shield,
  },
];

function HubCard({ card }: { card: AccountCard }) {
  const Icon: LucideIcon = card.icon ?? ArrowRight;
  return (
    <Link to={card.to} className="block group">
      <section className="rounded-lg border border-border bg-card p-6 shadow-xs h-full transition-shadow group-hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <Icon className="text-primary" size={22} />
          <ArrowRight className="text-muted-foreground" size={18} />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">{card.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
      </section>
    </Link>
  );
}

export default function AccountHome() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const draft = draftFromUser(user);
  const name = draft.firstName.trim() ? accountDisplayName(user) : null;
  const cards = [...OWN_CARDS, ...accountCards()].sort(
    (left, right) => (left.order ?? 100) - (right.order ?? 100) || left.key.localeCompare(right.key),
  );

  async function handleSignOut(): Promise<void> {
    await signOut();
    navigate("/");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 aria-label="Laddar kontot" className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ditt konto</h1>
            {name && <p className="mt-2 font-medium">{name}</p>}
            <p className="mt-1 text-muted-foreground">{draft.email}</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleSignOut}>
            <LogOut size={16} /> Logga ut
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <HubCard card={card} key={card.key} />
          ))}
        </div>
      </div>
    </div>
  );
}
