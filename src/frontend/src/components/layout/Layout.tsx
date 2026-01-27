import { Outlet } from "react-router";
import { useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileHeader } from "./mobile-header";
import { BottomNav } from "./bottom-nav";

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <Sidebar />

      {/* Mobile Drawer - only renders on mobile */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header - only visible on mobile */}
        <MobileHeader onMenuClick={() => setIsMobileMenuOpen(true)} />

        {/* Main content - with padding for bottom nav on mobile */}
        <main className="flex-1 flex flex-col overflow-auto p-4 md:p-6 pb-20 lg:pb-6">
          <div className="w-full max-w-[1600px] mx-auto flex-1 flex flex-col min-h-0">
            <Outlet />
          </div>
        </main>

        {/* Bottom Navigation - only visible on mobile */}
        <BottomNav onMoreClick={() => setIsMobileMenuOpen(true)} />
      </div>
    </div>
  );
}
