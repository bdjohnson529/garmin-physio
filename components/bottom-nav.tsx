"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, PersonIcon, ShareIcon, TrendingUpIcon } from "./icons";

const TABS = [
  { href: "/", label: "Activities", icon: CalendarIcon },
  { href: "/timeline", label: "Timeline", icon: TrendingUpIcon },
  { href: "/body", label: "Body", icon: PersonIcon },
  { href: "/share", label: "Share", icon: ShareIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map(({ href, label, icon: IconComponent }) => {
        const active = href === "/" ? pathname === "/" || pathname === "/import" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <span className="nav-icon">
              <IconComponent />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
