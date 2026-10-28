export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/listings/new", label: "New listing" },
  { href: "/listings/mine", label: "My listings" },
  { href: "/messages", label: "Messages" },
  { href: "/transactions", label: "Transactions" },
  { href: "/impact", label: "Carbon impact", feature: "carbonImpact" as const },
] as const;

export type NavFeature = "carbonImpact";