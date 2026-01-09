import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";
import { LucideIcon, LogIn, LogOut, User } from "lucide-react";
import {
  Vote,
  Wallet,
  Gift,
  Users,
  Calendar,
  UserCheck,
  Clock,
  TimerOff,
  ScrollText,
  PieChart,
  Tags,
  Coins,
  FileBox,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  title?: string;
  items: NavItem[];
  requiresAuth?: boolean;
}

interface Dashboard {
  id: number;
  name: string;
}

// Static navigation sections
const staticNavigation: NavSection[] = [
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
];

// Sections that require authentication
const authenticatedNavigation: NavSection[] = [
  {
    title: "Analytics",
    items: [{ name: "All Spending", href: "/spending", icon: PieChart }],
    requiresAuth: true,
  },
  {
    title: "Manage",
    items: [
      { name: "Dashboards", href: "/dashboards", icon: LayoutDashboard },
      { name: "Categories", href: "/manage/categories", icon: Tags },
      { name: "Bounties", href: "/manage/bounties", icon: Coins },
      { name: "Subtreasury", href: "/manage/subtreasury", icon: FileBox },
      { name: "Sync Settings", href: "/manage/sync", icon: RefreshCw },
    ],
    requiresAuth: true,
  },
  {
    title: "System",
    items: [{ name: "Logs", href: "/logs", icon: ScrollText }],
    requiresAuth: true,
  },
];

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);

  // Fetch dashboards list
  useEffect(() => {
    fetch("/api/dashboards")
      .then((res) => res.json())
      .then((data) => setDashboards(Array.isArray(data) ? data : []))
      .catch(() => setDashboards([]));
  }, []);

  // Build navigation based on auth state
  const visibleNavigation = [
    ...staticNavigation,
    ...(isAuthenticated ? authenticatedNavigation : []),
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link to="/" className="text-xl font-bold">
          OpenGov Monitor
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        {visibleNavigation.map((section, sectionIdx) => (
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
                    to={item.href}
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

        {/* Dashboards section - always visible, dynamic list */}
        <div className="mt-6">
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dashboards
          </h3>
          <div className="space-y-1">
            {dashboards.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground italic">
                No dashboards
              </p>
            ) : (
              dashboards.map((dashboard) => {
                const href = `/dashboards/${dashboard.id}`;
                const isActive = pathname === href || pathname === `${href}/edit`;
                return (
                  <Link
                    key={dashboard.id}
                    to={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    )}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {dashboard.name}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </nav>
      <div className="border-t p-4 space-y-3">
        {isLoading ? (
          <div className="h-8 animate-pulse bg-muted rounded" />
        ) : isAuthenticated && user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="truncate max-w-[120px]">{user.username}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="h-8 w-8 p-0"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        )}
        <p className="text-xs text-muted-foreground">
          Polkadot Governance Data
        </p>
      </div>
    </div>
  );
}
