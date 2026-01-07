"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";
import {
  Vote,
  Wallet,
  Gift,
  Users,
  Calendar,
  UserCheck,
  Home,
  Clock,
  TimerOff,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    items: [{ name: "Dashboard", href: "/", icon: Home }],
  },
  {
    title: "Governance",
    items: [
      { name: "Referenda", href: "/referenda", icon: Vote },
      { name: "Treasury", href: "/treasury", icon: Wallet },
      { name: "Child Bounties", href: "/child-bounties", icon: Gift },
    ],
  },
  {
    title: "Fellowship",
    items: [
      { name: "Fellowship", href: "/fellowship", icon: Users },
      { name: "Salary Cycles", href: "/fellowship-salary-cycles", icon: Calendar },
      { name: "Salary Claimants", href: "/fellowship-salary-claimants", icon: UserCheck },
    ],
  },
  {
    title: "Treasury Views",
    items: [
      { name: "Outstanding Claims", href: "/outstanding-claims", icon: Clock },
      { name: "Expired Claims", href: "/expired-claims", icon: TimerOff },
    ],
  },
  {
    title: "System",
    items: [{ name: "Logs", href: "/logs", icon: ScrollText }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="text-xl font-bold">
          OpenGov Monitor
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        {navigation.map((section, sectionIdx) => (
          <div key={section.title || sectionIdx} className={cn(sectionIdx > 0 && "mt-6")}>
            {section.title && (
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          Polkadot Governance Data
        </p>
      </div>
    </div>
  );
}
