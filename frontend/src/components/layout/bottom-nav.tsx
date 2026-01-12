import { Link, useLocation } from "react-router";
import { Vote, Wallet, Users, LayoutDashboard, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onMoreClick: () => void;
}

const primaryNavItems = [
  { name: "Referenda", href: "/referenda", icon: Vote },
  { name: "Treasury", href: "/treasury", icon: Wallet },
  { name: "Fellowship", href: "/fellowship", icon: Users },
  { name: "Dashboards", href: "/dashboards", icon: LayoutDashboard },
];

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 border-t bg-background">
      <div className="flex h-full items-center justify-around px-2">
        {primaryNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[60px] h-full transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-1 min-w-[60px] h-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label="More options"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-xs font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
