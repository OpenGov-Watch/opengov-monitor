// Type declarations for direct lucide-react icon imports
// These imports use the internal ESM path for better tree-shaking
declare module "lucide-react/dist/esm/icons/*" {
  import { LucideIcon } from "lucide-react";
  const icon: LucideIcon;
  export default icon;
}
