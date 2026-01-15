import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";
import { LucideIcon, LogIn, LogOut, User, ChevronLeft, ChevronRight, Server, ChevronDown } from "lucide-react";
import {
  Vote,
  Wallet,
  Gift,
  Users,
  Calendar,
  UserCheck,
  Clock,
  TimerOff,
  PieChart,
  Tags,
  Coins,
  FileBox,
  Database,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useApi } from "@/contexts/api-context";
import { getApiBase } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
      { name: "Treasury Netflows", href: "/treasury-netflows", icon: TrendingUp },
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
      { name: "Custom Spending", href: "/manage/custom-spending", icon: Database },
      { name: "Sync Settings", href: "/manage/sync", icon: RefreshCw },
      { name: "Data Errors", href: "/manage/data-errors", icon: AlertTriangle },
    ],
    requiresAuth: true,
  },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const location = useLocation();
  const pathname = location.pathname;
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const { apiBase, presets, currentPreset, setApi } = useApi();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  // Fetch dashboards list (using dynamic API base)
  useEffect(() => {
    fetch(`${getApiBase()}/dashboards`)
      .then((res) => res.json())
      .then((data) => setDashboards(Array.isArray(data) ? data : []))
      .catch(() => setDashboards([]));
  }, [apiBase]); // Re-fetch when API changes

  // Build navigation based on auth state
  const visibleNavigation = [
    ...staticNavigation,
    ...(isAuthenticated ? authenticatedNavigation : []),
  ];

  const handleLinkClick = () => {
    // Close mobile drawer when clicking a link
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-background">
      {/* Mobile Sheet uses its own header, desktop sidebar has embedded header */}
      {!isMobileOpen && (
        <div
          className={cn(
            "flex h-12 items-center border-b",
            collapsed ? "justify-center px-1" : "justify-between px-4"
          )}
        >
          <Link
            to="/"
            className={cn("font-bold", collapsed ? "text-sm" : "text-lg")}
            title={collapsed ? "OpenGov Monitor" : undefined}
          >
            {collapsed ? "OG" : "OpenGov Monitor"}
          </Link>
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(true)}
              className="h-7 w-7 p-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      {!isMobileOpen && collapsed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 h-7 w-7 p-0"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
      <nav className={cn("flex-1 overflow-y-auto", isMobileOpen ? "p-4" : (collapsed ? "p-2" : "p-4"))}>
        {visibleNavigation.map((section, sectionIdx) => (
          <div key={section.title || sectionIdx} className={cn(sectionIdx > 0 && "mt-6")}>
            {section.title && (!collapsed || isMobileOpen) && (
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
                    onClick={handleLinkClick}
                    title={collapsed && !isMobileOpen ? item.name : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-sm font-medium transition-colors",
                      (collapsed && !isMobileOpen) ? "justify-center p-2" : "gap-3 px-3 py-2",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {(!collapsed || isMobileOpen) && item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Dashboards section - always visible, dynamic list */}
        <div className="mt-6">
          {(!collapsed || isMobileOpen) && (
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dashboards
            </h3>
          )}
          <div className="space-y-1">
            {dashboards.length === 0 ? (
              (!collapsed || isMobileOpen) && (
                <p className="px-3 py-2 text-sm text-muted-foreground italic">
                  No dashboards
                </p>
              )
            ) : (
              dashboards.map((dashboard) => {
                const href = `/dashboards/${dashboard.id}`;
                const isActive = pathname === href || pathname === `${href}/edit`;
                return (
                  <Link
                    key={dashboard.id}
                    to={href}
                    onClick={handleLinkClick}
                    title={collapsed && !isMobileOpen ? dashboard.name : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-sm font-medium transition-colors",
                      (collapsed && !isMobileOpen) ? "justify-center p-2" : "gap-3 px-3 py-2",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    )}
                  >
                    <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                    {(!collapsed || isMobileOpen) && dashboard.name}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </nav>
      <div className={cn("border-t space-y-3", isMobileOpen ? "p-4" : (collapsed ? "p-2" : "p-4"))}>
        {isLoading ? (
          <div className="h-8 animate-pulse bg-muted rounded" />
        ) : isAuthenticated && user ? (
          <div
            className={cn(
              "flex items-center",
              (collapsed && !isMobileOpen) ? "justify-center" : "justify-between"
            )}
          >
            {(!collapsed || isMobileOpen) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="truncate max-w-[120px]">{user.username}</span>
              </div>
            )}
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
            onClick={handleLinkClick}
            title={collapsed && !isMobileOpen ? "Sign in" : undefined}
            className={cn(
              "flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors",
              (collapsed && !isMobileOpen) ? "justify-center" : "gap-2"
            )}
          >
            <LogIn className="h-4 w-4" />
            {(!collapsed || isMobileOpen) && "Sign in"}
          </Link>
        )}
        {/* API selector - only visible in development */}
        {import.meta.env.DEV && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-between text-xs text-muted-foreground hover:text-foreground",
                  (collapsed && !isMobileOpen) && "p-0 h-8 w-8"
                )}
                title={(collapsed && !isMobileOpen) ? `API: ${currentPreset || apiBase}` : undefined}
              >
                <span className="flex items-center gap-1.5">
                  <Server className="h-3 w-3" />
                  {(!collapsed || isMobileOpen) && (
                    <span className="truncate max-w-[140px]">
                      {currentPreset || apiBase}
                    </span>
                  )}
                </span>
                {(!collapsed || isMobileOpen) && <ChevronDown className="h-3 w-3 opacity-50" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {Object.entries(presets).map(([name, url]) => (
                <DropdownMenuItem
                  key={name}
                  onClick={() => setApi(name)}
                  className={cn(currentPreset === name && "bg-accent")}
                >
                  <span className="font-medium">{name}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    {url}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {(!collapsed || isMobileOpen) && (
          <p className="text-xs text-muted-foreground">Polkadot Governance Data</p>
        )}
      </div>
    </div>
  );

  // Mobile: render as Sheet drawer
  if (isMobileOpen !== undefined && onMobileClose) {
    return (
      <Sheet open={isMobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: render as fixed sidebar
  return (
    <div
      className={cn(
        "hidden lg:flex h-screen flex-col border-r bg-background transition-all duration-200",
        collapsed ? "w-14" : "w-64"
      )}
    >
      {sidebarContent}
    </div>
  );
}
