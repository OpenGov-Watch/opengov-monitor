import { Link, useLocation } from "react-router";
import Vote from "lucide-react/dist/esm/icons/vote";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import Users from "lucide-react/dist/esm/icons/users";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import Menu from "lucide-react/dist/esm/icons/menu";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onMoreClick: () => void;
}

const navItems = [
  { name: "Referenda", href: "/referenda", icon: Vote },
  { name: "Treasury", href: "/treasury", icon: Wallet },
  { name: "Fellowship", href: "/fellowship", icon: Users },
  { name: "Dashboards", href: "/dashboards", icon: LayoutDashboard },
];

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-16 border-t bg-background">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs font-medium transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.name}</span>
          </Link>
        );
      })}
      <button
        onClick={onMoreClick}
        className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
        <span>More</span>
      </button>
    </nav>
  );
}
