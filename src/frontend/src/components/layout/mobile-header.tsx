import Menu from "lucide-react/dist/esm/icons/menu";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b bg-background">
      <Button
        variant="ghost"
        size="sm"
        onClick={onMenuClick}
        className="h-9 w-9 p-0"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Link to="/" className="font-bold text-lg">
        OpenGov Monitor
      </Link>
      <div className="w-9" /> {/* Spacer for centering */}
    </header>
  );
}
