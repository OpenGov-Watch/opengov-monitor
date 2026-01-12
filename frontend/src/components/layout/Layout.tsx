import { Outlet } from "react-router";
import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { MobileHeader } from "./mobile-header";
import { BottomNav } from "./bottom-nav";

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile Drawer Sidebar */}
      {isMobile && (
        <Sidebar
          isMobile={true}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Header */}
      {isMobile && (
        <MobileHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col overflow-hidden p-4 md:p-6 ${isMobile ? "pt-16 pb-20" : ""}`}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <BottomNav onMoreClick={() => setIsMobileMenuOpen(true)} />
      )}
    </div>
  );
}
