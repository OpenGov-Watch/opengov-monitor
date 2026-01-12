import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 border-b bg-background flex items-center px-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onMenuClick}
        className="h-9 w-9 p-0"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Link to="/" className="ml-3 font-bold text-lg">
        OpenGov Monitor
      </Link>
    </header>
  );
}
