// A LucideIcon, not a ComponentType. Every icon here IS a lucide icon, and lucide exports them
// as forwardRef exotic components, which `ComponentType` does not admit — so the old type made
// every registration a type error while compiling fine under esbuild, which does not check types.
import type { LucideIcon } from "lucide-react";

/**
 * The account page's card list, as a registry rather than a fixed set.
 *
 * `/account` belongs to this spine, but the things a signed-in person wants from it —
 * orders, billing, team — belong to spines that may or may not be installed. A card is
 * therefore contributed by whichever spine owns the destination, and this spine renders
 * whatever turned up. An app with no storefront registers no Orders card and shows none,
 * so nothing on the page can link to a route that does not exist.
 *
 * Registration happens at MODULE SCOPE in the contributing spine, and App.tsx imports
 * every route component at the top of the file, so every card is registered before React
 * renders anything. There is no ordering hazard and no effect to wait for.
 *
 * Contributing a card:
 *
 *   // src/lib/storefrontChrome.ts, owned by the storefront spine
 *   import { registerAccountCard } from "@/lib/accountHub";
 *   registerAccountCard({
 *     key: "orders", to: "/account/orders", title: "Orders",
 *     description: "Everything you have bought, with delivery and tracking.",
 *   });
 *
 * ...then `import "@/lib/storefrontChrome";` from that spine's pages.
 */
export interface AccountCard {
  /** Stable identity. Registering the same key twice replaces the earlier card. */
  key: string;
  /** An in-app route path. Only register a card whose route your spine installs. */
  to: string;
  title: string;
  description: string;
  /** Lower sorts first. Profile is 10 and Security is 20; contributed cards default to 100. */
  order?: number;
  icon?: LucideIcon;
}

const DEFAULT_ORDER = 100;

const registry = new Map<string, AccountCard>();

export function registerAccountCard(card: AccountCard): void {
  if (card.key.length === 0) throw new Error("An account card needs a stable key.");
  if (!card.to.startsWith("/")) {
    throw new Error(`Account card '${card.key}' must link to an in-app path, got '${card.to}'.`);
  }
  registry.set(card.key, card);
}

/** Registered cards, in display order. Ties break on key so the order is stable. */
export function accountCards(): AccountCard[] {
  return [...registry.values()].sort(
    (left, right) =>
      (left.order ?? DEFAULT_ORDER) - (right.order ?? DEFAULT_ORDER) ||
      left.key.localeCompare(right.key),
  );
}

/** Empties the registry. For tests — module scope registration is otherwise permanent. */
export function clearAccountCards(): void {
  registry.clear();
}
